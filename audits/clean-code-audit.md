# Clean-code audit — BomberMen-X

Author: Abhilash Anuku (AA), Architect and Delivery Lead, in the QA-lead hat
Audited: 2026-05-15 against `main` at the v0.2.0-rc tag

This is an honest static review pass over the three modules. The goal is not perfection — we are a two-week capstone with a 2026-04-22 start date — but to record what is right, what is wrong, and what we would fix first.

## 1. Package layering

The intent was a strict three-tier layering: `bomb-core` shared by both, `bomb-server` depends on `bomb-core`, `bomb-client` depends on `bomb-core`, and neither server nor client knows about the other. That intent holds.

Observation: `bomb-core` is not Jackson-free. The wire DTOs in `F:\Bomber Man X\BomberMan-X\bomb-core\src\main\java\com\bombermenx\core\net\dto` are records that Jackson serialises through `WireCodec`. Jackson is therefore a transitive runtime requirement of any consumer of the wire protocol. **Flag**: this is a tight coupling. We accept it because:

- the DTOs use plain records with no Jackson annotations, so a future Kryo path can serialise the same records;
- `WireCodec.mapper()` is the single Jackson entry point; nothing else in `bomb-core` touches Jackson directly.

**Action**: add a unit-level test in `WireCodecTest` that loads each DTO record via reflection and asserts round-trip encode/decode with no Jackson-specific annotations.

## 2. Naming consistency

Naming is consistent across modules. The conventions we landed on:

- Wire DTOs: noun records (`AuthRequest`, `AuthResult`, `LobbyHello`, `LobbySnapshot`, `ChatMessage`, `VoiceFrame`).
- Wire enums: SCREAMING_CASE constants (`MessageType.HELLO`, `MessageType.LOBBY_BUY`).
- Server collaborators: noun classes with `-Manager`, `-Registry`, `-Router`, `-Service`, `-Handler`, `-Filter` suffixes (`MatchManager`, `SessionRegistry`, `ChatRouter`, `LobbyService`, `GameServerHandler`, `ProfanityFilter`).
- Internal fields: lowerCamelCase, no Hungarian.

No `Helper`, `Util`, or `Manager2` classes. No conflicting names across modules.

## 3. Design-rationale comments

This is a strong spot. `GameWorld`, `MatchManager`, `LobbyService`, `ProfanityFilter`, and `ChatRouter` all carry block comments that explain *why* a design choice was made, not just what the code does. Examples:

- `MatchManager.warmupStartedAtMs` — comment explains why solo humans get a warmup window instead of waiting for 8 friends.
- `LobbyService` — comment explains why a single-threaded executor beats per-connection locks.
- `ChatRouter.onVoiceFrame` — comment explicitly flags that voice is relay-only and moderation is a future hook.
- `DevAuthProvider` — comment says it must never be in production.

This is the kind of comment that pays for itself when someone reads the code six months later. We make a point of asking for these in code review.

## 4. Test coverage gaps

Honest assessment. The current test surface is:

| Test | Module | What it covers |
|---|---|---|
| `WireCodecTest` | `bomb-core` | Envelope round-trip encode/decode |
| `GameWorldTest` | `bomb-core` | Deterministic simulation step + bomb chain |
| `ProfanityFilterTest` | `bomb-server` | Redaction + display-name sanitisation |

What is **not** covered by automated tests:

- `MatchManager` matchmaking paths (A / B / C, plurality vote, LEVELS bot scaling).
- `MatchSession` lifecycle (tick, snapshot fan-out, reap on finish).
- `LobbyService` purchase / equip flow, coin-grant timing, snapshot personalisation.
- `ChatRouter` scope routing and self-exclusion (sender does not receive own chat).
- `AuthRegistry` dispatch by provider key.
- `MetricsHandler` JSON shape and CORS headers.
- `WebSocketServer` pipeline composition (would need an embedded Netty test channel).

**This is the top item in the post-beta action list.** A capstone-scope project can survive thin testing for two weeks; a beta with real users cannot. The fix is incremental: add one JUnit class per server collaborator using plain in-memory mocks. The `MatchManager` test alone catches roughly half the recent bugs we shipped and rolled back.

## 5. Magic numbers in GameConfig

This is another strong spot. `F:\Bomber Man X\BomberMan-X\bomb-core\src\main\java\com\bombermenx\core\GameConfig.java` concentrates the tunable constants:

- `TICK_HZ = 60`
- `DEFAULT_ARENA_WIDTH = 15`
- `DEFAULT_ARENA_HEIGHT = 13`
- `MAX_PLAYERS = 8`
- `DEFAULT_BOMB_FUSE_TICKS = 150` (2.5 s)
- `DEFAULT_EXPLOSION_LIFETIME_TICKS = 36` (0.6 s)
- `DEFAULT_BOMB_POWER = 3`
- `DEFAULT_MOVE_SPEED = 12.0f` tiles/sec
- `DEFAULT_DESTRUCTIBLE_DENSITY = 0.40f`
- `POWERUP_DROP_RATE = 0.40f`
- `DEFAULT_MAX_BOMBS = 1`

