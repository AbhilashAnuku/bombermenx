## Chapter 7 — Domain Model

The domain model of BomberMen-X sits at the centre of every other concern in the project. Networking, rendering, AI, and persistence all orbit around a small set of plain Java types that live in the `bomb-core` module. We took the deliberate decision early in the design process that these types would contain no rendering code, no networking code, and no thread primitives. They model the game world and nothing else, which makes them easy to test on a developer laptop and easy to serialise across the wire.

### 7.1 Core Entities

The four entities that make up a match instance are `Player`, `Bomb`, `Explosion`, and `PowerUpItem`. Each lives in the `com.bombermenx.core.entity` package and is referenced from `GameWorld` through plain collections.

A `Player` holds an integer identifier, a `TilePos`, a `Direction` (the way the player last faced, used by `DASH`), a hit-point count, a remaining-lives count, an active bomb counter and an active bomb cap, a current explosion power, a current move speed (in tiles per second), a shield flag, a kick flag, a team index, a token wallet for super-abilities, ability cooldown counters, a step cooldown counter, and a control-point counter for King-of-Grid scoring. Players are mutable; we found over the course of the project that copy-on-write per-tick was too expensive given the size of a `PlayerSnapshot` and the 60 Hz tick rate.

A `Bomb` holds an integer identifier, the owner player identifier, a `TilePos`, a remaining fuse in ticks, an explosion power, and a primed flag used by the chain-reaction code. We never store a wall-clock timer on a `Bomb`; everything is in ticks so the same input list always produces the same output on any machine.

An `Explosion` holds an identifier, an origin `TilePos`, a list of affected tiles per arm (north, south, east, west, centre), a remaining time-to-live in ticks, and an owner identifier used for kill attribution.

A `PowerUpItem` holds an identifier, a `TilePos`, and a `PowerUpType`. Pickups sit on the floor until a player walks over them. None of these entities hold a back-reference to `GameWorld`; every relationship is one-way from world to entity. This was a conscious decision after a brief flirtation with bidirectional links produced a subtle bug where a dead player still held a list reference and prevented the world from being garbage-collected at the end of a match.

### 7.2 Geometry

Geometry lives in `com.bombermenx.core.geom`. `TilePos` is an immutable pair of `int x` and `int y` with helpful methods such as `step(Direction)` and `manhattan(TilePos)`. `Direction` is an enum with `UP`, `DOWN`, `LEFT`, `RIGHT`, and a sentinel `NONE` used when a player has not yet committed to a facing. Both types implement `equals` and `hashCode` so they can be used as keys in `HashMap` and `HashSet` instances. There is no `Vec2` floating-point type in the simulation; the simulation is integer-only. Sub-tile interpolation is purely a render concern and is handled by the client.

### 7.3 World

The world is described by an `Arena` in `com.bombermenx.core.world`. An `Arena` is a fixed-size grid of `width` by `height` `TileType` values. The default match arena is 15 by 13, which gives us 195 cells and matches the size used by the genre's most-recognised titles. `TileType` is an enum with three values:

| TileType        | Walkable | Blocks explosion | Notes                                |
|-----------------|----------|------------------|--------------------------------------|
| `FLOOR`         | Yes      | No               | Default open ground.                 |
| `DESTRUCTIBLE`  | No       | Yes (consumed)   | Broken by explosion; may drop pickup.|
| `SOLID`         | No       | Yes              | Indestructible wall.                 |

`PowerUpType` enumerates the pickups we ship at v1: `EXTRA_BOMB`, `LONGER_RANGE`, `MORE_SPEED`, `SHIELD`, `KICK`, `REMOTE`, `PIERCE`, and `CORE_TOKEN`. The last is the rare drop that feeds the super-ability wallet.

`ArenaTheme` is the cosmetic-plus-tuning record that makes the arenas feel different without changing the rules. Each theme carries a `densityMul`, a `fuseMul`, and a `powerMul`. `INFERNO` raises destructible density and shortens fuses; `CRYO` does the opposite; `REACTOR` is the chaos preset with short fuses and high power. The base values come from `GameConfig`: `DEFAULT_DESTRUCTIBLE_DENSITY=0.40`, `DEFAULT_BOMB_FUSE_TICKS=150` (2.5 s at 60 Hz), and `DEFAULT_BOMB_POWER=3`.

### 7.4 Tick Order Summary

`GameWorld.tick()` runs exactly seven steps in a fixed order, every tick, on every machine. The order was chosen so that the output of one step is the legal input of the next.

1. `applyPlayerInputs()` — read this tick's `PlayerInput` for each player, move at most one tile if the step cooldown is zero, and place a bomb if the input requests it and the player is under cap. This is first because nothing else makes sense until the player positions are settled.
2. `tickAbilityCooldowns()` — decrement `NUKE` and `DASH` cooldowns. We do this after inputs because the input step may have just consumed a token.
3. `tickBombs()` — decrement every bomb fuse; any bomb whose fuse hits zero detonates. Detonation runs a `while-changed` loop so chain reactions resolve transitively before any explosion is rendered. Detonation ray-traces in the four cardinal directions up to `power`; `SOLID` stops the arm; `DESTRUCTIBLE` is broken and the arm stops one tile further; players standing on the line die unless shielded; friendly fire is off in `TEAMS` mode.
4. `tickExplosions()` — decrement every explosion's TTL and reap those at zero. We do this after `tickBombs` so a freshly-detonated bomb gets a full TTL window.
5. `collectPickups()` — any player standing on a `PowerUpItem` collects it. This is after explosions because an explosion that killed the player must beat the pickup; you cannot collect a powerup on the tick you die.
6. `advanceSuddenDeath()` — every 30 ticks (0.5 s) drop a `SOLID` on the next cell of an inward spiral. This is after pickups so a player who collected a token cannot then be hit by the spiral on the same tick before the token is credited.
7. `tickKingOfGrid()` — if the mode is `KING_OF_GRID`, place or teleport the node and award `+1 controlPoint` per second to the occupier. This is last because it depends on final player positions.

