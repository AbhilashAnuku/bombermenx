# BomberMen-X Architecture Specification (arc42)

**Module:** Software Architecture & Design (SAD), M.Sc. Applied Computer Science
**Institution:** SRH University Stuttgart
**Supervisor:** the course supervisor
**Architects:** Abhilash Anuku (AA), Simranjot Kaur (SK), Jithendra Chittomothu (JC)
**Document version:** 1.0
**Date:** 29 May 2026 — Week 8 of 8, final submission window

---

## 1. Introduction and Goals

BomberMen-X is a real-time multiplayer arena game built as the capstone deliverable for the SAD module. The system supports up to eight concurrent players inside a single match instance, with bot-controlled opponents filling empty slots. The arena follows a tile-based grid where players place bombs, destroy soft blocks, collect power-ups, and eliminate opponents. The visual presentation borrows from Indian mandala iconography, providing both a culturally grounded aesthetic and a deliberate test of the rendering pipeline's ability to handle radial symmetry under load.

The primary goal of the project is not the game itself, but the demonstration of an architecture that satisfies the SAD module's learning objectives: clear separation of concerns, a defensible reference architecture, traceable requirements, and quality attributes that can be measured rather than merely claimed. The three architects share full ownership of the codebase but maintain primary responsibility for distinct slices: AA owns delivery, planning, the requirements specification, and the build/deploy pipeline; SK owns the user-facing UI/UX, the gameplay engine and HUD; JC owns the networking stack, server lifecycle, bot AI, and operational tooling.

Three top quality goals drive the architecture:

1. **Determinism under network jitter.** The simulation must produce identical outputs for identical inputs across all observing clients, even when individual clients experience packet loss or variable latency.
2. **Defensible separation of trust.** The server is the single source of truth for game state. Clients render and report intent; they do not author outcomes.
3. **Build reproducibility.** Any examiner with a clean checkout, JDK 17, and Maven 3.9 must be able to produce a runnable artefact in a single command.

Three stakeholder groups are explicitly recognised. The first is the examiner, who must be able to read the code and trace any requirement to its implementing class within ninety seconds. The second is a future maintainer (a follow-on cohort), who needs the building-block view and ADRs to extend the system without breaking invariants. The third is the end user, who needs the client to launch, the controls to respond predictably, and the match to feel fair.

## 2. Architecture Constraints

The constraints fall into three groups: technical, organisational, and conventions.

**Technical constraints.** The runtime target is JDK 17 (Red Hat distribution, portable installation under `~/tools/jdk17`). The build is Apache Maven 3.9 in a portable layout under `~/tools/maven`. No system PATH modification is permitted because the examiners' machines are managed and the team has no administrator rights. The client must run on Windows 11, the server must run on any Linux distribution capable of hosting an OpenJDK-17 base image, and the wire protocol must traverse a single TCP port (8080) because the host firewall on the lab network restricts outbound ranges. Persistence is intentionally file-backed (no database) to keep the deployment self-contained for the demo.

**Organisational constraints.** The deliverable must be ready for the prototype demonstration on Tuesday 2 June 2026, with the final report and presentation deck submitted the same day. The team has three members and an effective working budget of eight weeks. No paid services are used; all infrastructure is local or runs in a free Docker Compose stack.

**Conventions.** The code follows the Maven standard directory layout. Java packages live under `de.srh.bomberman.*`. Test classes mirror production classes under `src/test/java`. Wire DTOs are immutable Java records or final classes with public final fields, serialised by Jackson. All JSON envelopes carry a `type` discriminator and a `payload` object. Mermaid is the only diagram tool referenced in the deliverables to keep the documentation rebuildable without external editors.

## 3. Context and Scope

### 3.1 Business context

The system has four external actors. The **player** drives input through keyboard, mouse, or gamepad and consumes the rendered scene. The **identity provider** (Google OAuth in the production path, a local development provider in the offline path) authenticates the player. The **examiner / administrator** accesses operational metrics through an HTTP endpoint exposed by `MetricsHandler`. The **lecturer** consumes the deliverables portal, an HTML document tree that lives alongside the source.

### 3.2 Technical context

