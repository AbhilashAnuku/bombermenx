# Learning Guide — Defence Q&A Preparation

**Module:** Software Architecture & Design
**Supervisor:** Dr. Floriment Klinaku, SRH University Stuttgart
**Audience:** Defence panel, 2 June 2026
**Authors:** AA, SK, JC
**Date:** 28 May 2026

This document collects twenty questions the supervisor and panel may ask during the prototype defence, each paired with a prepared answer that an architect should be able to deliver in under ninety seconds. The answers are written for vocal delivery — short sentences, clear logical structure, named artefacts — and are calibrated to the level of detail Dr. Klinaku has expected in week-by-week tutorials.

## Q1. Why JavaFX and not a web client?

The decision is recorded in ADR-003. JavaFX gives us three things the browser does not: predictable 60 Hz rendering on integrated GPUs without dropping frames during garbage collection pauses; direct gamepad access through JInput without requiring the player to grant a permission; and a single distribution artefact — a fat JAR plus a launcher script — that works on every examiner machine without an additional runtime install. A web client would have required us to solve the gamepad permission UX and to fight the JavaScript event loop for tick timing. We chose to spend that effort on the simulation instead. The cost of the decision is that the client is desktop-only; we accept this for the prototype because the examiners are on Windows workstations.

## Q2. Why JSON over WebSocket and not a binary protocol?

ADR-001 captures the reasoning. The wire load for an eight-player match is around 300 bytes per `WorldSnapshot` at 60 Hz, which is 144 kbit/s outbound from the server. That is well under any network we would deploy on. A binary protocol would shrink it by perhaps a factor of three, but at the cost of debuggability: during the defence demonstration, the supervisor can ask "show me a wire frame" and we can show a readable JSON document in the log. The trade-off changes if the player count scales beyond sixteen; for that case we have left a seam (the `MessageType` enum is the discriminator, not the wire format) but we have not implemented it.

## Q3. How is the simulation server-authoritative?

`GameWorld` lives only on the server, inside each `MatchSession`. The client sends `InputFrame` envelopes that describe intent — "I am pressing right; I am pressing bomb". The server inspects each frame, validates it against the current world state in `GameServerHandler`, and applies it to the world. The world is then ticked by `MatchSession` and snapshotted by `Snapshotter` into a `WorldSnapshot`. The snapshot is broadcast and the client renders whatever it receives. The client has no copy of `GameWorld` and no way to mutate the broadcast state. This is the textbook server-authoritative pattern from Bass/Clements/Kazman's chapter on distributed systems.

## Q4. How do you handle network lag?

Two complementary tactics. First, the client interpolates between the last two received snapshots when rendering, which absorbs jitter up to one tick interval. Second, the server tags every `InputFrame` with the sequence number the client supplied, so when a frame is delayed or dropped, the server applies it in the correct order if it arrives within the rate window, and discards it otherwise. We do not implement client-side prediction in the prototype because the benefit is small at LAN-class latencies and the implementation cost is non-trivial. We document this as a deliberate omission rather than a missing feature.

## Q5. How are bombs validated server-side?

`GameServerHandler` enforces three conditions before it forwards a bomb-placement intent to the world. The placing player must have a positive bomb budget (`Bomberman.bombBudget()` greater than zero). The target tile must be passable (`Tile.isWalkable()` true). The session must be in `GameState.RUNNING`, not paused and not ended. If any condition fails the handler responds with a `LobbyError`-style rejection and the world is not mutated. Once validated, the placement is enqueued and applied during the next tick of `MatchSession.tick()`.

## Q6. How is anti-cheat handled?

The anti-cheat posture is structural rather than algorithmic. Because the server is the only authority for the world, the client cannot fabricate kills, power-ups, or position jumps. The only attack surface from the client is the `InputFrame` itself, and that is bounded: input is rate-limited (FR-85, 120 frames per second per session), direction-validated (FR-82, only the four cardinal directions plus none), sequence-validated (FR-84, monotonic; out-of-order frames are dropped), and magic-number validated (FR-86, by `WireCodec`). The full pipeline is documented in `input-validation.md`.

