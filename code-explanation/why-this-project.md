# Why this project — context, choices, and learning outcomes

**Module:** Software Architecture and Development (SAD), M.Sc. Applied Computer Science, SRH University Stuttgart.
**Date:** 28 May 2026 — Week 7 of 8 (Prototype submission). **Final:** Tuesday 2 June 2026.
**Architects:** Abhilash Anuku (AA), Simranjot Kaur (SK), Jithendra Chittomothu (JC).

This document is the one-page answer to questions a reviewer or examiner is likely to ask before diving into the technical artefacts: *what is software architecture and development, why Java, what are we supposed to learn, why a Bomberman game, why this stack, and why did we declare libraries we did not ship*.

---

## 1. What is Software Architecture and Development?

**Software architecture** is the set of structural decisions that fix how a system is decomposed into parts, how those parts interact, and how the system meets its quality goals (performance, availability, security, modifiability, usability, testability, deployability). It is the "shape" of the system that you cannot easily change later without rewriting major pieces.

**Software development**, in this module's framing, is the disciplined process by which those architectural decisions are translated into running code: requirements specification, building-block design, interface contracts, implementation, verification, and operation. Architecture without development is paper; development without architecture is a chaotic codebase that survives one sprint and then collapses.

The deliverables pack in this repository is built around the **arc42** template (`architecture-spec-arc42.md`) because arc42 codifies exactly this discipline: 22 sections that walk from goals and constraints, through context, through building blocks and runtime and deployment views, to cross-cutting concerns, decisions (ADRs), and risks. Every section in the spec ties back to either a quality the system is supposed to deliver or a constraint it has to live with.

---

## 2. Why Java?

Java was chosen as the single implementation language for every module, for six concrete reasons that map directly onto the module's quality requirements.

1. **Type system catches integration mistakes early.** With three architects working on a shared domain, a compile-time guarantee that `PlayerSnapshot` looks the same on the server and on the client is worth more than any runtime contract test. Records and sealed classes (Java 17) make the DTO layer easy to read and impossible to drift.
2. **JVM portability.** The same byte code runs on the demo laptop (Windows), on the CI Linux runners, and on Cloud Run when v0.3 ships. Zero per-platform conditionals.
3. **Netty is mature.** The high-performance non-blocking WebSocket stack we need exists, has a decade of production use, and does not require importing a heavyweight framework.
4. **JavaFX gives a real desktop client without a browser.** The mandala-themed UI is a JavaFX `Canvas` painted by `ArenaRenderer`; we get hardware acceleration, scene graphs, and gamepad/audio integration without a Webview.
5. **Maven multi-module reactor enforces architectural boundaries.** The `bomberman-core ← bomberman-server`, `bomberman-core ← bomberman-client` dependency arrows are declared in `pom.xml`. The build refuses to compile any reverse edge.
6. **Module alignment with the course material.** The SAD lectures use Java examples; choosing Java keeps the conversation between course theory and our concrete code direct, with no language-translation overhead.

What we deliberately did **not** choose: Kotlin (would add a second toolchain), Scala (overkill for game state), Go (no JavaFX-equivalent UI), Rust (would slow the build week budget too much), JavaScript/TypeScript (would force a browser client and lose JVM testability).

---

## 3. Learning outcomes — what the module asks us to demonstrate

The M.Sc. SAD module has six learning outcomes that the deliverables pack maps directly to.

| Outcome | Where it is demonstrated |
|---|---|
| **L1** Apply arc42 to specify a non-trivial software architecture. | `code-explanation/architecture-spec-arc42.md` — full 22-section spec. |
| **L2** Make and justify architecture decisions (ADRs) under quality-attribute pressure. | Section 9 of the arc42 spec — three ADRs (WebSocket+JSON, server authority, JavaFX client). |
| **L3** Trace requirements to design to code. | `code-explanation/requirements-traceability.md` — FR-01..FR-86, NFR, UC, BR each pointed at a Java class and file. |
| **L4** Use UML and SysML to communicate architecture. | `uml/` (six SVGs: class diagrams per module, package, use-case, activity) and `diagrams/` (architecture, deployment, two sequence diagrams). |
| **L5** Work in a small team with clear ownership boundaries. | `code-explanation/systems-architecture.md` — twelve named systems with three-way ownership (AA / SK / JC). |
| **L6** Build and defend a working prototype that demonstrates the decisions. | The three Maven modules under `src/`, the build that passes `mvn clean test` with 11 green tests, and the slide deck under `presentation/`. |