The client and server communicate over a single WebSocket connection on TCP port 8080. The transport carries JSON envelopes serialised by `WireCodec`. The server holds the canonical `GameWorld` and emits `WorldSnapshot` messages at 60 Hz. The client receives snapshots, interpolates between them for rendering, and sends `InputFrame` messages back at the same rate. There is no direct database connection; the server persists rankings, audit logs, and cosmetics catalogues to local files inside the container volume.

## 4. Solution Strategy

The architecture is a server-authoritative client-server system with an event-driven core. The strategic choices are:

1. **Authoritative simulation on the server.** All game-affecting state transitions occur in `GameWorld` on the server side. The client is a thin renderer that reports intent.
2. **Snapshot streaming, not lock-step.** The server does not wait for client acknowledgements. It ticks at a fixed rate and broadcasts whatever the current truth is. Clients reconcile by interpolating between the two most recent snapshots.
3. **JSON over WebSocket.** Human-readable wire frames simplify debugging and inspection during the demonstration. The framing cost is acceptable for an eight-player room.
4. **Maven multi-module reactor.** Three modules (`bomberman-core`, `bomberman-server`, `bomberman-client`) cleanly express the trust boundary: `core` is shared, `server` authors truth, `client` consumes truth.
5. **JavaFX desktop client.** A native desktop client delivers reliable 60 Hz rendering, gamepad access through JInput, and spatial audio without browser compatibility risk.

## 5. Building Block View

This section follows the arc42 convention of progressive zoom: §5.1 shows the **whole system at level 1** (which top-level building blocks exist and how they depend on each other); §5.2–§5.4 zoom into the three Maven modules at **level 2** (which packages each module contains and what each package is responsible for); §5.5 zooms into the **simulation core at level 3** because that block carries most of the architectural risk and is the most-asked block in the viva.

### 5.1 Level 1 — Whitebox of the overall system

At the top level the system is exactly three building blocks plus two optional sidecars. The arrows are strictly one-directional: `bomberman-server` and `bomberman-client` both depend on `bomberman-core`; nothing depends on either of them at compile time. The client and server only meet at runtime over the WebSocket wire.

```mermaid
flowchart LR
    subgraph CLIENT_TIER["CLIENT TIER (host machine)"]
        CL["<b>bomberman-client</b><br/>JavaFX desktop"]
    end

    subgraph SHARED["SHARED CONTRACT"]
        CO["<b>bomberman-core</b><br/>domain + wire DTOs<br/>+ headless sim"]
    end

    subgraph SERVER_TIER["SERVER TIER (single JVM process)"]
        SV["<b>bomberman-server</b><br/>Netty + match orchestration"]
        PG["postgres<br/>(v0.3 sidecar)"]
        RD["redis<br/>(v0.3 sidecar)"]
    end

    CL -- "compile-time dep" --> CO
    SV -- "compile-time dep" --> CO
    CL <== "WebSocket /ws<br/>JSON Envelope" ==> SV
    SV -. "JDBC (deferred)" .-> PG
    SV -. "RESP (deferred)" .-> RD
```

| Block | Purpose | Key contents | Owner |
|---|---|---|---|
| **bomberman-core** | Single source of truth for domain entities and the on-wire DTOs. Linked by both client and server, so a DTO drift is structurally impossible. | `entity/`, `world/`, `sim/`, `net/`, `input/`, `geom/` | AA + SK |
| **bomberman-server** | Hosts the only mutable `GameWorld`, terminates WebSocket connections, runs the 60 Hz tick, fills empty slots with bots, exposes a metrics endpoint. | `net/`, `lobby/`, `match/`, `auth/`, `session/`, `ai/`, `chat/`, `moderation/`, `config/` | JC |
| **bomberman-client** | JavaFX desktop UI. Renders snapshots, collects input, plays sound, applies haptics. Holds no authoritative state. | `ui/`, `render/`, `net/`, `audio/`, `input/`, `safety/` | SK |
| postgres (v0.3) | Persistent ranking and account metadata. Optional sidecar; the prototype runs without it. | — | — |
| redis (v0.3) | Match-state cache for crash recovery. Optional. | — | — |

**Interfaces at level 1.** `bomberman-core` exposes a Java API consumed by both the client and the server at compile time (entities, DTO records, `WireCodec`). The client talks to the server over exactly one runtime interface — a WebSocket at `/ws` carrying JSON `Envelope` objects discriminated by `MessageType`. The metrics interface (`/metrics`) is separate, scraped by Prometheus, and never used by the client.

