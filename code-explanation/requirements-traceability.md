# Requirements Traceability Matrix

**Module:** Software Architecture & Design, M.Sc. Applied Computer Science
**Supervisor:** the course supervisor, SRH University Stuttgart
**Author:** Abhilash Anuku (AA), with input from Simranjot Kaur (SK) and Jithendra Chittomothu (JC)
**Date:** 28 May 2026

## Purpose

This document discharges the obligation set out in the SAD module brief that every requirement must be traceable to a code artefact. The matrix below covers the eighty-six functional requirements (FR), the ten non-functional requirements (NFR), the twelve use cases (UC), and the eight business rules (BR) that constitute the requirements baseline. Each row binds one requirement to the Java class that primarily realises it, and to the source path under the Maven reactor at `F:\Bomber Man X\BomberMan-X\src`. Where a requirement is realised by a collaboration of classes, the table cites the orchestrating class and a brief note identifies the collaborators.

The matrix is written for two audiences. The examiner uses it to spot-check that no requirement is silently dropped, and to navigate from a requirement statement to a runnable piece of code in two clicks. The maintainer uses it during change impact analysis: when a requirement is amended, the matrix identifies the classes whose tests must be re-run.

## Reading conventions

Requirement IDs are grouped by feature area. Within a group, the IDs are dense and contiguous; gaps signal that a requirement was withdrawn during the requirements freeze in Week 4 and intentionally not renumbered, because renumbering breaks downstream artefacts (test labels, commit messages, ADR cross-references). The "Class" column names a single Java type. The "File" column gives a path rooted at `src/`, omitting the leading `F:\Bomber Man X\BomberMan-X\` for compactness. The "Owner" column attributes primary maintenance responsibility to AA, SK, or JC; this attribution is not a wall — every architect may modify any file — but it identifies the first reviewer on any pull request.

## Functional requirements

### Auth (FR-01 to FR-05)

The authentication slice authenticates a player before any lobby state is exposed. The reference path goes through `WebSocketServer` (Netty pipeline), `GameServerHandler` (envelope dispatch), and `AuthRegistry` (provider selection).

| ID    | Requirement                                                                | Class                  | File                                                                                | Owner |
|-------|----------------------------------------------------------------------------|------------------------|-------------------------------------------------------------------------------------|-------|
| FR-01 | The server must accept WebSocket upgrade requests on port 8080.            | `WebSocketServer`      | `src/bomberman-server/src/main/java/de/srh/bomberman/server/WebSocketServer.java`   | JC    |
| FR-02 | The server must consume `AuthRequest` envelopes and produce `AuthResult`. | `GameServerHandler`    | `src/bomberman-server/src/main/java/de/srh/bomberman/server/GameServerHandler.java` | JC    |
| FR-03 | The server must support a Google OAuth provider in production.             | `GoogleAuthProvider`   | `src/bomberman-server/src/main/java/de/srh/bomberman/server/auth/GoogleAuthProvider.java` | JC |
| FR-04 | The server must support a development provider that bypasses OAuth.        | `DevAuthProvider`      | `src/bomberman-server/src/main/java/de/srh/bomberman/server/auth/DevAuthProvider.java`    | JC |
| FR-05 | The active provider must be selectable through `AuthRegistry`.             | `AuthRegistry`         | `src/bomberman-server/src/main/java/de/srh/bomberman/server/auth/AuthRegistry.java`       | JC |

### Lobby (FR-10 to FR-18)

The lobby slice manages presence, cosmetic inventory, and the transition to a match.

| ID    | Requirement                                                                | Class                | File                                                                                          | Owner |
|-------|----------------------------------------------------------------------------|----------------------|-----------------------------------------------------------------------------------------------|-------|
| FR-10 | Players join the lobby with a `LobbyHello` envelope.                       | `LobbyService`       | `src/bomberman-server/src/main/java/de/srh/bomberman/server/lobby/LobbyService.java`          | JC    |
| FR-11 | The lobby returns a `LobbyWelcome` envelope on accepted joins.             | `LobbyService`       | same as FR-10                                                                                 | JC    |
| FR-12 | The lobby broadcasts `LobbyState` whenever presence changes.               | `LobbyService`       | same as FR-10                                                                                 | JC    |
| FR-13 | Players may move within the lobby room via `LobbyMove`.                    | `LobbyService`       | same as FR-10                                                                                 | JC    |
| FR-14 | Players may purchase cosmetics via `LobbyBuy`.                             | `CosmeticsCatalog`   | `src/bomberman-server/src/main/java/de/srh/bomberman/server/lobby/CosmeticsCatalog.java`      | SK    |
| FR-15 | Players may equip cosmetics via `LobbyEquip`.                              | `LobbyPlayer`        | `src/bomberman-server/src/main/java/de/srh/bomberman/server/lobby/LobbyPlayer.java`           | SK    |
| FR-16 | The lobby exposes a snapshot of its current state on demand.               | `LobbyService`       | same as FR-10                                                                                 | JC    |
| FR-17 | Errors during lobby operations surface as `LobbyError` envelopes.          | `LobbyService`       | same as FR-10                                                                                 | JC    |
| FR-18 | Cosmetic definitions are immutable runtime records.                        | `Cosmetic`           | `src/bomberman-server/src/main/java/de/srh/bomberman/server/lobby/Cosmetic.java`              | SK    |

### Match (FR-20 to FR-29)

The match slice manages session lifecycle, world simulation, and the broadcast of `WorldSnapshot` envelopes.

| ID    | Requirement                                                                | Class               | File                                                                                       | Owner |
|-------|----------------------------------------------------------------------------|---------------------|--------------------------------------------------------------------------------------------|-------|
| FR-20 | A match is created by `MatchManager` when the lobby triggers start.        | `MatchManager`      | `src/bomberman-server/src/main/java/de/srh/bomberman/server/match/MatchManager.java`       | JC    |
| FR-21 | Each match runs in its own `MatchSession`.                                 | `MatchSession`      | `src/bomberman-server/src/main/java/de/srh/bomberman/server/match/MatchSession.java`       | JC    |
| FR-22 | The session ticks the `GameWorld` at 60 Hz.                                | `MatchSession`      | same as FR-21                                                                              | JC    |
| FR-23 | The session emits `MatchStart` on opening and `MatchEnd` on close.         | `Match`             | `src/bomberman-server/src/main/java/de/srh/bomberman/server/match/Match.java`              | JC    |
| FR-24 | The simulation lives in `GameWorld`.                                       | `GameWorld`         | `src/bomberman-core/src/main/java/de/srh/bomberman/core/sim/GameWorld.java`                | SK    |
| FR-25 | The arena is described by `Arena` and a tile grid.                         | `Arena`             | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Arena.java`                 | SK    |
| FR-26 | Tiles carry block type and pickup state.                                   | `Tile`              | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Tile.java`                  | SK    |
| FR-27 | `Snapshotter` produces a `WorldSnapshot` per tick.                         | `Snapshotter`       | `src/bomberman-core/src/main/java/de/srh/bomberman/core/sim/Snapshotter.java`              | AA    |
| FR-28 | `WorldSnapshot` is a flat DTO of `PlayerSnapshot`, `BombSnapshot`, `ExplosionSnapshot`. | `WorldSnapshot` | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/WorldSnapshot.java` | AA |
| FR-29 | Players can choose a game mode at match creation.                          | `GameMode`          | `src/bomberman-core/src/main/java/de/srh/bomberman/core/input/GameMode.java`               | SK    |

