# Glossary

**Project:** BomberMen-X
**Date:** 28 May 2026

This glossary collects the terminology used across the deliverables. It is organised into four families: Bomberman gameplay terms, network and distributed-systems terms, SAD theory terms, and Indian-theme terms used in the visual style. The intent is that any single reader can find the definition of any term used in any other document, without consulting a search engine.

```mermaid
mindmap
  root((Glossary))
    Gameplay
      Bomb
      Blast radius
      Fuse
      Soft block
      Hard block
      Power-up
      Pickup
      Spawn point
      Ghost mode
      Stunned
      Kick
      Throw
    Network
      Envelope
      MessageType
      WebSocket
      Snapshot
      Tick
      Sequence number
      Lag compensation
      Server reconciliation
      Interpolation
      Backpressure
      Watermark
      Rate budget
    SAD theory
      Architecture
      Reference architecture
      Building block
      Runtime view
      Deployment view
      ADR
      Tactic
      Quality attribute
      Trust boundary
      Authoritative server
    Indian theme
      Mandala
      Rangoli
      Vayu
      Agni
      Henna
      Turmeric
      Saffron
      Diwali
```

## Gameplay terms

**Bomb.** A live ordnance placed by a `Bomberman`. Modelled by the `Bomb` class. Has a fuse, a blast radius, and an owner. Detonates when the fuse expires or when caught in another explosion.

**Blast radius.** The number of tiles an explosion propagates in each cardinal direction from the bomb's origin tile, before being halted by an arena edge or a hard block. Modelled as the `blastRadius` field on `Bomb` and `Bomberman`.

**Fuse.** The countdown timer on a bomb, measured in seconds, before automatic detonation. Default is 2.5 seconds.

**Soft block.** A destructible block on the arena grid. Modelled by `Tile` with block type `SOFT`. Destroyed by any explosion that overlaps it; may drop a `PowerUpItem`.

**Hard block.** An indestructible block on the arena grid. Modelled by `Tile` with block type `HARD`. Halts explosion propagation but is not destroyed.

**Empty tile.** A walkable tile with no block. Modelled by `Tile` with block type `EMPTY`. May carry a `PowerUpItem` as its current pickup.

**Power-up.** An effect that modifies a `Bomberman`'s capabilities when collected. The seven power-ups are `FlameBonus`, `ExtraBombBonus`, `SpeedBonus`, `KickBonus`, `ThrowBonus`, `ArmorBonus`, `LifeBonus`.

**Pickup.** A `PowerUpItem` sitting on the floor, waiting to be collected. Distinct from a "power-up" in that a pickup is the floor representation; a power-up is the effect applied to the player.

**Spawn point.** A starting tile assigned to a player at match start. The arena has eight spawn points, one per slot. A protected zone around each spawn point ensures no player is killed before their first input.

**Respawn.** The mechanic by which a `Bomberman` whose lives are positive after being hit returns to play after a 3-second delay at a safe spawn point.

**Ghost mode.** The post-elimination state in which a player can navigate the arena visually but cannot interact. Not present in player lists in the snapshot. A spectator-light feature; can be disabled per match.

**Stunned.** A brief invulnerable state entered after an `ArmorBonus` absorbs a hit. The player cannot place bombs during stun but can move. Lasts one second.

**Kick.** The mechanic by which a player holding a `KickBonus` slides a bomb in the movement direction by walking into it. Modelled as a per-tick movement of the `Bomb` instance.

**Throw.** The mechanic by which a player holding a `ThrowBonus` projects a bomb three tiles in the facing direction via an `AbilityRequest` envelope. The bomb ignores soft blocks in flight but stops at hard blocks.

**Chain reaction.** A bomb caught in another bomb's blast detonates immediately, potentially triggering further chains. Resolved within a single tick to preserve determinism.

**Kill feed.** The on-screen log of recent kills, presented in the HUD. Driven by `KillFeedEntry` envelopes broadcast by the server.

**Rangoli.** Used here as the descriptor for the HUD border style; in cultural context, a decorative floor art form. See Indian theme section.

## Network and distributed-systems terms

**Envelope.** The universal wire wrapper: a JSON object with a `type` field and a `payload` field. Every message on the wire is an `Envelope`. Modelled by the `Envelope` class.

**MessageType.** The enum discriminator carried in the envelope's `type` field. Selects which DTO to decode the payload into.

**WebSocket.** The transport protocol used by BomberMen-X. A persistent, full-duplex TCP-based connection. Opened by the client with an HTTP upgrade and maintained for the entire session.

**Snapshot.** The flat, wire-friendly projection of the game world produced once per tick by `Snapshotter`. Carries player positions, bombs, explosions, and pickups. Modelled by `WorldSnapshot` and its sub-records.

**Tick.** A single fixed-duration step of the simulation, lasting 1/60 of a second. The unit of progression for the server's authoritative game state. Each tick consumes the input queue, advances the world, and produces a snapshot.

**Tick rate.** The number of ticks per second. Fixed at 60 Hz for BomberMen-X.