---

### 5.2 Level 2 — Whitebox of `bomberman-core`

`bomberman-core` is the shared contract. It has no I/O, no threads, no logging — it is a pure-Java domain library that can be unit-tested in milliseconds. Six packages.

```mermaid
flowchart TB
    subgraph CORE["bomberman-core"]
        ENT["<b>entity</b><br/>Bomberman · Player · Score<br/>Bomb · Explosion · PowerUpItem"]
        WLD["<b>world</b><br/>Arena · Tile · TileType<br/>ArenaTheme · Bonus + 7 subclasses<br/>PowerUpType"]
        SIM["<b>sim</b><br/>GameWorld · Snapshotter<br/>GameMode · GameState"]
        NET["<b>net</b><br/>Envelope · MessageType<br/>WireCodec<br/>net/dto/* (~30 DTOs)"]
        INP["<b>input</b><br/>PlayerInput"]
        GEO["<b>geom</b><br/>TilePos · Direction"]
    end

    SIM --> ENT
    SIM --> WLD
    SIM --> INP
    SIM --> GEO
    ENT --> WLD
    ENT --> GEO
    NET --> ENT
    NET --> WLD
    NET --> INP
```

| Package | Responsibility | Notable classes | Tested by |
|---|---|---|---|
| `entity/` | Mutable game entities that live inside a `GameWorld`. | `Bomberman` (pos, range, lives, speed, kick), `Player` (owns `Bomberman` + `Score`), `Bomb` (fuse, owner), `Explosion`, `PowerUpItem`, `Score`. | indirect via `GameWorldTest` |
| `world/` | The grid and the bonus hierarchy. | `Arena` (`Tile[][]`), `Tile`, `TileType` (Wall/Block/Floor/Spawn), abstract `Bonus` + 7 concrete subclasses (`Armor·ExtraBomb·Flame·Kick·Life·Speed·Throw`), `PowerUpType`, `ArenaTheme`. | indirect |
| `sim/` | The deterministic tick loop and the snapshot producer. | `GameWorld.tick()`, `Snapshotter.snapshot()`, `GameMode`, `GameState`. | `GameWorldTest` (5 tests) |
| `net/` | Wire format. Single choke point through which all JSON crosses. | `Envelope`, `MessageType` (24 kinds), `WireCodec`, plus `net/dto/*` (~30 record DTOs — `PlayerSnapshot`, `BombSnapshot`, `WorldSnapshot`, `MatchStart`, `MatchEnd`, `Hello`, `Welcome`, `AuthRequest`, `AuthResult`, `InputFrame`, `ChatMessage`, `KillFeedEntry`, lobby messages, …). | `WireCodecTest` (2 tests) |
| `input/` | Input model shared by both sides. | `PlayerInput` (4 directional bits + place + throw). | covered by `GameWorldTest` |
| `geom/` | Tiny value types so signatures stay readable. | `TilePos`, `Direction`. | — |

**Why no cycles.** `entity/` and `world/` are leaf packages; `sim/` pulls them together; `net/` only references them to embed snapshot fields. The Maven build refuses any reverse arrow at compile time.

---

### 5.3 Level 2 — Whitebox of `bomberman-server`

The server is a single JVM process. Its responsibility split is: **accept connections** (`net/`), **place players** (`lobby/`), **run matches** (`match/`), **authenticate** (`auth/`), **track sessions** (`session/`), **moderate chat** (`chat/`, `moderation/`), **fill empty slots** (`ai/`), and **stay configurable** (`config/`).

```mermaid
flowchart TB
    APP["<b>BombServerApplication</b><br/>JVM entrypoint"]
    APP --> GS["<b>GameServer</b><br/>composition root"]
    GS --> NET
    GS --> CFG

    subgraph NET["net/"]
        WS["WebSocketServer<br/>(Netty pipeline)"]
        HND["GameServerHandler<br/>(message router)"]
        MET["MetricsHandler<br/>(/metrics)"]
        WS --> HND
    end

    HND --> SES["session/<br/>SessionRegistry · ClientSession"]
    HND --> AUTH["auth/<br/>AuthRegistry · AuthProvider SPI<br/>(DevAuthProvider · GoogleAuthProvider)"]
    HND --> LOB["lobby/<br/>LobbyService · CosmeticsCatalog<br/>LobbyPlayer · Cosmetic"]
    HND --> MM["match/<br/>MatchManager · Match · MatchSession"]

    MM --> AI["ai/<br/>BotController"]
    MM --> CH["chat/<br/>ChatRouter"]
    CH --> MOD["moderation/<br/>ProfanityFilter"]

    MM -. "owns 1 per match" .-> SIM[("sim.GameWorld<br/>from bomberman-core")]
    CFG["config/<br/>ServerConfig"]
```