### Bomb and Explosion (FR-30 to FR-38)

The combat slice covers bomb placement, fuse, blast propagation, and chain detonation.

| ID    | Requirement                                                                | Class            | File                                                                                  | Owner |
|-------|----------------------------------------------------------------------------|------------------|---------------------------------------------------------------------------------------|-------|
| FR-30 | A `Bomberman` may place a `Bomb` if their bomb budget allows.              | `Bomberman`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Bomberman.java`        | SK    |
| FR-31 | Bombs have a fixed fuse timer and a blast radius.                          | `Bomb`           | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Bomb.java`             | SK    |
| FR-32 | Explosions propagate along four cardinal directions.                       | `Explosion`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Explosion.java`        | SK    |
| FR-33 | Soft blocks are destroyed by explosions and may drop pickups.              | `Tile`           | same as FR-26                                                                         | SK    |
| FR-34 | Hard blocks halt explosion propagation without being destroyed.            | `Tile`           | same as FR-26                                                                         | SK    |
| FR-35 | A bomb caught in another bomb's blast detonates immediately.               | `GameWorld`      | same as FR-24                                                                         | SK    |
| FR-36 | A player caught in any blast loses a life and respawns or is eliminated.   | `Bomberman`      | same as FR-30                                                                         | SK    |
| FR-37 | Bombs may be kicked one tile per impact when the kick power-up is held.    | `KickBonus`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/KickBonus.java`        | SK    |
| FR-38 | Bombs may be thrown three tiles when the throw power-up is held.           | `ThrowBonus`     | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/ThrowBonus.java`       | SK    |

### Power-ups (FR-40 to FR-45)

| ID    | Requirement                                            | Class             | File                                                                                  | Owner |
|-------|--------------------------------------------------------|-------------------|---------------------------------------------------------------------------------------|-------|
| FR-40 | Flame power-up increases blast radius by one tile.     | `FlameBonus`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/FlameBonus.java`       | SK    |
| FR-41 | ExtraBomb power-up increases bomb budget by one.       | `ExtraBombBonus`  | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/ExtraBombBonus.java`   | SK    |
| FR-42 | Speed power-up increases movement speed by 15 percent. | `SpeedBonus`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/SpeedBonus.java`       | SK    |
| FR-43 | Armor power-up absorbs the next single explosion hit.  | `ArmorBonus`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/ArmorBonus.java`       | SK    |
| FR-44 | Life power-up adds one to the player's life counter.   | `LifeBonus`       | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/LifeBonus.java`        | SK    |
| FR-45 | Power-up items on the floor are described by `PowerUpItem`. | `PowerUpItem` | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/PowerUpItem.java`      | SK    |

### Score and Ranking (FR-50 to FR-55)

| ID    | Requirement                                                                | Class               | File                                                                                  | Owner |
|-------|----------------------------------------------------------------------------|---------------------|---------------------------------------------------------------------------------------|-------|
| FR-50 | Each player carries a `Score` accumulator.                                 | `Score`             | `src/bomberman-core/src/main/java/de/srh/bomberman/core/domain/Score.java`            | SK    |
| FR-51 | A kill awards 100 points; a survival bonus awards 50 points.               | `Score`             | same as FR-50                                                                         | SK    |
| FR-52 | Suicide awards −25 points; environmental death awards 0 points.            | `Score`             | same as FR-50                                                                         | SK    |
| FR-53 | Match results are presented in `RankingsView`.                             | `RankingsView`      | `src/bomberman-client/src/main/java/de/srh/bomberman/client/ui/RankingsView.java`     | SK    |
| FR-54 | The kill feed is broadcast as `KillFeedEntry`.                             | `KillFeedEntry`     | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/KillFeedEntry.java`      | AA    |
| FR-55 | Match conclusion is announced by `MatchEnd`.                               | `MatchEnd`          | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/MatchEnd.java`           | AA    |

### Chat and Moderation (FR-60 to FR-65)

| ID    | Requirement                                                                | Class             | File                                                                                       | Owner |
|-------|----------------------------------------------------------------------------|-------------------|--------------------------------------------------------------------------------------------|-------|
| FR-60 | Players send `ChatMessage` envelopes to the lobby and match channels.      | `ChatRouter`      | `src/bomberman-server/src/main/java/de/srh/bomberman/server/chat/ChatRouter.java`          | JC    |
| FR-61 | Messages are filtered for profanity before broadcast.                      | `ProfanityFilter` | `src/bomberman-server/src/main/java/de/srh/bomberman/server/moderation/ProfanityFilter.java` | JC  |
| FR-62 | Rejected messages return a `LobbyError` to the sender only.                | `ChatRouter`      | same as FR-60                                                                              | JC    |
| FR-63 | Chat is rate-limited to two messages per second per session.               | `ChatRouter`      | same as FR-60                                                                              | JC    |
| FR-64 | Voice frames are defined but not yet wired.                                | `VoiceFrame`      | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/VoiceFrame.java`              | AA    |
| FR-65 | Server-side game events surface as `GameEvent` envelopes.                  | `GameEvent`       | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/GameEvent.java`               | AA    |

### HUD and Render (FR-70 to FR-76)

| ID    | Requirement                                                                | Class             | File                                                                                       | Owner |
|-------|----------------------------------------------------------------------------|-------------------|--------------------------------------------------------------------------------------------|-------|
| FR-70 | The client mounts an arena scene with a tile renderer.                     | `ArenaView`       | `src/bomberman-client/src/main/java/de/srh/bomberman/client/ui/ArenaView.java`             | SK    |
| FR-71 | Tile drawing and sprite composition is performed by `ArenaRenderer`.       | `ArenaRenderer`   | `src/bomberman-client/src/main/java/de/srh/bomberman/client/render/ArenaRenderer.java`     | SK    |
| FR-72 | The HUD shows lives, score, and active power-ups.                          | `HudOverlay`      | `src/bomberman-client/src/main/java/de/srh/bomberman/client/ui/HudOverlay.java`            | SK    |
| FR-73 | Explosions emit particles through `ParticleSystem`.                        | `ParticleSystem`  | `src/bomberman-client/src/main/java/de/srh/bomberman/client/render/ParticleSystem.java`    | SK    |
| FR-74 | The renderer applies bloom and vignette via `PostFx`.                      | `PostFx`          | `src/bomberman-client/src/main/java/de/srh/bomberman/client/render/PostFx.java`            | SK    |
| FR-75 | The camera shakes on nearby blasts via `CameraShake`.                      | `CameraShake`     | `src/bomberman-client/src/main/java/de/srh/bomberman/client/render/CameraShake.java`       | SK    |
| FR-76 | The mandala motif is supplied by `MandalaTheme` and drawn via `MandalaArt`. | `MandalaTheme`   | `src/bomberman-client/src/main/java/de/srh/bomberman/client/ui/MandalaTheme.java`          | SK    |

### Input and Validation (FR-80 to FR-86)

| ID    | Requirement                                                                | Class               | File                                                                                       | Owner |
|-------|----------------------------------------------------------------------------|---------------------|--------------------------------------------------------------------------------------------|-------|
| FR-80 | Gamepads are polled by `GamepadPoller`.                                    | `GamepadPoller`     | `src/bomberman-client/src/main/java/de/srh/bomberman/client/input/GamepadPoller.java`      | SK    |
| FR-81 | The client constructs `PlayerInput` and sends `InputFrame` envelopes.      | `GameClient`        | `src/bomberman-client/src/main/java/de/srh/bomberman/client/net/GameClient.java`           | JC    |
| FR-82 | Inputs are bounds-checked against valid directions.                        | `GameServerHandler` | same as FR-02                                                                              | JC    |
| FR-83 | Input frames carry a sequence number to support replay protection.         | `InputFrame`        | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/InputFrame.java`              | AA    |
| FR-84 | Out-of-order or duplicate sequence numbers are dropped.                    | `MatchSession`      | same as FR-21                                                                              | JC    |
| FR-85 | Input rate is capped at 120 frames per second per session.                 | `GameServerHandler` | same as FR-02                                                                              | JC    |
| FR-86 | Magic numbers in envelopes are validated by `WireCodec`.                   | `WireCodec`         | `src/bomberman-core/src/main/java/de/srh/bomberman/core/wire/WireCodec.java`               | AA    |

