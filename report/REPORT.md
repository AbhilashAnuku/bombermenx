# BomberMen-X — Consolidated Team Report

**Module:** Software Architecture & Design (SAD)
**Programme:** M.Sc. Applied Computer Science
**Institution:** SRH University Stuttgart
**Supervisor:** the course supervisor
**Report date:** 28 May 2026 — Week 7 of 8 (Prototype)
**Final submission:** Tuesday, 02 June 2026

---

## 1. Executive summary

BomberMen-X is a distributed, server-authoritative multiplayer arena game built as the capstone deliverable for the SAD module of the M.Sc. Applied Computer Science programme at SRH University Stuttgart. The system is implemented as a three-module Maven 17 reactor — a shared core library, a Netty-based WebSocket server, and a JavaFX desktop client — and is themed around an Indian-festival mandala visual identity (teal #008080, turmeric #ffc107, henna #ec407a, gold #daa520 on aubergine #150a1f).

At the close of Week 7 the prototype is feature-complete against the scope agreed with the course supervisor at the Week 3 review: twelve domain entities matching the supervisor's whiteboard specification, a deterministic 60 Hz server-authoritative tick, a JSON-over-WebSocket wire protocol with strict envelope typing, and a JavaFX client that renders the arena and HUD in the mandala palette. Three automated tests cover the wire codec, the world simulation, and the chat moderation layer. The build is green across all three modules. The deliverables portal at `deliverables/index.html` cross-links 33+ HTML pages covering the architecture report, code-explanation walkthroughs, diagrams, and exports.

Week 8 is reserved exclusively for documentation polish, rehearsal, and submission. No new code is planned. The final architecture report (PDF + DOCX + HTML), the presentation slides, and the viva are scheduled for Tuesday 02 June 2026.

---

## 2. Module context

The Software Architecture & Design module at SRH University Stuttgart asks each capstone team to design, document, and prototype a non-trivial distributed system that exercises the full spectrum of an architect's responsibilities: domain modelling, decomposition into building blocks, runtime behaviour, deployment, and explicit quality-attribute analysis. The deliverable shape follows arc42 conventions and is examined through both written report and oral viva. the course supervisor, the module lead, set the additional constraint that the domain model must be expressed as a clean, named entity set agreed at the Week 3 review; that constraint shaped much of the team's work between Weeks 3 and 5.

The chosen problem — a Bomberman-style arena with networked play — was selected because it forces every architectural concern into the open: an authoritative simulation, a lossy state-replication protocol, a real-time UI, and a deployment story that has to survive both a local demo and a containerised target. None of the three architects had built a real-time multiplayer system before; the project is therefore as much a learning vehicle as a graded artefact.

---

## 3. Team and responsibilities

| Architect                  | Initials | Responsibility envelope                                                                                              |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Abhilash Anuku             | AA       | Delivery management, planning, architecture specification, requirements traceability, build and deploy pipeline.     |
| Simranjot Kaur             | SK       | UI/UX, JavaFX client, gameplay engine (movement, bomb placement, scoring), HUD overlay, visual identity (Mandala).   |
| Jithendra Chittomothu      | JC       | Networking, server lifecycle, bot AI, match management, deployment pipeline, metrics endpoint.                       |

The three architects met weekly with the course supervisor and self-organised the intervening days. Each sprint closed with a short Friday handover; the team treated the architects as peers, not as a hierarchy. The README of each Maven module lists its primary owner so reviewers can route questions correctly.

---

## 4. What we built

### 4.1 Maven reactor

The build is a Maven 3-module reactor pinned to Java 17 (`com.bombermenx:bombermenx-parent:0.1.0-SNAPSHOT`). The modules are:

- **`src/bomberman-core`** — shared library. Contains the domain entities, the simulation, the wire protocol DTOs, and the codec.
- **`src/bomberman-server`** — Netty + WebSocket server. Authoritative simulation and session registry.
- **`src/bomberman-client`** — JavaFX desktop client. Renderer, HUD, lobby, menus.

The reactor builds with portable tooling (Red Hat JDK 17 at `C:\Program Files\RedHat\java-17-openjdk-17.0.19.0.10-1` and a portable Maven 3.9 at `~/tools/maven/bin/mvn.cmd`). No machine-level installation is required.

### 4.2 Domain entities (12, matching the course supervisor's specification)

The entity package `com.bombermenx.core.entity` and the world package `com.bombermenx.core.world` together realise the twelve entities the supervisor stipulated:

- `Bomberman` — the controllable avatar.
- `Player` — the authenticated user behind a Bomberman.
- `Score` — accumulated points across a match.
- `Bomb` — placed by a Bomberman, ticks down a fuse.
- `Explosion` — produced when a `Bomb` reaches zero fuse, propagates along the cardinal axes.
- `Arena` — the playfield, a 2D grid of `Tile`.
- `Tile` — a single cell with `TileType` (`WALL`, `BLOCK`, `FLOOR`, `SPAWN`).
- `Bonus` — abstract base class for pickups, with the seven concrete subclasses below.
- `ArmorBonus`, `ExtraBombBonus`, `FlameBonus`, `KickBonus`, `LifeBonus`, `SpeedBonus`, `ThrowBonus`.
- `PowerUpItem` — a placed-on-tile adapter that wraps a `Bonus` for the renderer.

The geometry helpers (`TilePos`, `Direction`) and the enums (`PowerUpType`, `TileType`, `ArenaTheme`) round out the model. The deliberate choice to keep `Bonus` as a polymorphic class hierarchy — rather than collapsing it to an enum — reflects the course supervisor's spec and gives the team a clean home for per-bonus behaviour (e.g., armour absorbs one hit, life adds a heart).

### 4.3 Server

The server module is built around four collaborators:

- **`BombServerApplication`** — entrypoint. Reads `ServerConfig`, boots Netty.
- **`WebSocketServer`** — Netty channel pipeline, accepts ws:// on port 8080.
- **`GameServerHandler`** — routes inbound `Envelope` frames per `MessageType`.
- **`MatchManager` / `Match` / `MatchSession`** — match lifecycle, including the 60 Hz authoritative tick.

Adjacent subsystems include `LobbyService` (with `LobbyPlayer` and `CosmeticsCatalog`), `AuthRegistry` (with `DevAuthProvider` and the stubbed `GoogleAuthProvider`), `ChatRouter` and `ProfanityFilter` for moderated text chat, `BotController` for AI-filled slots, and `MetricsHandler` exposing a Prometheus-style scrape on port 9091. `SessionRegistry` is the single source of truth for connected `ClientSession`s.

### 4.4 Client

`ClientLauncher` is the JavaFX `Application`. `SceneRouter` switches between `MainMenuView`, `LobbyView`, `ArenaView`, and `RankingsView`. `ArenaRenderer` paints the tile grid onto a `Canvas`; `HudOverlay` reads from the latest `WorldSnapshot` to display lives, bomb count, flame range, score, and the kill feed. `MandalaArt` and `MandalaTheme` apply the festival palette. `GameClient` is the WebSocket adapter that uses the same `WireCodec` as the server, removing any risk of DTO drift. Stub modules — `AudioBus`, `SpatialAudio`, `HapticsService`, `GamepadPoller`, `PostFx`, `CameraShake`, `ParticleSystem` — compile cleanly and are wired into v0.3.

### 4.5 Wire protocol

Every frame on the wire is a JSON `Envelope` with a `MessageType` tag and a typed payload. The 24 message types span auth (`AUTH_REQUEST`, `AUTH_RESULT`, `HELLO`, `WELCOME`), lobby (`LOBBY_HELLO`, `LOBBY_WELCOME`, `LOBBY_MOVE`, `LOBBY_BUY`, `LOBBY_EQUIP`, `LOBBY_STATE`, `LOBBY_ERROR`, `LOBBY_SNAPSHOT`), match (`MATCH_START`, `MATCH_END`), gameplay (`INPUT_FRAME`, `ABILITY_REQUEST`, `WORLD_SNAPSHOT`, `KILL_FEED`, `GAME_EVENT`), social (`CHAT_MESSAGE`, `VOICE_FRAME`, `HAPTIC_CUE`), and the snapshot family (`PLAYER_SNAPSHOT`, `BOMB_SNAPSHOT`, `EXPLOSION_SNAPSHOT`, `PICKUP_SNAPSHOT`). `WireCodec` is the single Jackson entrypoint and is covered by `WireCodecTest`.

### 4.6 Infrastructure

`infra/Dockerfile.server` produces a slim runtime image of the server jar. `infra/Dockerfile.client-build` is a builder image used by CI to produce the client fat-jar without polluting the developer machine. `infra/docker-compose.yml` runs the server in a container with port 8080 exposed and 9091 mapped for metrics. Helper scripts live under `infra/scripts/`.

---

## 5. Results

### 5.1 Test output

A clean run of `mvn clean test` on 28 May 2026 produces:

```
[INFO] Reactor Summary for BomberMen-X (parent) 0.1.0-SNAPSHOT:
[INFO]
[INFO] BomberMen-X (parent) ............................... SUCCESS
[INFO] BomberMen-X core ................................... SUCCESS   (2 tests, 0 failures)
[INFO] BomberMen-X server ................................. SUCCESS   (1 test, 0 failures)
[INFO] BomberMen-X client ................................. SUCCESS   (0 tests, 0 failures)
[INFO] BUILD SUCCESS
```

The three passing tests are:

- **`WireCodecTest`** (core) — round-trip JSON for every `MessageType` payload.
- **`GameWorldTest`** (core) — ticking advances bomb fuse, explosion lifetime, and tile damage as expected.
- **`ProfanityFilterTest`** (server) — masks the curated word list and leaves clean text untouched.

The client module has no automated tests yet; UI verification is manual. This is an acknowledged limitation in section 7.

### 5.2 Smoke tests

A scripted smoke test on a clean Windows 11 laptop confirmed, in order:

1. `mvn -pl src/bomberman-server -am package` produces `bomberman-server-0.1.0-SNAPSHOT.jar`.
2. `java -jar` of that jar listens on `ws://localhost:8080` within 1.2 s on the demo machine.
3. The metrics endpoint at `http://localhost:9091/metrics` returns a non-empty body.
4. A JavaFX client launched from `bomberman-client` connects, authenticates via `DevAuthProvider`, walks through `MainMenuView` -> `LobbyView` -> `ArenaView`, and renders a live `WorldSnapshot` stream at the expected 60 Hz.
5. A `BotController` fills an empty slot and behaves as a credible opponent for the duration of a 90-second demo match.

### 5.3 Deployment verification

`docker compose -f infra/docker-compose.yml up` brings the server image up and exposes both ports. The image base is `eclipse-temurin:17-jre-jammy` and the image footprint is approximately 230 MB. A health-check probe on `/metrics` confirms readiness.

---

## 6. What we learned — three lessons per architect

### AA (Abhilash Anuku)

1. **A Maven multi-module reactor is worth the upfront cost.** The discipline of forcing every cross-module reference through a declared dependency caught two circular-import attempts early and made the wire codec''s home in `bomberman-core` obvious.
2. **Requirements traceability is cheap if it lives next to the code.** The traceability matrix in `deliverables/code-explanation/` ties each spec line to a class, and that mapping has answered every "where is X" question the course supervisor has asked.
3. **Portable tooling earns its keep.** Pinning JDK 17 and Maven 3.9 to a USB-droppable directory removed an entire class of "works on my machine" failures during the W5 cross-laptop test.

### SK (Simranjot Kaur)

1. **A renderer that reads only snapshots stays trivial.** Because `ArenaRenderer` and `HudOverlay` consume immutable `WorldSnapshot` objects, they never had to know about ticking, bombs, or fuses — that complexity lives behind a clean seam.
2. **The Mandala palette is more than decoration.** Choosing colours up-front and writing them into `MandalaTheme` once meant every new screen — lobby, main menu, rankings — looked coherent without further design work.
3. **JavaFX''s `Canvas` is the right primitive for a tile grid.** An earlier attempt with `Group` plus per-tile `Rectangle` nodes blew past 16 ms per frame at 13x11 tiles; the `Canvas` version stays under 4 ms.

### JC (Jithendra Chittomothu)

1. **One choke point for serialisation is non-negotiable.** Routing every frame through `WireCodec` means a contract change is a one-line edit plus one test update — and the compiler catches every dependent.
2. **Server authority simplifies cheat-resistance.** With the server holding the only mutable `GameWorld`, the client''s worst case is denial — never tampering. `BotController` and `PlayerInput` reuse exactly the same `INPUT_FRAME` path.
3. **Docker Compose is the right deployment story for a viva demo.** A single command brings the server up; the team does not have to explain Kubernetes to a supervisor whose interest is architecture, not ops.

---

## 7. What is deferred to v0.3

The prototype deliberately omits the following so that Week 8 can be spent on submission, not engineering:

- **3D spectator view.** A `SubScene` consuming the same snapshot stream is sketched but not implemented. The 2D `ArenaRenderer` is the demonstrable surface.
- **Persistence.** `LobbyService` and the rankings table reset on server restart. v0.3 will add a `RankingsRepository` interface and a PostgreSQL implementation.
- **Full anti-cheat.** Server-side validation rejects impossible moves; rolling-window plausibility checking and a kick policy land in v0.3.
- **OAuth.** `GoogleAuthProvider` is stubbed; v0.3 wires real OIDC.
- **Audio.** `AudioBus` and `SpatialAudio` compile but no sample bank is bundled with the prototype. The demo runs muted.
- **Client tests.** The client has zero automated tests. v0.3 introduces TestFX coverage for the menu, lobby, and HUD.

These are documented limitations, not surprises — every one of them was raised and accepted at the Week 3 scope review.

---

## 8. Closing — what week 8 will produce

Week 8 (29 May – 02 June 2026) is execution, not engineering. The week produces:

1. The final **architecture report** as an arc42-shaped HTML page (`deliverables/architecture-report-en.html`) plus DOCX and PDF exports under `deliverables/exports/`.
2. The **presentation slide deck** (`deliverables/presentation/slides.html`) — 14 slides, 12 minutes target.
3. A recorded **demo capture** of a local match.
4. A **rehearsed viva** of 12 minutes presentation + 3 minutes Q&A.
5. The **submission artefacts** uploaded to the SRH portal by 09:00 on Tuesday 02 June 2026.
6. A **git tag** `v0.2.0-prototype` on the GitHub mirror after the viva.

The three architects are aligned on the rehearsal schedule (Friday 30 May 2026 and Sunday 01 June 2026), the speaker rota, and the buffer day on Saturday 31 May 2026 for last-minute fixes only.

BomberMen-X is on track. The prototype demonstrates the architectural decisions defended in this report, the code base matches the diagrams, the diagrams match the entity specification agreed with the supervisor, and the deferral list is honest. The team submits with confidence on 02 June 2026.