End-of-tick: `currentTick++` and an end-of-match predicate runs.

```java
public void tick() {
    applyPlayerInputs();
    tickAbilityCooldowns();
    tickBombs();
    tickExplosions();
    collectPickups();
    advanceSuddenDeath();
    tickKingOfGrid();
    currentTick++;
    checkEndOfMatch();
}
```

### 7.5 Invariants

Four invariants protect the integrity of the simulation. We enforce them in code and assert them in unit tests.

- **No two bombs share a tile.** `placeBomb` rejects the request if the target tile already has a bomb.
- **Bomb fuses monotonically decrease.** No code path adds to a fuse. Remote-detonate just sets the fuse to one.
- **Dead players don't move.** `applyPlayerInputs` skips entries whose `alive` flag is false.
- **Explosions don't outlive their TTL.** `tickExplosions` reaps strictly on `ttl == 0`, never lazily on first redraw.

Each invariant is asserted via a dedicated unit test (`InvariantTests`) and re-asserted by the determinism gauntlet on every CI build. We treat a failing invariant as a stop-the-line event: shipping code is never allowed to break one of the four properties, even temporarily, because every higher-level guarantee in the project ultimately depends on them.

| Entity        | Owns                                  | Referenced by                          |
|---------------|---------------------------------------|----------------------------------------|
| `GameWorld`   | `Arena`, players, bombs, explosions, pickups | `MatchSession`, `Snapshotter`     |
| `Player`      | `TilePos`, ability counters            | `GameWorld.players[]`                  |
| `Bomb`        | owner id, `TilePos`, fuse              | `GameWorld.bombs[]`                    |
| `Explosion`   | tiles affected, ttl                    | `GameWorld.explosions[]`               |
| `PowerUpItem` | `TilePos`, `PowerUpType`               | `GameWorld.pickups[]`                  |
## Chapter 8 — Network Protocol

The network protocol is the contract between every client and every server in the project. Once it is published nobody is free to break it; we therefore spent disproportionate time on its shape relative to its size.

### 8.1 Transport

All client traffic runs over a single WebSocket connection. The server is built on Netty 4.1 and exposes the WebSocket endpoint at the path configured by `ServerConfig.websocketPath()`, defaulting to `/ws`. WebSocket gives us bidirectional framing, message boundaries, optional permessage-deflate compression, and works through corporate proxies that would block raw TCP. We chose it over QUIC, gRPC, and a custom UDP layer because the v1 game does not need sub-frame latency and we did not want to ship a Datagram-stack on day one.

### 8.2 Envelope Shape

Every payload on the wire is wrapped in an `Envelope` record with four fields:

| Field     | Type          | Purpose                                               |
|-----------|---------------|-------------------------------------------------------|
| `type`    | `MessageType` | Discriminator selecting the payload class.            |
| `seq`     | `long`        | Monotonic sequence number per connection.             |
| `t`       | `long`        | Server-relative tick or epoch milliseconds.           |
| `payload` | `JsonNode`    | Polymorphic body decoded according to `type`.         |

The envelope is the only top-level shape on the wire. There is no second framing layer. The `seq` field allows lost or duplicated packets to be detected at the application layer even though TCP already provides ordering, and gives us a hook for replays and reconnect-resume logic in later versions.

### 8.3 MessageType Enum

`MessageType` is the single enumeration that names every kind of message we send. We split it visually into two families: the match family and the Neon Plaza lobby family. The enum names below are the string serialisations that go on the wire.