## Non-functional requirements

| ID     | Quality attribute                                                         | Realising element                       | File                                                                                       | Owner |
|--------|---------------------------------------------------------------------------|-----------------------------------------|--------------------------------------------------------------------------------------------|-------|
| NFR-01 | 60 Hz server tick budget under 16.67 ms                                   | `MatchSession`                           | same as FR-21                                                                              | JC    |
| NFR-02 | 60 fps client rendering on integrated GPU                                  | `ArenaRenderer`                          | same as FR-71                                                                              | SK    |
| NFR-03 | Single-port deployment on TCP 8080                                         | `WebSocketServer`                        | same as FR-01                                                                              | JC    |
| NFR-04 | Zero-database persistence (file only)                                      | `ServerConfig`                           | `src/bomberman-server/src/main/java/de/srh/bomberman/server/config/ServerConfig.java`     | AA    |
| NFR-05 | Single-command reproducible build                                          | `pom.xml`                                | `pom.xml` (root)                                                                           | AA    |
| NFR-06 | Server-authoritative anti-cheat                                            | `GameServerHandler`                      | same as FR-02                                                                              | JC    |
| NFR-07 | Profanity filter on every chat message                                     | `ProfanityFilter`                        | same as FR-61                                                                              | JC    |
| NFR-08 | Bot fallback when a player disconnects mid-match                           | `BotController`                          | `src/bomberman-server/src/main/java/de/srh/bomberman/server/ai/BotController.java`         | JC    |
| NFR-09 | Age gate before launch                                                     | `AgeGate`                                | `src/bomberman-client/src/main/java/de/srh/bomberman/client/safety/AgeGate.java`           | SK    |
| NFR-10 | Operational metrics exposed for examiner inspection                        | `MetricsHandler`                         | `src/bomberman-server/src/main/java/de/srh/bomberman/server/MetricsHandler.java`           | JC    |