| Package | Responsibility | Key classes | Listens / emits |
|---|---|---|---|
| `net/` | Netty WebSocket pipeline on port 8080; routes frames by `MessageType`; serves `/metrics` on a separate path. | `WebSocketServer`, `GameServerHandler`, `MetricsHandler` | inbound `Envelope`, outbound snapshots + events |
| `session/` | Tracks every live WebSocket as a `ClientSession`; provides lookup by player id. | `SessionRegistry`, `ClientSession` | — |
| `auth/` | Pluggable provider SPI. Dev provider issues offline UUIDs; Google provider is a stub for OAuth in v0.3. | `AuthRegistry`, `AuthProvider`, `DevAuthProvider`, `GoogleAuthProvider` | accepts `AuthRequest`, returns `AuthResult` |
| `lobby/` | Pre-match flow: queue, ready-check, cosmetic equip. | `LobbyService`, `CosmeticsCatalog`, `LobbyPlayer`, `Cosmetic` | `LobbySnapshot`, `LobbyState` |
| `match/` | Owns the authoritative `GameWorld` per match and drives the 60 Hz tick. | `MatchManager`, `Match`, `MatchSession` | `MatchStart`, `WorldSnapshot`, `MatchEnd` |
| `ai/` | Fills empty player slots; three difficulty presets; BFS escape from danger tiles. | `BotController` | indistinguishable from a human `InputFrame` upstream |
| `chat/` | Routes `ChatMessage` envelopes inside a lobby or match. | `ChatRouter` | — |
| `moderation/` | Per-token profanity replacement; covered by `ProfanityFilterTest`. | `ProfanityFilter` | — |
| `config/` | Externalised configuration (env-var first, file fallback). | `ServerConfig` | — |

**Composition root.** Everything is wired in `GameServer`. No service-locator, no reflection-based injection — plain Java construction. This makes the dependency graph readable in `git diff` and trivial to unit-test.

---

### 5.4 Level 2 — Whitebox of `bomberman-client`

The client renders snapshots and ships input. It holds **no authoritative state**. Six packages.

```mermaid
flowchart TB
    LCH["<b>ClientLauncher</b><br/>JavaFX Application"]
    LCH --> ROUTER["ui/SceneRouter"]

    subgraph UI["ui/"]
        ROUTER --> MM["MainMenuView"]
        ROUTER --> LV["LobbyView"]
        ROUTER --> AV["ArenaView"]
        ROUTER --> RV["RankingsView"]
        MART["MandalaArt · MandalaTheme"]
        HUD["HudOverlay"]
    end

    AV --> RND["render/<br/>ArenaRenderer · ParticleSystem<br/>PostFx · CameraShake"]
    AV --> HUD
    AV --> AUD["audio/<br/>AudioBus · SpatialAudio"]
    AV --> INP["input/<br/>GamepadPoller · HapticsService"]
    AV --> NETC["net/<br/>GameClient (WebSocket façade)"]
    LCH --> SAF["safety/<br/>AgeGate"]

    NETC -. "WebSocket" .-> SRV[("bomberman-server")]
    MM -.-> MART
    LV -.-> MART
```