| Type              | Direction | Summary                                                           |
|-------------------|-----------|-------------------------------------------------------------------|
| `HELLO`           | C to S    | Client identifies itself and requests a mode.                     |
| `WELCOME`         | S to C    | Server accepts and assigns a session id.                          |
| `AUTH_REQUEST`    | C to S    | Optional auth handshake (Dev or Google).                          |
| `AUTH_RESULT`     | S to C    | Auth outcome and account id.                                      |
| `QUEUE_JOIN`      | C to S    | Add this session to the matchmaker queue.                         |
| `QUEUE_LEAVE`     | C to S    | Remove from the queue.                                            |
| `QUEUE_STATE`     | S to C    | Position, queue depth, mode tally.                                |
| `MATCH_START`     | S to C    | Match assigned; carries seed, arena, players list.                |
| `INPUT_FRAME`     | C to S    | Per-tick `PlayerInput` (move dir, place flag, ability flag).      |
| `ABILITY_REQUEST` | C to S    | Player wants to spend a token on `NUKE` or `DASH`.                |
| `WORLD_SNAPSHOT`  | S to C    | Full or delta snapshot of `GameWorld` state.                      |
| `GAME_EVENT`      | S to C    | Discrete events: bomb placed, wall broken, pickup spawned.        |
| `KILL_FEED`       | S to C    | A `KillFeedEntry`: killer, victim, weapon.                        |
| `HAPTIC_CUE`      | S to C    | `{pattern, magnitude, durationMs}` for the gamepad.               |
| `MATCH_END`       | S to C    | Final score, winner, MVP, payout.                                 |
| `PING`            | both      | Heartbeat probe.                                                  |
| `PONG`            | both      | Heartbeat reply.                                                  |
| `CHAT`            | both      | Filtered chat in a room.                                          |
| `VOICE_FRAME`     | both      | Opus-encoded voice slice (reserved for v2).                       |
| `LOBBY_JOIN`      | C to S    | Enter the persistent Neon Plaza.                                  |
| `LOBBY_LEAVE`     | C to S    | Leave the lobby.                                                  |
| `LOBBY_STATE`     | S to C    | Roster, cosmetics, countdowns.                                    |
| `LOBBY_EMOTE`     | C to S    | Trigger a lobby emote.                                            |
| `LOBBY_EQUIP`     | C to S    | Equip a cosmetic from the catalogue.                              |
| `LOBBY_INTERACT`  | C to S    | Use a kiosk (cosmetics, daily, training).                         |
| `ERROR`           | S to C    | Structured error with code and message.                           |

### 8.4 Encoding

At v1, every envelope is encoded as JSON with Jackson. JSON is verbose but it is readable, scriptable, and self-describing, which made the entire integration phase noticeably easier. We kept binary encoding (Kryo) on the road map for the `WORLD_SNAPSHOT` path in particular, because that single message type accounts for more than 90 percent of the bytes on the wire in a four-player match. The handler architecture isolates encoding behind `WireCodec.encode(Envelope)` and `WireCodec.decode(String)`, so swapping JSON for Kryo on the SNAPSHOT path is a localised change.

### 8.5 Versioning

We treat the string spellings of `MessageType` and each DTO field name as the wire ABI. We do not reorder enum values, we do not rename fields, and we add new fields only at the end of a DTO. Removing a field is a breaking change and is the only kind of change that requires a protocol-version bump. The client compares its compile-time protocol version with the value in `WELCOME` and refuses to play if they differ on the major component.

### 8.6 Heartbeats

The Netty pipeline installs an `IdleStateHandler` with a 60-second all-idle threshold. If a connection produces no traffic for 60 seconds in either direction, the server closes the channel. To keep matches alive during natural lulls, the client sends a `PING` envelope every 15 seconds while connected and replies to any server `PING` with a `PONG`. The `t` field carries epoch milliseconds for `PING` so the client can compute round-trip time and surface it in the HUD.

### 8.7 Frame Budget

Netty's `HttpObjectAggregator` is configured at 64 KiB. That is comfortably larger than any single envelope we currently send. A full `WORLD_SNAPSHOT` for a 15 by 13 arena with four players, six bombs, eight active explosion segments, and four pickups encodes to roughly 7 KiB of JSON. The 64 KiB limit gives us headroom for future features (per-tile damage masks, larger arenas, more players) without revisiting transport limits.

### 8.8 Example Envelopes

The shape of an `INPUT_FRAME` from client to server:

```json
{ "type": "INPUT_FRAME", "seq": 4172, "t": 4172,
  "payload": { "playerId": 2, "dir": "RIGHT", "placeBomb": false, "ability": null } }
```

A trimmed `WORLD_SNAPSHOT` from server to client:

```json
{ "type": "WORLD_SNAPSHOT", "seq": 4173, "t": 4173,
  "payload": { "tick": 4173, "players": [ {"id":2,"x":7,"y":5,"hp":1,"power":3} ],
               "bombs": [ {"id":11,"x":7,"y":5,"fuse":92,"power":3} ],
               "explosions": [], "pickups": [] } }
```

A `MATCH_END` from server to client:

```json
{ "type": "MATCH_END", "seq": 9981, "t": 1716393021000,
  "payload": { "winnerTeam": 1, "mvp": 2, "scores": [12, 3], "durationTicks": 9954 } }
```
## Chapter 9 — Server Implementation

The `bomb-server` module is the authoritative side of the system. Every rule that decides whether a player lives or dies is evaluated here; the client merely reports its inputs and renders what the server tells it. We organised the module so that every responsibility has its own package and so that the dependency graph is acyclic.

### 9.1 Bootstrap

The process entry point is `BombServerApplication`. Its `main` method does five things in order. It loads configuration from environment variables via `ServerConfig.fromEnv()`. It constructs the long-lived singletons: a `MatchManager`, a `ProfanityFilter`, a `SessionRegistry`, a `ChatRouter`, an `AuthRegistry` wired with `DevAuthProvider` and `GoogleAuthProvider`, and a `LobbyService`. It installs a JVM shutdown hook that calls `WebSocketServer.stop()` and `MatchManager.shutdown()` on receipt of SIGINT or SIGTERM. It calls `WebSocketServer.start()` to bind the listening port. It then sleeps the main thread on a latch so the daemon threads can do their work. The order matters; in particular the shutdown hook is installed before `start()` so a crash during binding still flushes logs cleanly. We pinned each long-lived singleton behind an explicit constructor parameter rather than reaching for a dependency-injection container; the wiring is only twenty lines long and the absence of reflection makes start-up time imperceptible. The first line of `main` prints a banner with the build version, Git commit hash, listening port, and the active `ServerConfig` snapshot, so that production log archives carry the configuration that produced them. We discovered during integration tests that environment-variable typos were silently coerced to defaults, so `ServerConfig.fromEnv()` now warns loudly when it sees a variable name it does not recognise, on the principle that surprises in production are worse than chatty start-up logs in development.

