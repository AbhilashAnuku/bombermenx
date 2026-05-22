# BomberMan-X

## Agni vs Vāyu: The Mandala Wars

**Architecture Report — Descriptive and Prescriptive Views (one diagram per page)**

SRH University Stuttgart · Software Architecture and Development · Java
Brief: *Lastenheft*, Prof. Steffen Becker
Authors: Abhilash Anuku · Captain · Simranjot Kaur · Designer · Jithendra Chittomothu · Engineer
22 May 2026 · 17 pages

---

> **Importing into Google Docs.** Upload this file to Google Drive and open
> it with Google Docs (right-click → Open with → Google Docs). For automatic
> Markdown conversion, enable *Settings → Convert uploaded files* in Drive,
> or in Docs use *Tools → Preferences → Enable Markdown*.

---

## 1. Abstract

BomberMan-X is a client and server application written in Java. The brief,
by Prof. Steffen Becker, asks for a Bomberman that lets two to four players
compete in one shared arena over the network. The brief also requires that
any group's server must work with any other group's client. This
interoperability rule is the strongest single constraint in the design.

The system is organised as three Maven modules. The shared library holds
the deterministic simulation and the wire protocol. The server module runs
the canonical match instance on top of Netty and WebSockets. The client
module is a JavaFX desktop application that predicts inputs locally for
responsiveness and reconciles against the server on every snapshot. The
two runtime modules never depend on each other; they meet only at runtime,
over the wire.

The descriptive sections walk through the system as built. The prescriptive
section lists, in priority order, the architecture changes a successor team
should make.

## 2. Contents

| Page | Section |
|------|---------|
| 1 | Cover |
| 2 | Abstract and contents |
| 3 | Modules and layering rule |
| 4 | Class diagram — `bomb-core` |
| 5 | Class diagram — `bomb-server` |
| 6 | Class diagram — `bomb-client` |
| 7 | Package diagram |
| 8 | Use case diagram |
| 9 | Activity diagram (match lifecycle) |
| 10 | Sequence diagram (match start) |
| 11 | Sequence diagram (bomb placement) |
| 12 | Packet protocol |
| 13 | Server authority and synchronisation |
| 14 | AI bot and state management |
| 15 | Prescriptive recommendations |
| 16 | Visual identity — hero banners |
| 17 | Visual identity — team crests and arena |

## 3. References

1. M. Frank and S. Becker. *Lastenheft fürs Softwarepraktikum: Aufgabe Bomberman*. Version 1.1, 29.05.2017.
2. Glenn Fiedler. *Networked Physics*, gafferongames.com, 2014.
3. E. Gamma, R. Helm, R. Johnson, J. Vlissides. *Design Patterns*. Addison-Wesley, 1994.
4. R. C. Martin. *Clean Architecture*. Prentice Hall, 2017.

---

## 4. Modules and layering rule

BomberMan-X is built as three Maven modules. The dependency edges between
them are the load-bearing rule of the whole architecture.

### 4.1 The three modules

| Module | Role | Major types |
|---|---|---|
| `bomb-core` | Shared library. Deterministic simulation, entity model, wire protocol. Depends on nothing inside the project. | `GameWorld`, `GameConfig`, `Bomb`, `Explosion`, `PowerUpItem`, `Envelope`, `MessageType`, `WireCodec` |
| `bomb-server` | Authoritative server. Owns the only canonical `GameWorld` for each active match. Accepts WebSocket connections via Netty. | `BombServerApplication`, `WebSocketServer`, `SessionRegistry`, `MatchManager`, `MatchSession` |
| `bomb-client` | JavaFX desktop application. Predicts locally for responsiveness, reconciles against every snapshot, renders the arena and HUD. | `ClientLauncher`, `SceneRouter`, `ArenaView`, `ArenaRenderer`, `GameClient`, `BotPolicy` |

### 4.2 The layering rule

Both runtime modules depend on `bomb-core`. Neither runtime module depends
on the other. The two runtimes meet only at runtime, over the WebSocket
wire, by exchanging the JSON envelopes defined in
`com.bombermenx.core.net`. This rule is enforced by the Maven dependency
graph; a pull request that adds an edge between the two runtimes is
rejected at review.

