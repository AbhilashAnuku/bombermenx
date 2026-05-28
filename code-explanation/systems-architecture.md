# Systems Architecture

**Module:** Software Architecture & Design, M.Sc. Applied Computer Science
**Institution:** SRH University Stuttgart
**Supervisor:** Dr. Floriment Klinaku
**Document version:** 1.0
**Date:** 28 May 2026

## Purpose and scope

This document decomposes BomberMen-X into twelve named subsystems, each with explicit ownership, a clear boundary, and a single accountable architect. The decomposition is orthogonal: every Java class in the reactor belongs to exactly one subsystem. The subsystems are larger than packages and smaller than modules; they are the units of design discussion and the units of demonstration during the prototype defence.

The twelve subsystems are: Auth, Lobby, Matchmaking, Simulation, Snapshot, Chat, Bot AI, Render, Audio, Input, Persistence, and Operations. Eleven of them have a primary code presence in either the server or the client; one (Simulation) lives entirely in the shared `bomberman-core` module because both sides need to reason about the same domain types.

## Ownership matrix

| Subsystem      | Primary owner | Secondary review | Modules touched                                    | Risk class |
|----------------|---------------|------------------|----------------------------------------------------|------------|
| Auth           | JC            | AA               | bomberman-server                                   | High       |
| Lobby          | JC            | SK               | bomberman-server, bomberman-core                   | Medium     |
| Matchmaking    | JC            | AA               | bomberman-server, bomberman-core                   | Medium     |
| Simulation     | SK            | AA               | bomberman-core                                     | High       |
| Snapshot       | AA            | JC               | bomberman-core                                     | Medium     |
| Chat           | JC            | SK               | bomberman-server                                   | Low        |
| Bot AI         | JC            | SK               | bomberman-server                                   | Medium     |
| Render         | SK            | AA               | bomberman-client                                   | Medium     |
| Audio          | SK            | JC               | bomberman-client                                   | Low        |
| Input          | SK            | JC               | bomberman-client, bomberman-core                   | Medium     |
| Persistence    | AA            | JC               | bomberman-server                                   | Low        |
| Operations     | AA            | JC               | bomberman-server, infra                            | Medium     |

Risk class reflects the combination of cyclomatic complexity, test coverage, and impact of failure. High-risk subsystems are the focus of the defence demo and receive the most rigorous review.

## 1. Auth subsystem (JC)

The Auth subsystem authenticates a player before any other envelope is accepted. It consists of `AuthProvider` (an interface), `AuthRegistry` (the factory that selects an active provider), `DevAuthProvider` (a passthrough used in offline development and CI), and `GoogleAuthProvider` (the production OAuth path). The subsystem is invoked from `GameServerHandler` upon receipt of an `AuthRequest` envelope and emits an `AuthResult` back to the sender. A failed authentication closes the channel after a 200 ms grace period to discourage brute-force token guessing. The Auth subsystem holds no in-memory user records; identities flow through and the only persistent artefact is a hashed audit log written by Persistence.

## 2. Lobby subsystem (JC)

The Lobby subsystem owns the pre-match space where players gather, customise their avatars, and trigger matches. Its core types are `LobbyService` (the orchestrator), `LobbyPlayer` (the in-memory presence record), `Cosmetic` (an immutable cosmetic record), and `CosmeticsCatalog` (the runtime inventory). On the wire it speaks `LobbyHello`, `LobbyWelcome`, `LobbyState`, `LobbyMove`, `LobbyBuy`, `LobbyEquip`, `LobbySnapshot`, and `LobbyError` envelopes plus the `LobbyPlayerEntry` record used inside `LobbyState`. The lobby is intentionally simple: a flat list of presences, broadcast in full on any change. The decision to skip a diff protocol is documented in the technical-debt section of the arc42 spec; for an eight-player room the full-broadcast cost is negligible.

## 3. Matchmaking subsystem (JC)