### 9.2 Netty Pipeline

The Netty pipeline is assembled in `WebSocketServer.initChannel(SocketChannel)`. Each handler has a specific job and the order is significant.

```java
ChannelPipeline p = ch.pipeline();
p.addLast(new IdleStateHandler(60, 60, 60));
p.addLast(new HttpServerCodec());
p.addLast(new HttpObjectAggregator(64 * 1024));
p.addLast(new MetricsHandler());
p.addLast(new WebSocketServerCompressionHandler());
p.addLast(new WebSocketServerProtocolHandler(cfg.websocketPath()));
p.addLast(new GameServerHandler(sessions, matches, chat, auth, lobby));
```

`IdleStateHandler` enforces the 60-second heartbeat described in Chapter 8. `HttpServerCodec` and `HttpObjectAggregator` together turn raw bytes into complete HTTP requests up to 64 KiB. `MetricsHandler` answers three special URL paths before the WebSocket upgrade: `/metrics` for Prometheus, `/health` for orchestrator liveness probes, and `/version` for the build identifier. `WebSocketServerCompressionHandler` enables permessage-deflate at the protocol layer. `WebSocketServerProtocolHandler` performs the WebSocket handshake on the configured path. Finally `GameServerHandler` is the application-level handler that owns the dispatch table from `MessageType` to action.

### 9.3 SessionRegistry and ClientSession

`SessionRegistry` is the per-server map from `ChannelId` to `ClientSession`. A `ClientSession` carries everything we need to know about a single connected client: the Netty `Channel`, an integer session id, the connected account if any, the display name, the request fields that drive matchmaking (`matchId`, `lobbyId`, `requestedMode`, `requestedLevel`), and a small set of tracked counters used by the metrics endpoint. `ClientSession` exposes a `send(Envelope)` convenience method that encodes the envelope to JSON and writes it as a single text WebSocket frame. We were careful that the registry never holds a strong reference to anything outside the connection's lifetime; the session is removed from the registry in `channelInactive`.

### 9.4 Matchmaker

`MatchManager` runs a single matchmaker thread at 1 Hz. Each tick it scans the queue and follows one of three paths.

- **Path A — queue full.** If the number of waiting humans for a given mode has reached the maximum for that mode, the match starts immediately with no bots.
- **Path B — warmup elapsed.** Each queue carries a warmup timer that begins when the first human joins. When the warmup elapses we start the match with bot fill. A lone human is filled to three bots, which produces a four-way free-for-all that matches our design intent. Otherwise we add a single bot to round out the lobby.
- **Path C — pre-start countdown.** While humans are still arriving, we broadcast a countdown via `QUEUE_STATE` so the client can show a live timer.

The mode for a starting match is chosen by **plurality vote** across the waiting players' `requestedMode` fields. Ties are broken in favour of `CLASSIC`. For `LEVELS` mode, an extra bot count is added per level: `extraBots = min(7 - humans - botCount, level - 1)`. The clamp guarantees we never exceed the eight-slot arena. Plurality voting felt fairer in playtest than majority: in a queue of four players where two want `KING_OF_GRID`, one wants `TEAMS`, and one wants `CLASSIC`, plurality picks `KING_OF_GRID` rather than dropping back to `CLASSIC` because nobody held an absolute majority. The 1 Hz cadence of the matchmaker tick was a conscious choice; faster cadences gave no measurable user-perceived improvement in queue times and made it harder to reason about the warmup timer, while slower cadences caused the visible countdown to lurch in awkward steps. Each `MatchManager` tick also publishes a `queue_depth` Prometheus gauge so we can watch player flow live during launches.

### 9.5 MatchSession

Once a match is created, `MatchManager` hands its players off to a new `MatchSession`. The session owns a single-threaded scheduled executor that ticks at 60 Hz. Each tick the session reads the per-player `InputFrame` buffer, calls `GameWorld.tick()`, takes a snapshot via `Snapshotter.snapshot(world)`, and sends the resulting `WORLD_SNAPSHOT` envelope to every player. Discrete events emitted by the world (bomb placed, wall broken, pickup spawned, player killed) are also sent as `GAME_EVENT` envelopes so clients can drive sounds and particles without diffing snapshots themselves. The session terminates when the world's end-of-match predicate becomes true, sends a `MATCH_END` envelope, and then frees its players back to the lobby or queue. The 60 Hz tick is implemented with `ScheduledExecutorService.scheduleAtFixedRate` with a period of 16,666 microseconds; we considered busy-waiting on `System.nanoTime` but found that the executor's scheduling jitter was below 0.5 ms in practice, which is well inside the 16.6 ms tick budget. Each session also keeps a small ring buffer of the last 600 ticks of input frames per player, which gives us a six-second look-back for late-arriving packets without unbounded memory growth. When a player disconnects mid-match the session keeps their slot alive for ten seconds in case it is a transient network blip; if the player reconnects within that window the next `INPUT_FRAME` they send is replayed from where they left off, otherwise the slot is filled by a takeover bot so the remaining humans are not stranded with a frozen opponent.