## Use cases

| ID    | Use case                          | Driver class           | File                                                                                       |
|-------|-----------------------------------|------------------------|--------------------------------------------------------------------------------------------|
| UC-01 | Launch client                     | `ClientLauncher`       | `src/bomberman-client/src/main/java/de/srh/bomberman/client/ClientLauncher.java`           |
| UC-02 | Authenticate                       | `AuthRegistry`         | same as FR-05                                                                              |
| UC-03 | Join lobby                         | `LobbyService`         | same as FR-10                                                                              |
| UC-04 | Buy and equip cosmetics            | `CosmeticsCatalog`     | same as FR-14                                                                              |
| UC-05 | Start a match                      | `MatchManager`         | same as FR-20                                                                              |
| UC-06 | Place a bomb                       | `Bomberman`            | same as FR-30                                                                              |
| UC-07 | Collect a power-up                 | `GameWorld`            | same as FR-24                                                                              |
| UC-08 | Throw a bomb                       | `ThrowBonus`           | same as FR-38                                                                              |
| UC-09 | View kill feed                     | `KillFeedEntry`        | same as FR-54                                                                              |
| UC-10 | Send chat                          | `ChatRouter`           | same as FR-60                                                                              |
| UC-11 | View match results                 | `RankingsView`         | same as FR-53                                                                              |
| UC-12 | Disconnect, bot takes over         | `BotController`        | same as NFR-08                                                                             |