### 4.3 Inner and outer layers inside the shared library

Inside `bomb-core`, the inner game model (`geom`, `world`, `entity`) has
no knowledge of the outer wire layer (`net`, `net.dto`). The
`Snapshotter` class is the bridge that turns simulation state into wire
DTOs.

### 4.4 What this architecture optimises for

1. **Determinism.** Same seed, same input log, same state stream.
2. **Cross-group interoperability.** Any group's server must accept any group's client over the same envelope.
3. **Responsiveness.** Client prediction keeps input feel under one frame even when network round-trip time climbs.

### 4.5 Defence of the architectural choices

Five decisions shape the system. The table below names each alternative
that was considered, the reason the chosen option won, and what would
change if the other one had been picked instead.

| Decision | Chosen | Alternatives considered | Why the chosen option wins |
|---|---|---|---|
| **Desktop client framework** | JavaFX 21 | Swing, web client (HTML5 + Canvas) | Ships with the JDK, scene-graph plus Canvas for custom rendering, JInput-compatible. Swing's animation primitives are weaker; a web client doubles the wire-format surface area. |
| **Server I/O** | Netty + WebSocket | Spring Boot Web, Vert.x, plain TCP | Battle-tested NIO with explicit control over the pipeline. Spring's footprint and Vert.x's reactive model fight the 60 Hz tick loop. Plain TCP would force us to reimplement WebSocket framing. |
| **Wire format** | JSON over WebSocket | Kryo, Protocol Buffers, FlatBuffers | Inspectable in a browser dev-tools panel; no schema compiler. The cost is roughly four times the bandwidth of a binary format; the next protocol version introduces Kryo as an opt-in. |
| **Authority model** | Server-authoritative | Deterministic lockstep, peer-to-peer | Single source of truth; clients cannot cheat; centralised log enables replay. Lockstep is bug-prone across heterogeneous clients; peer-to-peer fragments truth and breaks moderation. |
| **Module layout** | Three Maven modules | One module, four-plus modules | Three columns map cleanly to the three runtime concerns (simulation, server, client). One module hides the layering rule; four-plus adds Maven friction without a real boundary. |

### 4.6 Tick rate, sequence numbers, and other micro-choices

| Question | Choice | Reason |
|---|---|---|
| Tick rate | 60 Hz | 30 Hz felt sluggish on the bomb-place press; 120 Hz doubled the CPU cost with no visible benefit. |
| Sequence numbers | Monotonic 32-bit per connection | Vector clocks were over-engineered for one server per match; a single integer is sufficient. |
| Input buffer depth | 30 frames | Half a second at 60 Hz — long enough for reconciliation under typical RTT, short enough that bounded replay stays cheap. |
| Interpolation buffer | 100 ms | One frame jitter cushion; smaller buffers stutter on a single dropped packet, larger buffers feel laggy. |
| Threat-map size | 13 × 13 cells | Matches the default arena; A\* closed set fits in 169 entries, search runs in well under a millisecond. |

### 4.7 What this report does not promise

The architecture does not target hundreds of concurrent matches per
server; the brief asks for a single match. There is no horizontal
scaling, no sharding, no leaderless replication. Persistence is a
single Postgres instance behind the server. The cost of removing these
ceilings is documented in the prescriptive section.

---

## 5. Class diagram — `bomb-core`

![Class diagram for bomb-core](uml/class-diagram-core.svg)

**Figure 1.** Class diagram for `bomb-core`. Filled diamonds mark composition; open arrows mark plain associations.

### 5.1 What lives in core

`bomb-core` is the shared library. It carries the deterministic game
model, the value types used by both runtimes, and the on-the-wire envelope
that both runtimes serialise to and deserialise from.

The central class is `GameWorld`. It composes the arena and every entity
inside it: the active `Bomb` instances, the live `Explosion` objects, the
collectable `PowerUpItem` entries on the floor, and the per-player
`PlayerState`. The filled-diamond composition mark on its outgoing edges
is deliberate — removing the world removes its contents.

### 5.2 The tick interface

The world advances through `GameWorld.tick(input)`. The method is pure
with respect to the input: given the same world hash and the same input
stream, it produces the same next world. That property is what makes
determinism testable.