### 9.6 Chat

`ChatRouter` is a small dispatcher that routes `CHAT` envelopes to the appropriate room. A room can be a match, a lobby, or a team. Before routing, every message is passed through `ProfanityFilter.clean(String)` which masks a list of disallowed substrings. We deliberately kept the profanity list short and conservative; the goal at v1 is to comply with school-friendly age-gating, not to police speech in every language.

### 9.7 Auth

Authentication is optional at v1 but the plumbing is in place. `AuthRegistry` holds a list of registered `AuthProvider` implementations. `DevAuthProvider` accepts any non-empty user name and is enabled when the server is started in development mode. `GoogleAuthProvider` validates the ID token using Google's published JWKS endpoint and trusts the email and `sub` claims for identity. Clients send an `AUTH_REQUEST` envelope and receive an `AUTH_RESULT` envelope before any queue join is honoured in production.

### 9.8 Persistent 3D Lobby

The lobby is the social layer that hosts players between matches. `LobbyService` manages a small number of in-memory lobby rooms and the `LobbyPlayer` records inside each one. A `CosmeticsCatalog` lists every `Cosmetic` available to equip: hats, trails, dance emotes, and skins. Equipping a cosmetic involves a `LOBBY_EQUIP` envelope from the client, a catalogue lookup, an entitlement check, and a broadcast of the updated `LOBBY_STATE` to every other player in the room. The room's tick rate is much lower than a match: lobbies update at 5 Hz, which is plenty for a social space and saves a non-trivial amount of CPU and bandwidth. Each lobby may host up to thirty-two simultaneous players; beyond that we shard into multiple parallel rooms and balance new joiners between them. Cosmetic entitlements are stored in a flat in-memory map at v1, with a clear seam in `LobbyService.entitlementsFor(accountId)` so that a future persistence layer (PostgreSQL or DynamoDB) can be slotted in without touching the rest of the lobby code. Daily-login rewards, training-room access, and a small set of social emotes are all driven through the same `LOBBY_INTERACT` envelope with a `kioskId` discriminator, which keeps the dispatch table on the server short.
## Chapter 10 — Game Simulation and Rules

The simulation is where every rule of the game lives. The same code runs on the server's authoritative match thread and on the client's offline-practice mode, and we depend on it producing the same results in both places.

### 10.1 Determinism Contract

The contract is short: given the same `seed` and the same ordered list of `PlayerInput` frames, `GameWorld.tick()` produces a byte-identical sequence of states on every machine. We rely on three properties to keep that promise. First, the world contains no floating-point arithmetic; positions are integers and timings are tick counts. Second, all randomness flows from a single `java.util.Random` seeded from the match seed; we never read `System.currentTimeMillis()` from the simulation. Third, iteration order over players, bombs, and pickups is always determined by insertion order or by primary key, never by hash order. The reward for this discipline is enormous: we can record an input log and replay any match deterministically for debugging, regression tests, and future training of learned bots. We run a continuous-integration job called the *determinism gauntlet* that picks ten archived input logs at random and replays each one twice in fresh JVMs, asserting that the SHA-256 of every emitted `WorldSnapshot` matches. The gauntlet has caught two real regressions in the project's life: one where a temporary `HashSet` was iterated for tile-walking and gave per-JVM-instance ordering, and one where the match-end timestamp accidentally used `System.currentTimeMillis()` and thus depended on the host clock. Both bugs were trivial to fix once the gauntlet pinned them; without it neither would have been visible until a player reported a desync.

### 10.2 Tap-to-Step Movement

Movement is tap-to-step rather than continuous. Each player has a `stepCooldownTicks` field. When the cooldown is zero, a non-`NONE` direction in the player's `PlayerInput` causes the player to advance exactly one tile in that direction provided the destination is walkable, and the cooldown is reset to `max(4, round(60 / moveSpeed))`. The `max(4, ...)` clamp ensures that even at the absurdly high movement speeds players can stack via pickups, the simulation still has a perceptible minimum cadence of one step every four ticks. Sub-tile interpolation in the renderer is a render hint only; the authoritative position is always integer.

### 10.3 Bomb Placement

A player may place a bomb on a tick if the input requests it, the target tile is `FLOOR`, no other bomb stands on that tile, and the player's `activeBombs` count is below their `bombCap`. On success a new `Bomb` is created with `fuse = DEFAULT_BOMB_FUSE_TICKS` and `power = player.power`. The bomb is added to `GameWorld.bombs` in deterministic order, and the player's `activeBombs` counter increments. When the bomb later detonates, the counter decrements.

### 10.4 Chain Reactions

The chain-reaction loop is a textbook fixpoint. We hold a `Set<Integer>` of primed bomb ids. We add to it every bomb whose fuse has reached zero this tick. Then, in a `while-changed` loop, we walk every primed bomb's ray and for every other bomb whose tile lies in the ray, we mark that bomb primed too. The loop terminates because the primed set monotonically grows and is bounded by the number of bombs in the world. Only when the set is stable do we actually compute and apply the explosions. Tests assert that the order in which two simultaneously-detonating bombs are processed does not affect the resulting set of broken walls. The clearest practical consequence of the fixpoint approach is that a "trap chain" of five bombs laid in a corridor detonates as a single event from the player's perspective: every wall in the chain breaks on the same tick and every player along the chain dies on the same tick, rather than the chain visibly rippling outward over five frames as it would with a one-bomb-per-tick implementation. Playtest feedback consistently described the chain reaction as the most satisfying mechanic in the game, and the fixpoint loop is what gives it its punch.