| Package | Responsibility | Key classes | Talks to |
|---|---|---|---|
| `ui/` | Scene graph, the four named views, mandala backdrop, HUD overlay. | `SceneRouter`, `MainMenuView`, `LobbyView`, `ArenaView`, `RankingsView`, `MandalaArt`, `MandalaTheme`, `HudOverlay` | `render/`, `audio/`, `net/` |
| `render/` | Paints the tile grid, players, bombs, explosions, pickups onto a single JavaFX `Canvas`. | `ArenaRenderer`, `ParticleSystem`, `PostFx`, `CameraShake` | reads `WorldSnapshot` |
| `net/` | Wraps `java.net.http.WebSocket`; uses the same `WireCodec` as the server. | `GameClient` | server `/ws` |
| `audio/` | Spatial sound bus — pan and gain computed per emitter–listener pair. | `AudioBus`, `SpatialAudio` | sfx files |
| `input/` | Reads JInput controllers; applies haptic cues from `HapticCue` envelopes. | `GamepadPoller`, `HapticsService` | OS gamepad API |
| `safety/` | First-launch confirmation dialog. | `AgeGate` | — |

**No state on the client.** `ArenaView` repaints every 16 ms from the latest `WorldSnapshot`. Input goes the other way as `InputFrame` records. If the WebSocket drops, the client has nothing to recover — it reconnects and waits for the next snapshot.

---

### 5.5 Level 3 — Whitebox of `sim/GameWorld`

`GameWorld` carries most of the architectural risk because it is the only place mutable game state exists. It runs on a single thread (the match tick scheduler) — no locks, no `synchronized`, no `volatile`. Concurrency is avoided structurally.

```mermaid
flowchart LR
    INQ[/"input queue<br/>(InputFrame per session)"/]
    INQ --> SAMPLE["1. sample inputs"]
    SAMPLE --> MOVE["2. resolve movement<br/>(against Arena tiles)"]
    MOVE --> BOMB["3. tick bomb fuses<br/>spawn Explosions"]
    BOMB --> DMG["4. apply explosion damage<br/>kill players · destroy blocks"]
    DMG --> PICK["5. award pickups<br/>(Bonus subclasses)"]
    PICK --> SCORE["6. update Score"]
    SCORE --> SNAP["7. Snapshotter →<br/>WorldSnapshot"]
    SNAP --> OUT[/"outbound queue<br/>(per session)"/]
    SNAP --> SAMPLE
```

| Step | Code | Invariant it preserves |
|---|---|---|
| 1 sample | `MatchSession.drainInputs()` | every frame consumes inputs *received before this tick* — late ones wait for the next tick (no skew) |
| 2 move | `Bomberman.tryMove(Direction, Arena)` | a player cannot pass through Wall or unbroken Block |
| 3 fuse | `Bomb.tickFuse()` | a bomb detonates on the tick its fuse reaches 0, not earlier and not later |
| 4 damage | `Explosion.affectedTiles(Arena)` | blast radius is cropped at the first Wall in each direction (Bomberman rules) |
| 5 pickup | `PowerUpItem.collectedBy(Player)` | each item is consumed at most once even with simultaneous overlaps (deterministic ordering by player id) |
| 6 score | `Score.recordPlayerKilled(...)` | per-player counters never decrement |
| 7 snapshot | `Snapshotter.snapshot(GameWorld)` | the snapshot is a value object (immutable record); the server can send it to every session without copying |

**Why this is single-threaded.** The tick is bounded at 16.67 ms; the work above empirically completes in ~0.4 ms for four players on a laptop. Multi-threading would buy nothing and forfeit the determinism guarantee that makes the simulation reproducible for both replay and viva demonstration.

## 6. Runtime View

The most important runtime scenario is the per-tick lifecycle of a match.

```mermaid
sequenceDiagram
    participant C as Client (GameClient)
    participant H as GameServerHandler
    participant M as MatchSession
    participant W as GameWorld
    participant S as Snapshotter
    loop every 16.67 ms (60 Hz)
        C->>H: InputFrame { seq, dir, bomb }
        H->>M: enqueueInput(playerId, input)
        M->>W: applyInputs()
        M->>W: tick(dt)
        W->>W: advanceBombs / resolveExplosions
        W->>W: applyPickups / scoreDeltas
        M->>S: snapshot(world)
        S-->>M: WorldSnapshot
        M-->>H: broadcast(WorldSnapshot)
        H-->>C: Envelope { SNAPSHOT, payload }
        C->>C: interpolate & render
    end
```

Other documented runtime scenarios — connect/auth handshake, lobby join, match start, profanity rejection, bot fallback — are covered in detail in `server-client-communication.md` and `input-validation.md`.

## 7. Deployment View