**Sequence number.** A monotonically increasing integer carried in every `InputFrame`. Used by the server to detect duplicates and out-of-order delivery.

**Lag compensation.** The general technique of adjusting server-side resolution to account for client-side delay. BomberMen-X does not implement lag compensation in the strict sense; we rely on a small round-trip time on the lab network and on client-side interpolation.

**Server reconciliation.** The technique of replaying client inputs server-side after a state correction is received. Not implemented in the prototype; documented as future work.

**Interpolation.** The client-side rendering technique of drawing between two received snapshots rather than at the latest one, smoothing the visual motion. Implemented in `ArenaRenderer`.

**Backpressure.** The condition in which a sender produces faster than a receiver can consume. Handled in BomberMen-X by Netty's write watermark; when a session's outbound buffer is too full, snapshot broadcast skips that session for one tick.

**Watermark.** A buffer-size threshold used to signal backpressure. Netty exposes low and high watermarks; crossing the high watermark pauses writes for the session.

**Rate budget.** The maximum number of envelopes per second per session per message kind. Documented in `input-validation.md` §2 stage 4.

**Round-trip time (RTT).** The time for a message to travel from the client to the server and back. On the lab network, typically under 5 ms.

**Authoritative server.** A server that holds the canonical state and is the only party that can mutate it. The opposite of a "trusted client" design.

## SAD theory terms

**Architecture.** The set of structural decisions that are hard to change after the system is built. The arc42 spec is the document that records these decisions.

**Reference architecture.** A pre-named template that a system follows. BomberMen-X follows client-server with an event-driven core.

**Building block.** A coarse-grained unit of structure. A module, a subsystem, or a layer is a building block. Documented in §5 of the arc42 spec.

**Runtime view.** A description of how the building blocks interact at runtime. Documented in §6 of the arc42 spec.

**Deployment view.** A description of where the building blocks run physically. Documented in §7 of the arc42 spec.

**ADR (Architecture Decision Record).** A short document capturing one significant decision with context, decision, and consequences. Three ADRs are present in the arc42 spec: ADR-001 (JSON over WebSocket), ADR-002 (server-authoritative simulation), ADR-003 (JavaFX desktop client).

**Tactic.** A reusable design technique that realises a quality attribute. From the Bass/Clements/Kazman catalogue. Examples: rate-limit, heartbeat, validate inputs.

**Quality attribute.** A non-functional property of the system: performance, security, availability, maintainability, modifiability, usability.

**Trust boundary.** The boundary across which authority changes. In BomberMen-X, the wire is the principal trust boundary: the client cannot be trusted, the server is the authority.

**Architecturally significant requirement (ASR).** A requirement that, if changed, would require a structural change in the system. BomberMen-X has three: the player-count cap, the responsiveness requirement, and the deployment simplicity requirement.

**4+1 view model.** A documentation discipline due to Kruchten that organises views as logical, process, development, physical, and scenario (the +1).

**arc42.** The documentation template used for the architecture spec. Twenty-two named sections; we use the canonical ordering.

**Maven reactor.** A multi-module Maven build that processes its modules in dependency order with a single command. BomberMen-X uses a three-module reactor.

## Indian theme terms

**Mandala.** A radially symmetrical motif from South Asian art traditions, used as the default visual theme of the arena. Drawn by `MandalaArt` with eight-fold symmetry, echoing the eight player slots.

**Rangoli.** Decorative patterns, traditionally drawn on the floor with coloured powder during festivals. Used here as the descriptor for the HUD border style.

**Vayu.** The Sanskrit word for wind. Used as the descriptor for the SpeedBonus pickup in the visual lexicon; the pickup sprite includes a swirl motif.

**Agni.** The Sanskrit word for fire. Used as the descriptor for the FlameBonus pickup; the pickup sprite includes a flame motif.

**Henna.** A reddish-brown plant dye used for body art. Used here as the descriptor for one of the accent colours in `MandalaTheme`.

**Turmeric.** A bright yellow spice. Used as the descriptor for the yellow accent in the palette.

**Saffron.** A deep orange-yellow. The principal warm colour in the palette and the colour of the menu border.

**Diwali.** A festival of lights celebrated across South Asia. Used as the name of an alternative arena theme (selectable through `ArenaTheme.DIWALI`) featuring lamp-light motifs instead of full mandalas. Not enabled by default in the prototype.

**Indigo.** The deep blue used as the principal cool colour in the palette. Anchors the background of the main menu and the lobby.

## Cross-reference

When a term appears in multiple categories — for example, "snapshot" appears in gameplay context as "the visible state at a moment" and in network context as "the wire payload" — the network sense is the precise one used by the documentation, and the gameplay sense is the informal one used in conversation. When in doubt, the network definition wins.

## Out of scope

This glossary does not define standard programming terms (class, method, interface, package), standard Java terms (record, enum, executor), or standard build terms (JAR, Maven phase, target directory). Readers unfamiliar with those terms should consult the official Java documentation; the SAD module assumes them as prerequisites.