### 10.5 Friendly Fire

Friendly fire is on in every free-for-all mode and off in `TEAMS` mode. The implementation is a single guard: in the explosion application step, a victim with the same non-negative team index as the bomb owner does not take damage. The `same team and team >= 0` shape is important because we use `team = -1` to mean "no team" in free-for-all modes; if we had compared only by equality, two unaffiliated players would have been classified as teammates.

### 10.6 Sudden Death Geometry

When the match reaches its sudden-death window, `advanceSuddenDeath()` drops one `SOLID` tile every 30 ticks (every 0.5 s). The sequence walks an inward spiral starting at `(0, 0)` and ending at the centre. Tiles that are already `SOLID` are skipped; tiles holding a player kill that player on contact unless the player has `shield`. The cadence and geometry were tuned by playtest: 0.5 s per wall yields a closing window long enough to feel suspenseful but short enough that the longest possible match cannot exceed roughly seven minutes.

### 10.7 King of the Grid

`KING_OF_GRID` is one of our headline modes. A single `kingNode` tile is placed at match start and teleported every 20 seconds (1200 ticks). On each tick, if a unique living player stands on the `kingNode`, that player's `controlPoint` counter increments once per second (every 60th tick the simulation samples occupancy). The match ends when any player's `controlPoint` reaches 30; that player wins outright. Standoffs (two players adjacent) award nothing, which keeps the mode honest in 1v1 finishes. We initially considered awarding a fractional point in a standoff but the rule was too subtle to communicate in a HUD widget; the on-or-off rule reads at a glance from the score ribbon and produces clean, decisive endings. The node's teleport pattern is seeded from the match seed, so two replays of the same match place the node on the same tiles at the same ticks; this property is important for the replay tooling we use to debug close-finish complaints.

### 10.8 Super-Abilities

Two super-abilities ship at v1. **NUKE** detonates a 3x3 explosion centred on the caster's tile, with the caster immune to its own blast. NUKE costs 3 tokens and has a 12-second (720-tick) cooldown. **DASH** moves the caster up to 3 tiles in their current facing, stopping early on any non-walkable tile or active explosion. DASH costs 1 token and has a 6-second (360-tick) cooldown. Tokens come from the rare power-up roll: every destroyed `DESTRUCTIBLE` rolls a 0.06 chance to drop a `CORE_TOKEN` pickup.

### 10.9 Power-Ups

The pickup roll on a destroyed wall is two-stage. First, a 6 percent roll for a `CORE_TOKEN`; if it hits, no further roll happens. Otherwise a 40 percent roll for a regular pickup (`POWERUP_DROP_RATE = 0.40`). The regular pool is `EXTRA_BOMB`, `LONGER_RANGE`, `MORE_SPEED`, `SHIELD`, `KICK`, `REMOTE`, and `PIERCE`. The weights are uniform at v1; we kept them so to make playtest reasoning easier, with a clear path to per-mode weighting later.

### 10.10 Theme Tuning

Arena themes adjust simulation feel without changing the rules. The constants table below is the canonical reference.

| Theme     | densityMul | fuseMul | powerMul |
|-----------|------------|---------|----------|
| `CLASSIC` | 1.00       | 1.00    | 1.00     |
| `INFERNO` | 1.20       | 0.80    | 1.10     |
| `CRYO`    | 0.80       | 1.20    | 0.90     |
| `REACTOR` | 1.10       | 0.60    | 1.20     |

The multipliers apply to `DEFAULT_DESTRUCTIBLE_DENSITY`, `DEFAULT_BOMB_FUSE_TICKS`, and `DEFAULT_BOMB_POWER` respectively. `INFERNO` gives a busier, faster board; `CRYO` is sparser and slower; `REACTOR` is chaos: short fuses, high power, plenty of walls.
## Chapter 11 — AI / Bot Design

### 11.1 Why Bots

The most painful version of a multiplayer game for a new player is the one where they sit in an empty queue. We refused to ship that experience. From day one, the design called for a solo human to be able to press Play and find themselves in an arena within a few seconds of the warmup elapsing. Bots make that possible. They also let us run dense playtests with a small human group and let us validate the simulation by leaving a bot match running overnight under a debugger.

### 11.2 BotController Behaviour

`BotController` is a rule-based opponent. It does not search the full state space and it does not learn. Each tick, for each bot, it performs the following decision loop.

```java
PlayerInput tick(GameWorld w, Player me) {
    if (inDanger(w, me))
        return retreatToSafeTile(w, me);
    Player target = nearestEnemy(w, me);
    if (target != null && inLineOfSight(w, me, target))
        return new PlayerInput(NONE, true, null);
    TilePos softWall = nearestSoftWall(w, me);
    if (softWall != null && adjacent(me.pos, softWall))
        return new PlayerInput(NONE, true, null);
    TilePos goal = (target != null) ? target.pos : softWall;
    Direction d = aStarFirstStep(w, me.pos, goal);
    return new PlayerInput(d, false, null);
}
```