For the viva, the prepared Q&A is in `code-explanation/LEARNING_GUIDE.md`.

---

## 4. Why a Bomberman game?

A multiplayer arena game is, from an architecture point of view, an excellent vehicle for the SAD module because it forces almost every quality-attribute trade-off into the open and gives every decision an immediate, measurable consequence.

- **Latency** — a 100 ms wait between pressing space and the bomb appearing is noticed by every player; that pressure forces the snapshot stream design and the 60 Hz tick rate.
- **Fairness and authority** — players cheat. The server must hold the authoritative simulation; clients render only what the server sanctioned. This is exactly the tension the lecture on quality-attribute tactics asks students to resolve.
- **Real-time concurrency** — multiple players, bombs, explosions, and bots all advance on the same simulation tick. The pipeline that runs them in a deterministic order is a textbook concurrency exercise.
- **Modifiability** — the seven `Bonus` subclasses (Flame, ExtraBomb, Speed, Kick, Throw, Armor, Life) and the abstract `Bonus` hierarchy let us demonstrate the open–closed principle in code that ships.
- **Clear actors and use cases** — Player, Spectator, Admin, Bot. UC-01 (sign in) through UC-12 (ban) are obvious and complete; no synthetic stretching.
- **Familiar problem domain** — the rules of Bomberman are common knowledge, so the team spends weeks on **how to build it well**, not weeks on **what to build**. This is the right ratio for a SAD module.
- **Indian-festival visual identity** — the mandala palette and `MandalaArt` Canvas give the prototype a distinct identity without changing the underlying mechanics. It also gives the UX architect (SK) a non-trivial visual problem to solve.

---

## 5. How we planned the game design

Game design was planned in three layers that fed straight into the code.

**Layer 1 — rules and modes.** The match runs on a rectangular tile grid (`Arena`, `Tile`, `TileType` Wall/Block/Floor/Spawn). Players (max four) spawn at corners. Each turn the server samples inputs, advances movement, detonates bombs whose fuse reached zero, applies explosion damage to overlapping tiles, awards bonus pickups, and emits a `WorldSnapshot`. Three modes were drafted (Classic Deathmatch, Team Survival, Capture the Bomb); the prototype ships Classic Deathmatch fully wired and the other two scaffolded for v0.3. See `code-explanation/game-design.md`.

**Layer 2 — entities (the domain model).** The entity list was lifted from the module's reference specification (the domain whiteboard distributed at kick-off): `Bomberman`, `Player`, `Score`, `Bomb`, `Explosion`, `Arena`, `Tile`, `Bonus` (abstract) with seven concrete subclasses, `PowerUpItem`. Each spec entity exists as a Java class in `src/bomberman-core/.../entity/` and `.../world/`. The traceability matrix in `requirements-traceability.md` proves the 1:1 mapping.

**Layer 3 — scoring and progression.** A `Score` object travels with each `Player` and accumulates four counters (kills, deaths, assists, bonuses). Kills score +100, bonus pickups +25, control points +1. Win condition: last player standing in Classic Deathmatch; highest score at timer expiry in time-limited matches. `HudOverlay` displays the running scoreboard; `RankingsView` displays the final table when the server emits `MatchEnd`. See `code-explanation/game-design.md`.

**Visual identity.** The Indian-festival palette (teal / turmeric / henna / gold on aubergine) is locked in `MandalaTheme.java` (client) and `assets/portal.css` (deliverables). The `MandalaArt` canvas renders concentric mandala layers behind the menu and lobby as a calm, deterministic backdrop.

---

## 6. Why this stack — and only this stack

The technology stack listed in every doc and the arc42 spec is intentionally short. The module asks for **the language and the server choice that makes the architecture demonstrable**, not a catalogue of every tool that touched the build.

**In the tech stack (what the architecture is built on):**

