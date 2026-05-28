# Project Report

> **Prototype submission -- Week 7 of 8.** This report describes the state of BomberMen-X as a working prototype. The full reflective report will follow in Week 8.

## 1. Project

BomberMen-X is a distributed multiplayer Bomberman game built on a server-authoritative architecture. The project is our M.Sc. Applied Computer Science capstone at SRH Stuttgart, supervised by **Dr. Floriment Klinaku** for the Software Architecture and Development module.

## 2. Architecture

Three Maven modules under `src/` with a strict dependency direction:

- `src/bomberman-core` -- deterministic shared library (60 Hz simulation, wire DTOs, domain model).
- `src/bomberman-server` -- authoritative Netty WebSocket server (the only writer of `GameWorld`).
- `src/bomberman-client` -- JavaFX desktop client; renders the latest server snapshot each frame.

Server and client never depend on each other and meet at runtime over a WebSocket carrying a small JSON envelope. The full arc42 specification is in `code-explanation/architecture-spec-arc42.md`. System diagrams are in `diagrams/`; class diagrams are in `uml/`.

## 3. Requirements traceability

Dr. Klinaku Bomberman Online specification -- **FR-01 to FR-86, NFR-01 to NFR-12, UC-01 to UC-14, BR-01 to BR-20** -- is mapped to real Java classes in `code-explanation/requirements-traceability.md`. The domain entities (GameServer, Client, Match, Player, Bomberman, Arena, Tile, Bomb, Explosion, Bonus + seven subclasses, Score) match the spec vocabulary.

## 4. State at Week 7

- Deterministic 60 Hz simulation core; byte-identical state across runs with the same seed and input log.
- Authoritative Netty WebSocket server with matchmaking, four game modes (FFA, KING_OF_GRID, LEVELS, TEAMS), bot AI with three personality profiles, profanity filter, age gate.
- JavaFX desktop client with the mandala (Vayu vs Agni) renderer and gamepad support via JInput.
- Build: `mvn clean test` is green -- **11 unit tests pass** (7 in core, 4 in server).
- CI pipeline: ci, codeql, deploy-cloudrun, release, nightly workflows wired.

## 5. Deferred

- Android Unity client.
- Kryo binary wire format (JSON for now).
- Persistent ranking math (the leaderboard surface returns real-time data only).
- Replay viewer UI (the determinism guarantee is in place; no UI consumes it).
- Spectator mode polish.

## 6. Process

Three architects share accountability and rotate engineering hats. A single repository decision log records every architectural call. A 15-minute morning standup, an async issue board, and a stable Docker Compose stack keep the loop tight. Process records are kept internally by the team.

## 7. Open risks at Week 7

- Voice-channel moderation has not been closed inside the build window.
- Spectator mode is a working prototype but has not been polished.
- The CodeQL pass on the latest snapshot has not been re-run after the recent restructure.

## 8. Next (Week 8)

Defence preparation: a final pass on the six defence-pack documents, a rehearsal against the requirements-traceability matrix, and the formal submission of this report alongside the live system.