The four helpers are simple. `inDanger(w, me)` returns true if the bot stands on a tile that lies within the ray of any bomb whose fuse is less than or equal to a configurable horizon, or within any active explosion. `retreatToSafeTile` BFS-floods walkable tiles to find the nearest cell not in any bomb ray. `nearestEnemy` and `nearestSoftWall` are linear scans over the world. `aStarFirstStep` runs A* over `Arena.isWalkable(x, y)` from the bot's tile to the goal and returns the direction of the first step; if no path exists it returns `NONE`. The whole loop is short enough to inline in a debugger and short enough to budget statically; even with seven bots in an arena the per-tick AI cost is well under a millisecond. The "drop bomb when in line of sight of an enemy" rule is surprisingly effective: because bombs explode on a fixed 2.5-second fuse and players are limited to one tile per step at the default speed, an enemy needs to commit to retreat as soon as a bomb is placed, and a bot that opportunistically places bombs is hard to corner. The "drop bomb when adjacent to a soft wall" rule keeps the bot generating its own pickups during quiet phases of a match, which means it never falls statically behind a human who is mining walls efficiently. Together, the two rules give a bot that plays a credible cautious-aggressive game without any tree search at all.

### 11.3 Why Rule-Based Suffices at v1

Bomberman is a strikingly local game. The decision the bot needs to make on most ticks is "am I about to be exploded, and if not, where is the nearest soft wall." Neither question benefits from deep planning. A learned policy, even one trained well, would not visibly outperform the rule-based bot in single-life play against a casual human, and would consume orders of magnitude more development effort. We chose to defer learned bots until a ranked competitive ladder exists and is mature enough to expose them to varied human play.

### 11.4 Difficulty Knobs

The single `BotController` class is parameterised by three numbers we tune through `GameConfig`:

| Knob                    | Effect                                                                     |
|-------------------------|----------------------------------------------------------------------------|
| `reactionTickDelay`     | Number of ticks the bot waits before reacting to a newly-placed bomb.      |
| `lookaheadTicks`        | Bombs with fuse <= this are treated as imminent danger.                    |
| `randomnessEpsilon`     | Probability per tick that the bot chooses a random direction instead.      |

`EASY` raises reaction delay and randomness; `HARD` lowers both and extends lookahead. The same code path serves every difficulty, which keeps the test surface small. We did consider a per-rule weight vector instead of difficulty presets, but the presets are easier to communicate to players ("Easy", "Normal", "Hard", "Nightmare") and the trade-offs between the three knobs are interesting enough that exposing them all to a tuning panel would be a research project on its own. The presets are stored in `GameConfig` as named records, so server operators who want to host a tournament can ship a private preset by editing one file.

### 11.5 Future Learning Hooks

Because the simulation is deterministic and inputs are captured as a typed sequence, we can record entire matches as a list of `(tick, playerId, PlayerInput)` tuples and replay them offline. That is the same data layout a learned policy would want to train against. The plan when we get to learned bots is to keep the rule-based `BotController` as the floor and to layer a learned policy that overrides specific decisions (bomb placement, retreat path) where the policy is confident. The deterministic core gives us a free regression harness for that future work. A learned bot trained against recorded human input logs can be cross-validated on held-out logs by replaying the recorded inputs through the same deterministic `GameWorld.tick()` that runs in production; there is no simulator-to-deployment gap to bridge. We also expect a future learned bot will use the rule-based bot as a shaping reward at the start of training, which is a well-known technique to avoid the catastrophic exploration phase in self-play reinforcement learning.
## Chapter 12 — Client Implementation

### 12.1 Entry

The client's entry point is `ClientLauncher`. Its `start(Stage)` does only two things: it calls `AgeGate.prompt(stage)` to ensure the player has confirmed they are old enough, and then it hands the stage to `SceneRouter.show(MainMenuView.class)`. Nothing else happens before age confirmation. Age gating is a soft school-safety control rather than a legal compliance step at v1, but we keep its placement at the absolute top of the start sequence so it is impossible to bypass through any in-app navigation.

### 12.2 SceneRouter

`SceneRouter` is the single-source-of-truth for scene transitions. It holds a `Map<Class<? extends View>, View>` of lazily-constructed scenes and a current-view pointer. The router is the only class allowed to call `stage.setScene(...)`. Transition logic clears event listeners on the outgoing view's root before showing the new view; we learned the hard way that JavaFX listeners attached to `Scene` keep working across scene swaps and can cause stale input to bleed across screens.

### 12.3 Main Menu

`MainMenuView` is intentionally plain. It has a display-name `TextField` with prompt text "Pick a name", a server URL `TextField` defaulting to `ws://localhost:8080/ws`, and three buttons: Quick Play, Join Lobby, and Quit. The display name is persisted in `Preferences` on a successful Quick Play so returning players are not asked twice. The view's CSS file applies the Tron palette: neon cyan on black with a faint scanline overlay handled by the `PostFx` layer. The server URL field exists deliberately at the top level rather than buried in a settings dialog; players testing local builds need to swap server addresses dozens of times a day, and any extra clicks are noise.

### 12.4 Lobby

`LobbyView` mirrors the server-side `LobbyState` in real time. It displays a roster of `LobbyPlayer` rows with avatar, display name, and equipped cosmetics, plus a countdown ribbon driven by `LOBBY_STATE` messages. Selecting a row opens a profile panel; selecting a kiosk dispatches `LOBBY_INTERACT`. Joining a match queue from the lobby keeps the lobby alive in the background so the player returns to the same room after the match ends.