## Q7. How does power-up pickup avoid race conditions?

There is only one mutator of `GameWorld` at any given moment: the `MatchSession.tick()` method, which runs on a single thread of the session's executor. Two players who step onto the same `PowerUpItem` in the same tick produce two intents in the input queue; the queue is processed in sequence, the first intent claims the pickup and sets the tile's pickup state to null, and the second intent observes the null and is rejected. There is no shared mutable state outside this single-threaded path, so there is no need for locks.

## Q8. What is the test strategy?

The test suite is deliberately thin and risk-weighted. The two highest-risk surfaces — the wire codec and the game world simulation — have dedicated unit tests in the core module (`WireCodecTest`, `GameWorldTest`). The chat moderation pipeline has a dedicated unit test in the server module (`ProfanityFilterTest`). The render and audio layers in the client are not unit-tested because their failure modes are visual and audible; we rely on manual rehearsal of the demo runbook for those. We name this asymmetry in the arc42 spec's risk section. A follow-on cohort would add property-based tests for the wire codec and integration tests for `MatchSession`.

## Q9. How is the bot AI implemented?

`BotController` runs in the server, one instance per bot, scheduled on the same executor as the match session. Each bot holds a fixed-seed `java.util.Random` for reproducibility during defence demos. The bot reads the current `WorldSnapshot` (not the live `GameWorld`, so the bot is constrained to the same information a human client has) and picks one of four behaviours based on a simple state machine: flee from active explosions; pursue nearest opponent; plant bomb if adjacent to soft block or opponent; collect power-up if one is within three tiles. The behaviour is intentionally simple; the architectural point is not bot sophistication but the discipline that bots and humans share a single input path into the simulation.

## Q10. How does the lobby handle disconnections?

`SessionRegistry` is notified when a Netty channel closes. If the session was attached to a lobby player only (no match), the player is removed and `LobbyState` is rebroadcast. If the session was attached to a match player, the player is not removed from the match immediately; instead, the slot is reassigned to a `BotController` instance and the match continues. When the human reconnects with the same identity within thirty seconds, the bot is detached and control returns. This is one of two availability tactics named in the arc42 quality requirements.

## Q11. Where is determinism enforced?

`GameWorld.tick()` is deterministic given the input ordering. The world holds no clocks, no random sources, and no thread-local state. Randomness — for pickup drops on block destruction and for bot decisions — flows through explicit `Random` instances passed by reference; the seeds are stored in the world's startup record and could be replayed. The `MatchSession` uses `System.nanoTime()` only to drive the scheduling interval, not to mutate state.

## Q12. Why a single Maven reactor with three modules?

The three-module split mirrors the three trust boundaries: shared code, server-only code, client-only code. The reactor lets us build all three with a single command, which simplifies CI and the examiner's experience. Cross-module dependencies form a strict DAG — `server` and `client` both depend on `core`, and there is no dependency between `server` and `client` outside the wire protocol that lives in `core`. This guarantees that a server-only change cannot accidentally touch client code, and vice versa.

## Q13. What is the deployment story?

The server is packaged as a self-contained fat JAR and a Docker image built from `infra/Dockerfile.server`. The client is also packaged as a fat JAR but is run on the host through `infra/scripts/run-client.cmd` or `.sh`. The full demo stack is a single docker-compose up. The deployment uses a single port for game traffic and a separate port for metrics. There is no database, no message broker, and no external dependency at runtime apart from Google's OAuth endpoint, which is reached over HTTPS and is optional at the development tier.

## Q14. What architectural style does the project realise?