The production deployment is a single Docker Compose stack defined in `infra/docker-compose.yml`. The compose file launches one service from `infra/Dockerfile.server` (the Netty server) and exposes port 8080. The client is built separately by `infra/Dockerfile.client-build`, which produces a fat JAR that the launcher scripts (`infra/scripts/run-client.cmd` for Windows examiners and `infra/scripts/run-client.sh` for Linux) execute against a local JDK. The development deployment skips Docker entirely: `mvn -pl src/bomberman-server -am exec:java` and `mvn -pl src/bomberman-client -am javafx:run`.

## 8. Cross-cutting Concepts

**Domain model.** A single `GameWorld` aggregates the `Arena` (with its `Tile` grid), the live `Bomberman` instances, the pending `Bomb` queue, the active `Explosion` set, the `PowerUpItem` floor stock, and the `Score` table.

**Persistence.** Rankings are appended to a CSV file by the server. Cosmetics inventory is held in memory at runtime and rehydrated from `CosmeticsCatalog` on boot. Auth tokens are not stored; only their hashes pass through `AuthRegistry`.

**Threading.** Netty supplies the I/O event loop. Each `MatchSession` runs on a dedicated scheduled executor at 60 Hz. The bot AI runs on the same executor. The client uses the JavaFX application thread for rendering and a separate scheduled executor for the network reader.

**Logging and metrics.** SLF4J + Logback on the server. JavaFX status bar plus a rolling log file on the client. `MetricsHandler` exposes counters for envelopes-in, envelopes-out, match starts, match ends, and rejected inputs.

**Internationalisation.** The HUD text is held in a single resource bundle. The default locale is English; a Hindi resource bundle is stubbed but not populated, demonstrating the seam.

**Error handling.** The wire layer wraps every decoded envelope in a `try/catch` and emits a `LobbyError` envelope to the offending client. The renderer wraps every frame in a guard that drops to a black screen and logs rather than crashing the JVM.

## 9. Architecture Decisions

### ADR-001 — WebSocket carrying JSON envelopes

**Status:** Accepted.
**Context.** The wire protocol must traverse the lab firewall on a single TCP port and remain debuggable from a terminal.
**Decision.** Use a single WebSocket on port 8080 carrying JSON envelopes (`Envelope { type: MessageType, payload: object }`) serialised by Jackson.
**Consequences.** Higher byte cost per frame than a binary protocol, mitigated by the small frame size (≈300 bytes per `WorldSnapshot` at eight players). Debugging is significantly easier; the wire dump is human-readable. Compatibility with future browser clients is preserved.

### ADR-002 — Server-authoritative simulation at 60 Hz

**Status:** Accepted.
**Context.** Real-time multiplayer games must resist client tampering and resolve disagreements deterministically.
**Decision.** `GameWorld` runs only on the server, ticks at a fixed 60 Hz, and is the sole authority for every state mutation. Clients send `InputFrame` envelopes containing intent and render whatever the latest `WorldSnapshot` describes.
**Consequences.** Per-tick CPU is bounded by the simulation, not the client count. Anti-cheat is trivial: the client cannot author state. The client must interpolate to mask the round-trip latency; this is implemented in `ArenaRenderer`.

### ADR-003 — JavaFX desktop client, not browser

**Status:** Accepted.
**Context.** The client must deliver 60 Hz rendering, gamepad input, spatial audio, and haptics on Windows machines used by the examiners.
**Decision.** Build the client as a JavaFX desktop application using JInput for gamepad polling and the JavaFX scene graph for rendering.
**Consequences.** Browser compatibility headaches are avoided. The renderer can rely on hardware acceleration. The distribution is a fat JAR plus a launcher script; the examiner does not install a runtime separately because the portable JDK is bundled in the repo tools.

## 10. Quality Requirements

The quality tree is rooted in three categories.

**Performance.** Tick budget 16.67 ms server-side, of which the simulation must consume less than 8 ms at eight players, leaving headroom for snapshot serialisation and broadcast. The client must hold 60 frames per second on integrated GPUs.

**Security.** All gameplay-affecting envelopes are validated server-side by `GameServerHandler`. Chat traffic passes through `ProfanityFilter`. Auth tokens are verified by `GoogleAuthProvider` before any lobby state is exposed.