The Matchmaking subsystem provisions and tears down match instances. `MatchManager` is a singleton on the server that holds the currently active `MatchSession` instances, each wrapping a `Match` (a metadata record: id, start time, mode, slot list) and an internal `GameWorld` (owned by the Simulation subsystem). The session schedules itself on a dedicated executor at 60 Hz, applies queued inputs, ticks the world, asks the Snapshot subsystem for a frame, and broadcasts. On match end the session emits a `MatchEnd` envelope, persists the result through the Persistence subsystem, and releases the executor.

## 4. Simulation subsystem (SK)

The Simulation subsystem is the heart of the application. It lives entirely in `bomberman-core` because the wire DTOs and the simulation domain must share a single set of types between client and server. The principal classes are `GameWorld` (the tick driver), `Arena` (the immutable layout), `Tile` (block type and pickup state), `Bomberman` (a live player avatar), `Player` (the persistent player identity), `Bomb` (a live ordnance), `Explosion` (a live blast), `PowerUpItem` (a floor pickup), `Score` (the per-player accumulator), and the `Bonus` hierarchy (`ArmorBonus`, `ExtraBombBonus`, `FlameBonus`, `KickBonus`, `LifeBonus`, `SpeedBonus`, `ThrowBonus`). The subsystem is deterministic: given the same starting state and the same ordered input queue, it produces the same end state on any JVM. This determinism is what allows the Snapshot subsystem to broadcast diff-free frames without race conditions.

## 5. Snapshot subsystem (AA)

The Snapshot subsystem converts the live `GameWorld` into a flat, wire-friendly `WorldSnapshot`. Its principal classes are `Snapshotter` (the projection function), `WorldSnapshot`, `PlayerSnapshot`, `BombSnapshot`, `ExplosionSnapshot`, and `PickupSnapshot`. `Envelope`, `MessageType`, and `WireCodec` form the transport. The subsystem owes its existence to a single design pressure: the simulation classes carry behaviour and references to internal objects that should not cross the wire; the snapshot classes carry only data and primitive types. The separation makes the wire format auditable independently of the simulation and lets the wire be evolved without touching the domain.

## 6. Chat subsystem (JC)