### 5.3 The wire boundary

Three classes bridge the simulation and the wire. `Snapshotter` turns a
`GameWorld` into a `WorldSnapshot` DTO. `WireCodec` serialises any
`Envelope` to JSON. `MessageType` is the enum tag that says what shape
sits inside the envelope.

### 5.4 Geometry and identity

`Direction`, `TileType`, and the id sequence generator all live in core
because both runtimes need to agree on them. Player ids and entity ids
are monotonic 64-bit values; the server is the only writer.

### 5.5 Why one library, not two

Keeping simulation, entities, and wire in one library — instead of
splitting into `bomb-sim` and `bomb-protocol` — is deliberate. The
snapshots produced by the simulation *are* the protocol payload. Splitting
them would force one half to depend on the other anyway, with no real
isolation benefit.

---

## 6. Class diagram — `bomb-server`

![Class diagram for bomb-server](uml/class-diagram-server.svg)

**Figure 2.** Class diagram for `bomb-server`. `BombServerApplication` is the composition root.

### 6.1 The composition root

`BombServerApplication` is where every server-side object is wired
together. It builds the Netty `WebSocketServer`, the in-memory
`SessionRegistry` that tracks live connections, the `MatchManager` that
owns active matches, and the authentication and lobby services.

### 6.2 From bytes to envelopes

Inbound traffic flows through Netty's pipeline up to `GameServerHandler`,
which parses each `WebSocketFrame` into an `Envelope` and routes it. Move
and bomb-place envelopes go to the `MatchSession` of the player's current
match; lobby and auth envelopes go to the lobby or auth service.

### 6.3 Matches as state machines

Each active match is one `MatchSession`. The session owns the only
canonical `GameWorld` for that match and runs the 60 Hz tick loop. The
match lifecycle is held in a single `MatchState` enum
(WAITING → STARTING → ACTIVE → ENDING → ENDED), with guarded transitions
in `MatchSession.transitionTo`.

### 6.4 Authentication as an interface

`AuthProvider` is an interface with two implementations:
`DevAuthProvider` for local development, and `GoogleAuthProvider` for the
production identity flow. The interface lets us swap one for the other
per environment without touching `GameServerHandler`.

### 6.5 Server authority in one place

The simulation, the player roster, the bomb pool, and the pickup tables
are all read and written by exactly one thread per match. Clients send
intent; the server resolves it; the server broadcasts the result.

---

## 7. Class diagram — `bomb-client`

![Class diagram for bomb-client](uml/class-diagram-client.svg)

**Figure 3.** Class diagram for `bomb-client`. `SceneRouter` swaps JavaFX scenes; `GameClient` is the single WebSocket adapter every scene shares.

### 7.1 Boot sequence

`ClientLauncher` is the JavaFX `Application` entry point. It builds the
`SceneRouter`, runs the `AgeGate` (child-safety check on first launch),
and navigates to the `MainMenuView`.

### 7.2 Scenes and routing

A single `SceneRouter` owns the stage. It swaps between four views: the
main menu, the lobby, the rankings page, and the in-match arena. Each
view implements `SceneRouter.View` with `onShown` and `onHidden`
callbacks, so the router can start and stop per-view resources cleanly.

### 7.3 The render loop

`ArenaView` drives a JavaFX `AnimationTimer` at 60 FPS. Each frame, it
*predicts* using the buffered input, calls `ArenaRenderer` to draw the
world onto a `Canvas`, and lets the `HudOverlay` redraw on top. The
renderer composes several passes: arena floor, grid lines, tiles,
pickups, bombs, explosions, players, particles, and the post-effect
pass.

### 7.4 Input and feedback

Input comes from two sources. The keyboard pump lives in `ArenaView`; the
gamepad pump lives in `GamepadPoller`. Both produce the same `InputFrame`
record. Haptic feedback and spatial audio come from `HapticsService` and
`AudioBus`, based on the diff between two consecutive snapshots.

### 7.5 One WebSocket, many scenes

`GameClient` is the shared WebSocket adapter. It is created once at lobby
time and stays alive across the lobby and arena scenes. Each scene
subscribes to events it cares about and unsubscribes on `onHidden`.

---