Every constant has a comment explaining the tuning rationale (e.g. "150 ticks = 2.5 s — snappy but fair"; "40% leaves open lanes so combat starts in seconds, not minutes"). This file is the single source of truth for gameplay tuning; nothing in `bomb-server` or `bomb-client` hard-codes these values. JC's call to concentrate the magic numbers here paid for itself the first time we needed to retune.

**Flag**: the client renderer in `bomb-client\src\main\java\com\bombermenx\client\render` carries its own magic numbers (camera-shake magnitude, particle counts, glow alpha). These are render-only and SK owns the values, but they should migrate to a `RenderConfig` companion class for the same reason.

## 6. TODO markers in source

We searched all Java sources for `TODO|FIXME|XXX`. The result:

- One marker, in `F:\Bomber Man X\BomberMan-X\bomb-server\src\main\java\com\bombermenx\server\auth\GoogleAuthProvider.java`:

```text
// TODO: implement full OIDC verification (issue: studio/INCIDENTS/ doesn't have
// one yet — file ADR-007 when this lands).
```

That is it. One TODO across the entire Java codebase. This is unusually clean and reflects the discipline we built into the standup format — anything that would have become a TODO is instead a GitHub Issue with a numbered label.

## 7. Dead code potential

A pass over the server module did not find unreachable methods or unused classes. Two near-misses:

- `MatchManager.onReady(ClientSession, boolean)` is currently a no-op (the comment says "Hook reserved for a future explicit-ready lobby UX"). We keep it because removing it now would force a `MessageType` reshuffling later. **Status: kept by design, documented as a hook.**
- `ClientSession.requestedLevel` is only meaningful for LEVELS mode and stays at 1 for FFA / TEAMS. Acceptable; the field has a single owner.

## 8. Log levels

`slf4j` is used throughout — no `System.out.println` anywhere in production paths. Level discipline:

- `INFO` — lifecycle events (player joined queue, match started, lobby join/leave).
- `WARN` — recoverable problems (chat send failed to peer, Google verifier called without expected audience).
- `DEBUG` — high-volume per-frame diagnostics.

No `ERROR` calls in steady-state paths. Logback configuration ships with the server jar; CI uses the shaded jar so no log-config drift between dev and prod.

## 9. Other observations

- All public classes carry Javadoc on the type. Method-level Javadoc is sparser but present on every non-trivial method in the public API of each collaborator.
- Records are used for every data carrier (DTOs, config, snapshots). No legacy POJOs with getters and setters in the wire layer.
- `final` is used consistently on class fields and on classes that should not be subclassed (`BombServerApplication`, `WebSocketServer`, `MatchManager`, `LobbyService`, `ProfanityFilter`, `AuthRegistry`, `DevAuthProvider`, `GoogleAuthProvider`).
- Concurrency primitives are chosen carefully — `ConcurrentHashMap` for shared maps, `CopyOnWriteArrayList` for subscriber lists, single-threaded executors where ordering matters (matchmaker, lobby tick).
- No `synchronized` lock hidden inside a hot path; `MatchManager.matchmakeTick` is `synchronized` but runs at 1 Hz and never blocks an I/O thread.

## 10. Prioritised action list

In order of impact divided by effort:

1. **Add tests for `MatchManager`, `MatchSession`, `LobbyService`, `ChatRouter`, `AuthRegistry`** — this is the single biggest gap. One JUnit class per collaborator. Target: post-beta sprint week 1.
2. **Strip ASCII-control and zero-width Unicode in `ProfanityFilter.redact` and `sanitizeDisplayName`** — one method change, prevents the display-name spoofing path noted in the security audit.
3. **Gate `DevAuthProvider` registration on `BX_ENV=dev`** — three-line change in `BombServerApplication.main`; the security audit's F-6 fix.
4. **Implement real OIDC verification in `GoogleAuthProvider`** — the only TODO in the codebase. Largest single piece of work; pre-prod blocker.
5. **Extract a `RenderConfig` companion class in `bomb-client`** — small, mirrors what `GameConfig` does for simulation tuning.
6. **Add a `WireCodecTest` round-trip case per DTO record** — confirms no Jackson-specific annotation creeps into `bomb-core` over time.
7. **Migrate Dockerfile base image pins to digest pins managed by Dependabot** — long-term maintenance hygiene.
8. **File ADR-007 for the OIDC verifier work** — closes the only TODO loop.

Items 1-4 are the must-haves for a public beta. Items 5-8 are clean-up for the V1.5 sprint.