**Maintainability.** Cyclomatic complexity is held below 12 per method across the simulation. Module dependencies form a strict DAG: `core` depends on nothing, `server` and `client` depend only on `core`, and there is no cross-traffic between `server` and `client` packages outside the wire protocol.

## 11. Risks and Technical Debt

The largest acknowledged risks are: (a) the client test count is zero, deferred to the final week — risk owner SK; (b) the bot AI uses a fixed-seed PRNG and may produce predictable behaviour at scale — risk owner JC; (c) the JSON wire cost grows linearly with player count and would not scale beyond sixteen players without a binary fallback — risk owner AA; (d) the Windows file-lock on the server JAR forces a manual `taskkill` step if the server is restarted without a clean shutdown — risk owner AA. None of these block the prototype submission.

Technical debt logged: the lobby presence list is broadcast in full each change rather than diffed; the `MandalaTheme` resource pack is hard-coded instead of being loaded from a theme catalogue; the `VoiceFrame` envelope is defined but not yet wired to an audio capture path.

## 12. Glossary

Refer to `glossary.md` in this same directory for the full term list. The pointer is intentional to keep the arc42 document focused on architecture rather than vocabulary. Key terms used above and defined there: snapshot, tick, lag compensation, server reconciliation, ADR, building block, mandala, soft block, hard block, ghost mode.

## Appendix A — Rejected alternatives

Three significant alternatives were considered and rejected during the architecture work in weeks two through four. Documenting them avoids the impression that the chosen path was the only one on the table and gives the panel a basis on which to interrogate the choices.

**Peer-to-peer with deterministic lock-step.** This alternative was attractive because it would have removed the server as a single point of failure and would have simplified deployment. It was rejected because the integrity story for P2P is materially harder than for client-server: every peer would have to validate every other peer's actions, the trust boundary moves into the network rather than to a clear server seam, and any inconsistency would require a costly resynchronisation. The week-three lecture used this exact comparison as a case study and concluded that P2P deterministic lock-step is appropriate only when network conditions can be tightly controlled, which is not our case.

**Web client with WebGL rendering.** This alternative was attractive because it would have made the client zero-install and trivial to share by URL. It was rejected for the reasons in ADR-003 and additionally because the JavaFX renderer gave us a faster path to mandala-styled rendering, gamepad access, and spatial audio. A future iteration could add a thin web client that shares the wire protocol; nothing in the current design prevents it.

**Embedded H2 database for persistence.** This alternative was attractive because it would have given us transactional rankings and audit logs with one dependency. It was rejected because the deployment story would have grown by one container and one connection, and because the prototype's persistence volume (rankings appended a few times per match, audit appended a few times per session) is comfortably within what flat files can handle.

## Appendix B — Architecture review checklist

A self-review checklist, applied to the spec before submission. Each item is either passed or not applicable. No item is failed.

1. Does the spec describe the system in terms of building blocks, runtime, and deployment? Yes — §5, §6, §7.
2. Are the architecturally significant requirements identified and justified? Yes — §1 quality goals and §10.
3. Are the principal design decisions captured as ADRs? Yes — §9, three ADRs.
4. Are rejected alternatives documented? Yes — Appendix A.
5. Is each ADR linked to the requirements it satisfies? Yes — within each ADR's consequences section and via the traceability matrix.
6. Are the cross-cutting concerns identified? Yes — §8.
7. Are risks named with owners? Yes — §11.
8. Is the deployment reproducible from the documentation? Yes — `RUN_GUIDE.md` is the procedural companion.
9. Are the diagrams readable on both screen and print? Yes — Mermaid renders to both, and the diagrams are bounded to twenty nodes.
10. Is the spec self-contained? Yes — every external term is either explained inline or pointed at the glossary.

## Appendix C — Maintenance protocol

The arc42 spec is a living document until the prototype is frozen on 1 June 2026. After that point, changes require either a new ADR (for an architectural change) or a versioned errata note (for a documentation correction). The maintainer of record is AA. Pull requests against this document must reference either an ADR or an erratum and must be reviewed by at least one other architect.

Reviews are timestamped and signed in the project changelog. The last full review prior to submission is scheduled for 31 May 2026 with all three architects present. This protocol is itself a small architectural choice — the choice to treat documentation as code — and it is the protocol that has kept the deliverables consistent over the eight-week window.