The Chat subsystem routes `ChatMessage` envelopes between sessions and applies moderation. `ChatRouter` is the entry point, `ProfanityFilter` is the moderation engine. The router enforces a two-message-per-second rate limit and a 256-character length cap. Messages that fail the filter return a `LobbyError` to the sender; messages that pass are broadcast to the channel (lobby-wide or match-wide depending on the sender's state). Voice support is stubbed by the `VoiceFrame` envelope but not yet wired.

## 7. Bot AI subsystem (JC)

The Bot AI subsystem provides controlled opponents when fewer than eight humans occupy a match, and substitutes for any human player who disconnects mid-match. `BotController` is the single class. It owns one fixed-seed `java.util.Random` per bot, ticks at the same 60 Hz as the simulation, and reads the current `WorldSnapshot` to decide its next `PlayerInput`. The bot does not see the live `GameWorld` directly; this discipline keeps the bot honest — it has the same information a human client has — and makes the subsystem testable by replaying recorded snapshots.

## 8. Render subsystem (SK)

The Render subsystem draws the arena and the HUD. Its principal classes are `ArenaView` (the scene container), `ArenaRenderer` (the tile and sprite drawer), `ParticleSystem` (the explosion particle emitter), `PostFx` (the bloom and vignette filter), `CameraShake` (the screen-shake controller), `HudOverlay` (the lives/score/power-up panel), `MainMenuView`, `LobbyView`, `RankingsView`, `MandalaArt` (the symmetrical motif drawer), and `MandalaTheme` (the colour palette). `SceneRouter` switches between views. The Render subsystem is the largest in line count but the lowest in cyclomatic complexity; most of the volume is data tables for tile sprites and HUD elements.

## 9. Audio subsystem (SK)

The Audio subsystem plays sound effects and music. `AudioBus` is the mixer. `SpatialAudio` applies stereo panning based on the listening player's position relative to the sound source. The subsystem is consumed by the Render subsystem (which triggers most sounds in lockstep with visual effects) and by the Input subsystem (which plays input-acknowledgement cues). The Audio subsystem is intentionally fire-and-forget: missed audio frames degrade gracefully without affecting gameplay.

## 10. Input subsystem (SK)

The Input subsystem captures user intent and converts it into wire envelopes. `GamepadPoller` polls JInput-bound controllers; the JavaFX scene supplies keyboard and mouse input directly. The captured intent becomes a `PlayerInput` instance, which is wrapped in an `InputFrame` (with a monotonic sequence number) and sent through `GameClient`. `HapticsService` consumes `HapticCue` envelopes from the server and applies rumble. The Input subsystem on the server side is the validation layer in `GameServerHandler` — this is documented at length in `input-validation.md`.

## 11. Persistence subsystem (AA)

The Persistence subsystem writes results and audit data to local files. The deliberate choice to avoid a database keeps the deployment self-contained for the prototype and removes the need to run a separate container. Rankings are appended to a CSV file. The auth audit log is appended to a JSON-lines file. The cosmetics inventory is rehydrated from a JSON file at boot through `CosmeticsCatalog`. The subsystem has no Java class of its own beyond the catalogue; it is a discipline followed by `ServerConfig` and the writers embedded in `MatchManager` and `AuthRegistry`. A future iteration would extract it into a `PersistenceService` interface.

## 12. Operations subsystem (AA)

The Operations subsystem covers the boot path, the configuration, and the observability surface. `BombServerApplication` is the entry point. `ServerConfig` holds externalised configuration (port, executor sizes, file paths). `MetricsHandler` exposes counters over an HTTP endpoint on a separate port for examiner inspection. The infrastructure files (`infra/Dockerfile.server`, `infra/Dockerfile.client-build`, `infra/docker-compose.yml`, `infra/scripts/*`) are part of this subsystem; they are not Java but they are part of the operational story and are reviewed under the same ownership.

## Cross-subsystem invariants

Three invariants are maintained across the subsystems and are checked during the defence demo.

**Invariant A (single source of truth).** No subsystem outside Simulation mutates a `GameWorld`. The compiler does not enforce this — `GameWorld` is mutable — but the Snapshot subsystem is the only one that reads it for broadcast, and only the Matchmaking subsystem holds a reference.

**Invariant B (envelope monoculture).** Every byte that crosses the wire is wrapped in an `Envelope`. There is no out-of-band path. This makes message tracing trivial: a single Wireshark capture or a single log line shows every cross-boundary event.

**Invariant C (subsystem closure).** A subsystem's Java types live in a single package tree. A class that needs to live across the boundary is moved into `bomberman-core` and is shared by reference, not duplicated.

## Subsystem dependency graph

The subsystems form a directed graph with no cycles. Auth gates Lobby; Lobby gates Matchmaking; Matchmaking owns Simulation through `MatchSession`; Simulation feeds Snapshot; Snapshot leaves the server; Chat is independent of all the gameplay subsystems and runs in parallel; Bot AI consumes Snapshot to decide intent and writes back to Matchmaking through the same input queue a human would use; Render and Audio read incoming snapshots; Input writes outgoing envelopes; Persistence and Operations are leaves. This shape mirrors a layered architecture with strict dependency direction, which is the architectural style we claim in the SAD theory mapping.

## Closing remark

The twelve-subsystem decomposition is the unit of conversation in stand-ups and the unit of demonstration in the defence. When the examiner asks "where does X live?", the answer is always a subsystem name followed by one or two class names. This is the closest the architecture gets to a teaching artefact: the cost of remembering twelve names is small enough that all three architects, and the examiner, can hold the whole picture in mind at once.