- Java 17 (LTS) — language
- Maven 3.9 (multi-module reactor) — build
- Netty 4.1 — WebSocket server pipeline
- Jackson 2.18 — JSON `Envelope` codec on the wire
- JavaFX 21.0.5 — desktop client UI
- JUnit 5 — test framework

**Optional sidecars for v0.3 (declared in `pom.xml` but not yet wired to functional code paths):**

- PostgreSQL 16 — persistent rankings, account metadata
- Redis 7 — match-state cache for crash-recovery

**Deliberately not in the tech stack:**

- Docker, docker-compose — these are *how we run* the server locally and on Cloud Run. They belong in `build/BUILD_AND_RUN.md` §4 and in the deployment diagram, never in the stack list.
- GitHub Actions, GHCR, Cloud Run — *how we deliver*. Same rule.
- Spring Boot, Quarkus, Micronaut — heavy frameworks the architecture does not need. Refused.
- GraphQL, Protobuf, FlatBuffers — alternative wire formats. Refused in favour of JSON for human-inspectability.

Drawing this line is itself an architecture decision and is recorded as such in the arc42 spec.

---

## 7. Why Kryo and Lombok were declared and then removed

A common viva question: *the parent `pom.xml` once declared Kryo and Lombok — why?*

**Kryo (5.6.2).** Kryo is a fast binary serialisation library. The original design considered using JSON for the lobby/auth/match-control path and switching to Kryo for the high-volume in-match `WorldSnapshot` stream, where 60 Hz × N players × payload would dominate the bandwidth budget. The team decided to ship the prototype with **JSON-only on every path** for two reasons: every byte is inspectable on the wire (a major debugging advantage during the 7-week build) and every demonstration of the protocol fits on a slide. Kryo was kept declared in `pom.xml` as a "we will turn this on if telemetry shows we need it" placeholder. In the pre-demo audit on 28 May 2026 we confirmed no source file imported it, and the dependency was removed. If v0.3 needs it, we add it back with an ADR and a measured-need justification.

**Lombok (1.18.36).** Lombok auto-generates `@Getter`, `@Setter`, `@ToString`, `@EqualsAndHashCode` boilerplate. It was declared early in week 1 in case the team ended up writing entity classes with heavy getter/setter ceremony. By week 4 the entities had been refactored into Java 17 `record`s (no boilerplate needed) and small plain classes with explicit constructors (deliberate, for clarity). Lombok was never imported in any source file. The audit confirmed this, and the dependency was removed — keeping the toolchain minimal and the IDE setup zero-config.

Both removals were verified by a clean `mvn clean test` run: 11 tests pass, 3 modules build, no functional regressions.

---

## 8. How the three architects shared the work

| Architect | Slice | Files they own |
|---|---|---|
| **Abhilash Anuku (AA)** | Delivery, architecture spec, requirements traceability, build, deploy. | Parent `pom.xml`; `architecture-spec-arc42.md`; `requirements-traceability.md`; `AuthRegistry`; `ProfanityFilter`; the deliverables portal. |
| **Simranjot Kaur (SK)** | UI / UX, gameplay engine, HUD. | `MandalaArt`, `MandalaTheme`; `SceneRouter`, `MainMenuView`, `LobbyView`, `ArenaView`, `RankingsView`; `ArenaRenderer`, `HudOverlay`; the simulation classes (`GameWorld`, `Snapshotter`). |
| **Jithendra Chittomothu (JC)** | Networking, server lifecycle, bot AI, ops. | `WebSocketServer`, `GameServerHandler`, `MetricsHandler`; `MatchManager`, `MatchSession`; `BotController`; `Dockerfile.server`; the wire codec. |

Ownership is recorded inline in `code-explanation/systems-architecture.md`. No file is co-owned; every file has exactly one architect who is accountable for it.

---

## 9. What is left for week 8

The prototype is demoable today. Week 8 work is presentation polish, not architecture work:

1. Screenshots (lobby, mid-game, explosion, rankings, menu) into `deliverables/screenshots/`.
2. Final report wording + slide deck polish (HTML deck under `presentation/slides.html`, editable DOCX exports under `deliverables/exports/`).
3. Viva run-through against `code-explanation/LEARNING_GUIDE.md`.
4. Confirm the demo machine's WebSocket URL matches the inline field on `MainMenuView`.

None of those are blockers. The architectural story stops here.