## 8. Package diagram

![Package diagram](uml/package-diagram.svg)

**Figure 4.** Package diagram. Three columns, one per Maven module. Both runtimes depend on `bomb-core`; the dashed line between client and server marks the explicit non-dependency.

### 8.1 The three columns

Each column is one Maven module. Client on the left, core in the middle,
server on the right. The arrangement is purely for readability; the
dependency edges themselves are what matter.

### 8.2 The dashed non-edge

The dashed line between client and server records the explicit absence of
a dependency. The Maven dependency graph forbids this edge, and a code
review will reject any pull request that introduces it. Cross-runtime
communication happens only over the wire.

### 8.3 Sub-packages inside core

Inside the middle column, `bomb-core` is broken into seven sub-packages
stacked from outer wire layer down to inner simulation: `net` and
`net.dto` at the top, `sim`, `entity`, `world`, and `geom` below.
`GameConfig` sits at the very root.

### 8.4 Why the rule matters

Without the layering rule, a small refactor in either runtime would risk
pulling shared code in by accident, and the two runtimes would slowly
drift into a state where they could only run together.

---

## 9. Use case diagram

![Use case diagram](uml/use-case.svg)

**Figure 5.** Use case diagram. Five actors and five lifecycle groups around the system boundary. Dashed arrows are *«extends»* and *«includes»* stereotypes.

### 9.1 Five actors