## Business rules

| ID    | Rule                                                                         | Enforcing class       | File                                                                                       |
|-------|------------------------------------------------------------------------------|-----------------------|--------------------------------------------------------------------------------------------|
| BR-01 | A player may hold at most six power-ups of any single type.                  | `Bomberman`           | same as FR-30                                                                              |
| BR-02 | A match has a hard cap of eight slots.                                       | `Match`               | same as FR-23                                                                              |
| BR-03 | A match auto-ends after twelve minutes regardless of state.                  | `MatchSession`        | same as FR-21                                                                              |
| BR-04 | Chat messages over 256 characters are rejected.                              | `ChatRouter`          | same as FR-60                                                                              |
| BR-05 | A player below the age-gate threshold cannot start a match.                  | `AgeGate`             | same as NFR-09                                                                             |
| BR-06 | Cosmetic prices are denominated in soft-currency only.                       | `CosmeticsCatalog`    | same as FR-14                                                                              |
| BR-07 | A player who quits within the first thirty seconds receives no score delta. | `Score`               | same as FR-50                                                                              |
| BR-08 | Bots may not be the last player standing for a recorded ranking.             | `BotController`       | same as NFR-08                                                                             |

## Closing note

The matrix is exhaustive against the requirements baseline frozen on 14 May 2026. Subsequent changes are recorded in `requirements-changelog.md` (delivery slice, AA). Any reviewer who finds a requirement without a row, or a row without a corresponding source file, should raise the discrepancy with AA as an issue tagged `traceability`.