### 12.5 Arena

`ArenaView` is the in-match view. Its root is a `StackPane` containing a `Canvas` for the world plus a transparent `Pane` called `HudOverlay` that hosts the kill feed, mini-map, and ability bar. The split between Canvas and overlay matters: scene-graph nodes on the overlay are easy to position with FXML-style layout, while the world itself is drawn imperatively for performance. We render every tile, bomb, explosion, and player on the Canvas, but use scene-graph nodes for HUD widgets that need styling and event handling.

### 12.6 Renderer

`ArenaRenderer` is ticked by a JavaFX `AnimationTimer`, which fires once per JavaFX pulse, nominally at 60 FPS. Each frame the renderer reads the latest interpolated `WorldSnapshot` and draws in fixed order: tiles, bombs, explosions, players, then HUD elements. The fixed order avoids painter's-algorithm artefacts where a player sprite could draw under a bomb on the same tile.

```java
new AnimationTimer() {
    @Override public void handle(long nowNanos) {
        double dt = (nowNanos - lastNanos) / 1_000_000_000.0;
        lastNanos = nowNanos;
        snapshotCache.interpolate(dt);
        renderer.draw(snapshotCache.current(), gc);
        particles.tick(dt);
        cameraShake.tick(dt);
        postFx.draw(gc);
    }
}.start();
```

`ParticleSystem` carries short-lived sparks and glow trails with TTLs around 600 ms; particles use additive blend mode for the neon look. `CameraShake` produces a decaying offset on every explosion event, with an initial amplitude of 6 px and a decay constant of roughly 200 ms. `PostFx` finally draws scanlines at less than 0.4 opacity on top of the whole frame, which is the single most-mentioned visual cue in our playtest feedback: it sells the Tron-Bomberman aesthetic in one cheap pass. The renderer is careful to fall back to a static frame if the JavaFX pulse skips: when `(nowNanos - lastNanos) > 50_000_000` (more than 50 ms since the last frame) we suspect the JVM has paused for a GC, and rather than scale interpolation by the full pause window we cap `dt` at 33 ms. This avoids the disconcerting "teleport" effect where a paused frame causes every entity on screen to jump to its current authoritative position, and instead lets the next two or three frames catch up smoothly.

### 12.7 Audio

Audio is a thin layer over `javafx.scene.media`. `AudioBus` holds a master gain and a small number of group gains (music, sfx, voice). `SpatialAudio` attenuates per-source volume by Euclidean distance in tile-space from the player to the event's tile, with a configurable falloff. The two sounds we paid the most attention to are the bomb thump (low frequency, longer envelope) and the pickup ping (high frequency, very short envelope). Together they are responsible for most of the moment-to-moment feedback the player gets in an arena, and getting their frequency separation right was worth the time. Music is decoupled from sfx via a separate `MediaPlayer` bound to the music gain; the music track is selected by `ArenaTheme` so `INFERNO` plays a hot, percussive loop while `CRYO` plays a slow synth pad. Volume sliders in the main menu adjust the three gains in real time so a player can tune the mix without leaving the match.

### 12.8 Input

Keyboard input flows through JavaFX events as expected. Gamepad input is harder. We use JInput 2.0.10 via the `GamepadPoller` class. The poller is created on demand the first time `ArenaView` is shown, scans the connected controllers, and binds to the first one with a stick. Each render frame, the poller samples the stick, normalises it to a `Direction` with a deadzone of 0.35, and reads the A and B buttons for place-bomb and ability respectively.

```java
controller.poll();
EventQueue q = controller.getEventQueue();
Event ev = new Event();
while (q.getNextEvent(ev)) {
    Component c = ev.getComponent();
    float v = ev.getValue();
    if (c.getIdentifier() == Axis.X) lastX = v;
    if (c.getIdentifier() == Axis.Y) lastY = v;
    if (c.getName().equals("A") && v > 0.5f) placeBomb = true;
}
```

Haptics close the loop. `HapticsService` listens for `HAPTIC_CUE` envelopes from the server and dispatches them to the gamepad's rumble motors. A `HapticCue` is a `(pattern, magnitude, durationMs)` triple; patterns include a short kick for pickups, a long rumble for being shielded, and a hard double-punch for being killed. The cue is driven server-side because the server knows the canonical event timing. We considered driving haptics purely from local events on the client (the player's own bomb just exploded under them) but the round-trip latency to the server is short enough that the centralised approach gives more consistent feedback across hot-seat and online play, and it keeps the haptics service in one place rather than spread between client-side event taps and server-driven cues.

### 12.9 Safety

`AgeGate` persists the user's age confirmation in `Preferences` on a best-effort basis. We deliberately do not block on the result: if Preferences is unavailable (sandboxed launcher, read-only filesystem) the user is asked again next launch, which is the safer failure mode. The age threshold and the prompt text live in `GameConfig` so they can be tuned without a code change to the safety code itself. We surveyed the school-safety guidance our institution publishes for student-built games and chose a thirteen-plus self-attestation gate, which matches the threshold used by every major platform we considered. A future version of `AgeGate` will integrate with an external identity provider for verified ages on accounts that have one, but the current best-effort gate is sufficient for the project's v1 audience.