A client-server architecture with an event-driven core. Inside each module the code is layered: domain at the bottom, wire and simulation in the middle, transport and rendering at the top. The combination is the most common shape for real-time multiplayer games and is the one Dr. Klinaku recommended in the week-three reference-architecture lecture as the natural fit when the dominant quality drivers are integrity and latency.

## Q15. What were the architecturally significant requirements?

Three: (a) up to eight players in one match with server-authoritative resolution (drives the client-server decision and the simulation isolation); (b) 60 fps rendering with sub-tick input responsiveness (drives the JavaFX choice and the snapshot/interpolation design); (c) examiner-friendly deployment with no admin rights and no PATH change (drives the portable Maven and portable JDK toolchain, and the single-port docker-compose stack). Every other requirement is satisfied by the realisation of these three.

## Q16. Walk me through what happens between the client pressing the bomb key and the explosion rendering.

The keypress is captured by JavaFX or by `GamepadPoller`, depending on input device. The capture is wrapped in a `PlayerInput` and tagged with the next sequence number, then sent as an `InputFrame` envelope via `GameClient`. The server receives the envelope, dispatches it in `GameServerHandler`, validates it, and enqueues it on the active `MatchSession`. On the next tick, `MatchSession.tick()` drains the queue and `GameWorld` applies the bomb placement — a new `Bomb` is added to the live bomb set. Subsequent ticks advance the fuse. When the fuse expires, the world replaces the `Bomb` with an `Explosion` whose tiles are computed by propagation through the arena. The snapshot for that tick carries the explosion, the broadcast reaches the client, `ArenaRenderer` draws the explosion tiles, `ParticleSystem` emits debris, `CameraShake` perturbs the camera, and `AudioBus` plays the boom. End to end this is on the order of two ticks plus one round-trip — under 50 ms on a typical LAN.

## Q17. What is the role of `Envelope` and `MessageType`?

`Envelope` is the only shape that crosses the wire. It carries a `type` field (an enum value from `MessageType`) and a `payload` field (a JSON object decoded into the DTO that `MessageType` selects). This monoculture has two benefits. First, the wire is trivially inspectable: a single envelope log line per message tells you what happened. Second, message dispatch on the server is a single switch on `MessageType`, which keeps `GameServerHandler` readable.

## Q18. What technical debt is left in the prototype?

Four named items: (a) the client module has zero tests; (b) the lobby state is broadcast in full on every change rather than diffed; (c) the `MandalaTheme` resource pack is hard-coded rather than catalogue-loaded; (d) the `VoiceFrame` envelope is defined but unwired. None block the defence; all are recorded in the arc42 risk section with named owners.

## Q19. How would you extend the system to support spectators?

A spectator is a session that does not own a `Bomberman` and does not appear in `LobbyPlayer` lists. The minimal extension would add a `SPECTATOR` `MessageType`, a `SpectatorSession` that subscribes to a match's snapshot stream without contributing inputs, and a UI affordance in the lobby. No change to the simulation is required because spectators consume the same broadcast stream that players do. The work is two days of effort, mostly in the lobby UX.

## Q20. If the supervisor asks "where is the architecture in this codebase?", how do you answer?

The architecture is in three places. It is in the documents under `deliverables/code-explanation/`, especially the arc42 spec and the requirements traceability matrix. It is in the three-module Maven reactor, whose dependency direction encodes the trust boundaries. And it is in the discipline of the `Envelope`-and-`MatchSession` contract: every cross-boundary event is an envelope, every state mutation flows through `MatchSession.tick()`. Read those three things and you have the architecture; the rest is implementation detail.

## Closing rehearsal note

Each architect should be able to answer any question from this list. AA owns Q1, Q2, Q3, Q12, Q13, Q15, Q17, Q20. SK owns Q5, Q7, Q11, Q16, Q19. JC owns Q4, Q6, Q8, Q9, Q10, Q14, Q18. The owner answers first; the other two add at most one sentence each. We have rehearsed this division on 27 May 2026 and will rehearse it once more on 1 June 2026.