The **Player** is the human user, two to four per match. The **AI Bot**
may substitute for any player. The **Game Master** configures and starts
the match. The **Match Server** is a system actor that owns several
use cases. The **Registry** (the brief's *Verwaltungsserver*) brokers
discovery.

### 9.2 Five lifecycle groups

Use cases are grouped by where in the player's lifecycle they fire:
discovery, lobby, in-match (player actions on the top row, server
actions on the bottom row), post-match, and cross-cutting.

### 9.3 Stereotypes that matter

*Resolve chains* «includes» *Place bomb* because every place triggers the
chain-resolution pass on the server. *Detonate inactive* «extends» *Place
bomb* because the brief's 30-second-no-response rule is modelled as a
server-driven bomb placement on the laggard. *Switch to AI* «extends»
*Login* because the AI fallback is offered immediately after login.

### 9.4 What the diagram tells the reader

The use case diagram fixes the system boundary. Anything not inside the
dashed rectangle is external. Reviewers can use this single view to check
whether every functional requirement in the brief is covered by at least
one use case.

---

## 10. Activity diagram — match lifecycle

![Activity diagram of the match lifecycle](uml/activity-match-lifecycle.svg)

**Figure 6.** Activity diagram of one complete match. Server (left), Shared coordination (centre), Client (right). The gold bar is the fork into the parallel 60 Hz tick loop.

### 10.1 Three lanes

The **Server** lane owns boot, registration with the registry, and the
tick loop's server side. The **Shared** lane in the centre carries the
coordination steps that depend on both sides. The **Client** lane on the
right owns boot, registry query, server selection, and the tick loop's
client side.

### 10.2 The quorum gate

The match cannot start until the quorum gate is satisfied: at least two
players, at most four. The gate is server-driven; the client's lobby
view reflects the server's lobby state, never the other way around.

### 10.3 The fork into the tick loop

The gold bar is a fork. Server and client run their tick-loop activities
in parallel from this point. Cross-lane dashed arrows are network
packets: `MOVE` and `BOMB_PLACE` from client to server, `SYNC` and
`EXPLOSION` from server to client.

### 10.4 The end condition

The bottom diamond evaluates the end condition every tick: one or zero
bombermen alive, or the match time has elapsed.

### 10.5 What the diagram does not show

The diagram intentionally omits reconciliation and prediction — those
are activities *inside* the client tick-loop boxes. They live in the
server-authority page below.

---

## 11. Sequence diagram — match start

![Sequence diagram: match start](diagrams/sequence-match-start.svg)

**Figure 7.** The sequence from client connect through to the first authoritative snapshot of an active match. Time flows top to bottom.

### 11.1 Connect and identify

The sequence begins with a WebSocket upgrade. Immediately after, the
client sends a `JOIN` envelope carrying the player's display name and
age class. The server validates both, allocates a session id, and
answers with the first `LOBBY` snapshot.

### 11.2 Lobby coordination

While the lobby is open, any change to its state produces another `LOBBY`
packet. The client's lobby view re-renders from that single source of
truth.

### 11.3 Transition to active

When quorum is met and the game master starts the match, the server
transitions `MatchState` from *WAITING* to *STARTING*, broadcasts a
`MATCH_STATE` packet, initialises the arena, and transitions to
*ACTIVE*. The first `SYNC` packet follows immediately.

### 11.4 What is not shown

The diagram does not show the bot-substitution path or heartbeats
(which run in the background at 0.2 Hz from the moment of connection).

### 11.5 Why this is a reference

This sequence is the canonical first interaction for every practicum
group's client. Anything that diverges from it will not interoperate.

---

## 12. Sequence diagram — bomb placement

![Sequence diagram: bomb placement](diagrams/sequence-bomb.svg)

**Figure 8.** One bomb's journey from key press through to the explosion event and the kill feed. Time flows top to bottom.

### 12.1 Press to wire

The player presses the place-bomb key. The client emits a `BOMB_PLACE`
envelope with the current client tick number and the player's current
cell. The envelope is queued on the WebSocket for delivery.

### 12.2 Server validates

On the next server tick, the envelope is drained. The server checks that
the player still has at least one bomb in their pool and that the cell
does not already hold a bomb or a wall. If either check fails, the
request is dropped silently — the next `SYNC` tells the client what is
real.

### 12.3 The fuse runs

A successful placement creates a `Bomb` entity with the configured fuse
length. Every subsequent server tick, the fuse counts down. When it
reaches zero, the bomb transitions from *TICKING* to *EXPLODING*. Any
neighbouring ticking bomb caught in the blast also transitions on the
same tick — the chain reaction.

### 12.4 Cosmetic vs canonical

Detonation produces two outbound packets. The `EXPLOSION` packet is
cosmetic; it carries the list of tiles in the cross-shaped blast and the
ids of any eliminated players. Clients use it to drive particles, camera
shake, and the kill feed. The `SYNC` packet on the same tick carries the
authoritative state.

### 12.5 What the client never trusts

The client never trusts its own prediction. If the predicted bomb is
rejected by the server, the next `SYNC` restores the world as if the
bomb were never placed.

---

## 13. Packet protocol

The wire format is JSON over WebSocket. Every message is wrapped in one
envelope so framing, sequencing, and version negotiation stay in one
place.

### 13.1 Envelope

Every message is a JSON object with five fields: `v` (protocol version,
uint8), `t` (message type tag), `seq` (monotonic sequence number,
uint32), `ts` (sender epoch ms, uint64, for round-trip estimation only),
and `p` (typed payload).

### 13.2 Catalogue

| Type | Direction | Trigger | Rate |
|---|---|---|---|
| `JOIN` | Client → Server | First frame after connect | One per connection |
| `MOVE` | Client → Server | Each input frame | 60 Hz max |
| `BOMB_PLACE` | Client → Server | Player requests a bomb | 4 per second max |
| `SYNC` | Server → Client | Every tick | 60 Hz |
| `EXPLOSION` | Server → Client | On detonation | On event |
| `MATCH_STATE` | Server → Client | Lifecycle transition | On transition |
| `LOBBY` | Server → Client | Seat change | On change |
| `HEARTBEAT` | Both | Liveness check | 0.2 Hz |
| `DISCONNECT` | Both | Clean teardown | Once |

### 13.3 Anti-desync rules

- Strict monotonic `seq` per connection; duplicates and out-of-order frames dropped.
- The server overrides any illegal client prediction in the next snapshot.
- Each snapshot carries enough state to rebuild the world without the previous snapshot.
- The simulation clock is monotonic on the server.
- Envelope timestamps outside ±30 s of the server clock are rejected.

---

## 14. Server authority and synchronisation

The server runs the only canonical simulation. The client predicts
locally for responsiveness and reconciles against every server snapshot.

### 14.1 The 60 Hz tick loop

The server runs a fixed step loop at 60 Hz (16.67 ms per tick). Each
tick has five stages: drain queued inputs, resolve player intents into
the world, advance entity lifetimes, evaluate the end condition,
serialise and broadcast the snapshot. We measure p99 at 13.6 ms,
leaving about 3 ms of headroom.

### 14.2 Client prediction

The client applies its input locally on the same frame it sends the
matching `MovePacket`. The input is kept in a ring buffer of 30 frames,
keyed by client tick.

### 14.3 Reconciliation

Each arriving `SyncPacket` carries a server tick. If the snapshot agrees
with the predicted state, the input buffer is trimmed. If they
disagree, the local state is replaced by the snapshot and every
buffered input newer than that tick is replayed on top.

### 14.4 Interpolation

The renderer keeps its display cursor about 100 ms behind the latest
snapshot and interpolates linearly between the two most recent ones.

### 14.5 Invariants

1. Determinism. Same seed, same input log, same state stream.
2. The server is the sole writer.
3. The simulation clock is monotonic.
4. Replay cost is bounded by the input-buffer size.
5. Each event id is unique within a match.

---

## 15. AI bot and state management

### 15.1 The AI bot

The bot is a pure function of the current world snapshot and the bot's
own seat. Every tick it builds a 13×13 threat map where each cell scores
0 (safe) to 4 (lethal this tick). A six-node decision tree sits on top:
*escape* if the current cell is threat ≥ 3, *chain-evade* if a chain is
about to spread, *pickup* if one is reachable safely, *destroy wall* if
adjacent and clear, *pressure enemy* on a low-threat path, otherwise
*wander*.

Pathfinding is A\* on the threat grid with edge cost `1 + threat[cell]`
and Manhattan distance as the heuristic.

### 15.2 State management

| Enumeration | States |
|---|---|
| `MatchState` | WAITING → STARTING → ACTIVE → ENDING → ENDED |
| `BombState` | ARMED → TICKING → EXPLODING → SPENT |
| `PlayerState` | JOINING → ALIVE → SPECTATING → LEFT |

Each enumeration exposes a `can(next)` method so that the guard table
lives next to the states.

---

## 16. Prescriptive recommendations

The system meets every functional requirement in the brief. The
recommendations below are future-proofing rather than defect fixes.

### 16.1 Must do

| ID | Recommendation | Effort |
|---|---|---|
| P1 | Stand up the central registry (the brief calls it *Verwaltungsserver*). | About 2 days |
| P2 | Add Kryo serialisation as an optional protocol version two. | About 3 days |
| P3 | Promote the inactivity-detonate rule to a first-class event. | About 1 day |

### 16.2 Should do

| ID | Recommendation | Effort |
|---|---|---|
| R1 | Externalise `GameConfig` to a configuration file. | Half a day |
| R2 | Add a pluggable arena registry. | About 1 day |
| R3 | Run the AI bot on the server as well as the client. | About 1.5 days |
| R4 | Stream the gameplay log to an external sink. | About 1 day |

### 16.3 Should not do

- Adding a shared library between client and server beyond `bomb-core` would dissolve the layering rule.
- WebRTC peer-to-peer fragments the source of truth and breaks determinism.
- Moving the canonical simulation off the server thread sacrifices replayability for unneeded throughput.

---

## 17. Visual identity — hero banners

![Hero banner, dark variant](assets/banners/hero-dark.png)

**Figure 9.** Hero banner, dark variant. Default in the JavaFX client and the deliverables portal.

![Hero banner, light variant](assets/banners/hero-light.png)

**Figure 10.** Hero banner, light variant. Used in printed reports such as this one.

---

## 18. Visual identity — team crests and arena

| Crest | Member |
|---|---|
| ![Captain crest](assets/avatars/airavata-aa.png) | Captain — A. Anuku |
| ![Designer crest](assets/avatars/mayura-sk.png) | Designer — S. Kaur |
| ![Engineer crest](assets/avatars/vyaghra-jc.png) | Engineer — J. Chittomothu |

![Arena reference spread](assets/banners/arena-elements.png)

**Figure 12.** Arena reference spread. The two factions are shown side by side, with their per-side bombs and power-ups, and the shared block, portal, and spawn-point vocabulary.

---

*End of report — BomberMan-X — 22 May 2026 — Anuku · Kaur · Chittomothu.*
