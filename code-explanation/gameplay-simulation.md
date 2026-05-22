# GameWorld: the deep dive

Author: Jithendra Chittomothu (JC), Gameplay Director, BomberMen-X
Subject: `com.bombermenx.core.sim.GameWorld` -- how a BomberMen-X match actually advances, why every number is the number it is, and what we test to keep it honest.

I have rewritten this class three times. Every rewrite shrank the surface. What is in the codebase today is the one I am willing to ship. If you change a tick step, you change this document.

## Determinism contract

The first and only commandment: `(seed, sequence of InputFrames) -> byte-identical GameWorld state on every machine`. That is the contract. It is the reason the simulation is in `bomb-core` instead of being scattered through the renderer. It is the reason `Random` is constructed from `seed` in the `GameWorld` constructor and never reseeded, never replaced. It is the reason fuses are integer ticks, not float seconds. It is the reason `Arena.generate` walks cells in a fixed row-major order and consumes RNG draws in a fixed sequence. It is the reason `Snapshotter` reads fields and never mutates them.

Three corollaries:

- The server is authoritative but it is not magic. A correctly-implemented replay client, fed the same seed and the same input stream, will produce the same end state. Our test harness does exactly that.
- The renderer cannot affect the simulation. We pass it a read-only view of the world. If a designer wants to add screen shake when a NUKE fires, the screen shake lives in the client. The simulation only knows that 9 tiles were just set on fire.
- Floating-point operations are forbidden inside the tick loop. We compute step cooldowns in ticks (ints). We compute spiral indices in ints. The only float anywhere in the simulation is the multipliers on `ArenaTheme`, and they are folded into ints at arena-generation time before the first tick.

## Tick budget

The clock runs at 60 Hz. `GameConfig.TICK_HZ = 60`, `GameConfig.TICK_MS = 1000.0 / 60.0`. That gives 16.666... ms per tick. On the server I budget the seven steps as follows on a 15x13 arena with eight players: step 1 (inputs) under 100 microseconds, step 2 (cooldowns) under 10 microseconds, step 3 (bombs) the fat one at up to 500 microseconds in a worst-case chain, step 4 (explosions) under 50 microseconds, step 5 (pickups) under 20 microseconds, steps 6 and 7 (mode-specific) under 20 microseconds combined. Total in the millisecond range. The encode/send pass dominates, not the simulation. If a profile ever shows a tick spike above 4 ms inside `GameWorld.tick`, that is a regression and we revert.

## Tap-to-step movement

Movement is grid-locked. You do not slide between tiles; you step from one tile to the next, and there is a cooldown between steps. The cooldown is what gives the game a *feel* -- a SPEED_UP power-up should feel snappier without breaking the grid. The formula:

```java
int cd = Math.max(4, Math.round((float) GameConfig.TICK_HZ / Math.max(1, moveSpeed)));
```

At `DEFAULT_MOVE_SPEED = 12` tiles/s, `cd = max(4, round(60/12)) = max(4, 5) = 5` ticks per tile, i.e. 12 tiles/s as advertised. SPEED_UP raises the effective `moveSpeed` to 15, 18, 24, capping at 30. At 30 tiles/s the math wants `cd = 2`, but I clamp at 4 because anything faster than that breaks two invariants: (a) the bomb-placement gate cannot reliably block double-placements within human reaction time, and (b) the snapshot diff stops representing motion as one-tile transitions and starts skipping cells, which the client cannot interpolate cleanly. Four is the floor. It is the right floor. Treat it as a magic number that the rest of the system trusts.

Direction handling: the input's `move` direction sets `facing` if it is non-NONE, but the cooldown only resets when the player actually steps. Holding RIGHT into a wall keeps `facing = RIGHT` and does not advance the cooldown timer, so the moment the wall opens the player steps immediately. This matters for DASH targeting.

## Bomb placement

`canPlaceBomb(player)` returns true iff:

1. `player.alive` is true.
2. `player.activeBombs < player.maxBombs`.
3. No existing bomb already occupies `player.pos`.

Note what is NOT checked: we do not care if a power-up is on the tile (the bomb sits on top, the player picks up the power-up when they step off). We do not care if another player is on the tile (you can drop a bomb on top of an opponent's head, which is a legitimate trap-kick play with KICK). We do not deduct a fuse, a token, or anything else. The bomb is added with `fuseTicks = round(DEFAULT_BOMB_FUSE_TICKS * theme.fuseMul)`, `power = max(1, round(player.power * theme.powerMul))`, `pierce = player.hasPierce`, and `player.activeBombs++` so the limit is enforced.

## Chain reactions

The chain-reaction loop is the part most newcomers get wrong, because it is tempting to write it recursively. We do not. We do it iteratively, with a "did anything change this iteration" flag:

```java
boolean changed = true;
while (changed) {
    changed = false;
    for (Bomb b : bombs) {
        if (b.fuseTicks > 0 && !b.detonated) continue;
        b.detonated = true;
        // compute its 4-ray tile set (with current arena), without yet breaking walls
        for (Bomb other : bombs) {
            if (other.detonated) continue;
            if (rayTiles.contains(other.pos())) {
                other.fuseTicks = 0;
                changed = true;
            }
        }
    }
}
```

Why this terminates: every iteration that does anything strictly increases the count of detonated bombs, and the count is bounded by `bombs.size()`. So the loop runs at most `bombs.size()` times. Why iterative beats recursive: stack depth on a wild chain (eight players each with three bombs and a long line of destructibles linking them) can hit 24+; we are not going to blow the JVM stack, but iterative is also simpler to step through in a debugger and trivial to reason about for determinism. Order matters: we iterate `bombs` in insertion order, which is the order players placed them. That is deterministic and stable.

Only after every chain-primed bomb is identified do we *apply* the explosions: break the first DESTRUCTIBLE on each ray (or all of them, if `pierce`), roll the pickup drop, kill the players on the tiles, emit the `Explosion` entry.

## Friendly fire

In `DEATHMATCH` and `KING_OF_GRID`, every player is on team `-1`; friendly fire is meaningless because everybody is hostile. In `TEAMS`, players carry a non-negative `team` integer. The kill check inside the explosion application:

```java
if (victim.team >= 0 && victim.team == owner.team) continue; // FF off
```

A shielded player consumes their shield even on a friendly-team explosion -- the shield is a possession state, not a damage event, so it pops anyway. That is by design; SK pushed back on it once, I held.

## Sudden-death geometry

In `SUDDEN_DEATH` mode, every 30 ticks (half a second), `advanceSuddenDeath` places one `SUDDEN_DEATH_BLOCK` on the next cell of the inward spiral. The spiral starts at `(1, 1)`, runs right to `(width-2, 1)`, down to `(width-2, height-2)`, left to `(1, height-2)`, up to `(2, height-2)`... and then steps inward and repeats. On a 15x13 arena that is 11+11+11+9 = 42 cells in the first lap, 9+9+9+7 = 34 in the second, and so on -- about 134 cells before the spiral collapses on the center pillar. At 30 ticks per step, that is ~67 seconds of pressure, which on top of an already-running match enforces a hard cap. Any player on the cell when the block lands dies, no shield save -- the block crushes, it does not explode.

## King-of-the-Grid

The node is a virtual marker, not a tile. It teleports to a random walkable cell every 20 seconds (1200 ticks). The pick uses the same `Random` as power-up rolls -- deterministic. Every 60 ticks (1 second), if exactly one alive player is on the node tile, their `controlPoints` increments by 1. Two players on the same tile means contested -- no point. The win condition is `controlPoints >= 30`. Kills still add to `score` and still register in the kill feed but they do not add control points; if you spend the whole match camping with a shield you can win without a single kill, and if you top the leaderboard on kills but never sit on the node you can still lose. That is the entire design intent.

## Super-abilities

NUKE: 3x3 instant explosion centered on the player. Costs 3 tokens. Cooldown is 12 seconds (720 ticks). The player is immune to their own NUKE -- the explosion application skips the owner. Everyone else on those 9 tiles dies subject to shield/team-FF rules. Destructibles in the 3x3 all break and all roll pickups; this is the highest expected-value play in the game and is intentionally token-gated.

DASH: teleport up to 3 tiles in `facing`, stopping at the first non-walkable tile (SOLID, DESTRUCTIBLE) or the first bomb. Costs 1 token. Cooldown is 6 seconds (360 ticks). DASH does not move through SUDDEN_DEATH_BLOCK -- the block stops the dash one tile short. DASH also does not pick up power-ups passed over; only the landing tile counts. The reason: I do not want a SPEED_UP+DASH stacking exploit where one button press hoovers a row of pickups.

Both abilities check `tokens >= cost` and `cooldown == 0` before firing. If either fails, the trigger is silently dropped server-side and the client gets a `HAPTIC` cue of kind `ABILITY_FAILED` -- no `ERROR` envelope, no state delta.

## Power-ups and the two-roll pickup drop

When a DESTRUCTIBLE breaks, the simulation does two independent RNG rolls:

1. First roll: `rng.nextFloat() < POWERUP_DROP_RATE` (0.40). If true, a power-up of some kind drops. If false, nothing drops, ever -- not even a token.
2. Second roll (only if the first hit): `rng.nextFloat() < CORE_TOKEN_DROP_RATE` (0.06). If true, the drop is a `CORE_TOKEN`. Otherwise it is a regular power-up, chosen by weighted draw from the non-token entries of `PowerUpType`.

Two rolls, not one. That is what guarantees that token rate stays around 6% of *drops*, not 6% of broken walls. If I made it one roll into a flat table the rate would slide with the table size every time SK adds a new cosmetic-only pickup tier. Two rolls keeps the economy stable across content updates.

## Theme tuning

The three multipliers on `ArenaTheme` are folded into the simulation at three distinct points:

- `destructibleDensityMul` -- applied once, at `Arena.generate`. Never re-read after match start.
- `fuseMul` -- applied at every bomb-placement, as `round(DEFAULT_BOMB_FUSE_TICKS * fuseMul)`.
- `powerMul` -- applied at every bomb-placement, as `max(1, round(player.power * powerMul))`. The `max(1)` clamp is there because CRYO's 0.90 multiplier on a player with `power = 1` would round to 1 anyway, but I never want a 0-tile bomb -- that is a degenerate explosion with no tiles and unclear semantics.

Concretely:

- INFERNO -- 0.85 density, 0.85 fuse (~127 ticks, ~2.12 s), 1.15 power (rounded). Fewer walls but bombs reach further and detonate sooner. Aggressive map.
- CRYO -- 1.20 density, 1.15 fuse (~172 ticks, ~2.87 s), 0.90 power. Walled-in maze, slow bombs, weak rays. Defensive map.
- REACTOR -- 1.00 density, 0.65 fuse (~97 ticks, ~1.62 s), 1.00 power. Same arena as CLASSIC but every bomb is a panic timer. This is the theme I gate behind the Veteran filter.
- CLASSIC -- 1.00 on all three. The baseline.

## Real constants table

| Constant | Value | Where |
|---|---|---|
| `TICK_HZ` | 60 | `GameConfig` |
| `TICK_MS` | 1000.0 / 60.0 | `GameConfig` |
| `DEFAULT_ARENA_WIDTH` | 15 | `GameConfig` |
| `DEFAULT_ARENA_HEIGHT` | 13 | `GameConfig` |
| `MAX_PLAYERS` | 8 | `GameConfig` |
| `DEFAULT_BOMB_FUSE_TICKS` | 150 (2.5 s) | `GameConfig` |
| `DEFAULT_EXPLOSION_LIFETIME_TICKS` | 36 (0.6 s) | `GameConfig` |
| `DEFAULT_BOMB_POWER` | 3 | `GameConfig` |
| `DEFAULT_MOVE_SPEED` | 12 tiles/s | `GameConfig` |
| `DEFAULT_DESTRUCTIBLE_DENSITY` | 0.40 | `GameConfig` |
| `POWERUP_DROP_RATE` | 0.40 | `GameConfig` |
| `CORE_TOKEN_DROP_RATE` | 0.06 | `GameConfig` |
| `DEFAULT_MAX_BOMBS` | 1 | `GameConfig` |
| Step cooldown floor | 4 ticks | `GameWorld.applyPlayerInputs` |
| Sudden Death cadence | 30 ticks | `GameWorld.advanceSuddenDeath` |
| King teleport interval | 1200 ticks (20 s) | `GameWorld.tickKingOfGrid` |
| King point cadence | 60 ticks (1 s) | `GameWorld.tickKingOfGrid` |
| King win threshold | 30 control points | `GameWorld.tickKingOfGrid` |
| NUKE cost / cooldown | 3 tokens / 720 ticks | `GameWorld.triggerAbility` |
| DASH cost / cooldown | 1 token / 360 ticks | `GameWorld.triggerAbility` |
| Explosion TTL | 36 ticks | `GameWorld.tickBombs` |

## Things tested (`GameWorldTest`)

The current test list under the simulation test target:

- `tickAdvancesCurrentTick` -- one call to `tick()` increments `currentTick` by exactly one.
- `deterministicArenaGeneration` -- same `(width, height, seed, theme)` produces equal `arena` arrays.
- `bombFuseCountsDownByOneTickPerTick` -- placed bomb's `fuseTicks` decreases by 1 each tick.
- `bombDetonatesAtFuseZero` -- at the exact tick the fuse reaches zero, an explosion exists on the bomb's tile.
- `explosionRayStopsAtSolid` -- ray of length `power` truncates at the first SOLID and the SOLID does not break.
- `explosionRayBreaksFirstDestructible` -- the first DESTRUCTIBLE on a ray becomes FLOOR, the second on the same ray does not.
- `pierceRayBreaksAllDestructiblesInLine` -- with `pierce = true`, every DESTRUCTIBLE on the ray within `power` breaks.
- `chainReactionTriggersTransitively` -- three bombs in a line within each other's `power` all detonate on the same tick the first one's fuse hits zero.
- `shieldAbsorbsOneExplosion` -- a shielded player on an explosion tile survives and loses `hasShield`.
- `friendlyFireOffInTeams` -- two players on the same `team` do not kill each other in TEAMS mode.
- `friendlyFireOnInDeathmatch` -- two players with `team = -1` do kill each other.
- `stepCooldownClampsAtFourTicks` -- a player with `moveSpeed = 30` still has `stepCooldownTicks = 4` after a step.
- `pickupAppliedOnStep` -- stepping onto a power-up tile increments the right field and removes the pickup.
- `tokenDropRespectsTwoRollSchema` -- across 10,000 simulated wall breaks with fixed seed, `CORE_TOKEN` rate matches expected within tolerance.
- `nukeKillsThreeByThreeButNotSelf` -- a NUKE kills all enemies on the 3x3 and leaves the caster alive.
- `nukeRefusedWithoutTokens` -- NUKE with fewer than 3 tokens does nothing.
- `dashStopsAtFirstWall` -- DASH with a wall 1 tile ahead lands on the tile in front of the wall.
- `dashStopsAtFirstBomb` -- DASH never lands on or past a bomb.
- `suddenDeathPlacesBlockEvery30Ticks` -- on tick 30, 60, 90, ... exactly one new `SUDDEN_DEATH_BLOCK` exists.
- `suddenDeathBlockKillsPlayerOnTile` -- a player standing on the spiral's next cell is dead on the tick the block lands.
- `kingNodeTeleportsEvery20s` -- node tile changes exactly at tick 1200, 2400, 3600.
- `kingScoresOnePerSecondForLoneOccupier` -- 60 ticks of solo occupancy adds exactly 1 control point.
- `kingContestedAddsZero` -- two players on the node tile for 60 ticks adds zero control points to either.
- `snapshotterReflectsAlivePlayersOnly` -- `Snapshotter.snapshot` includes dead players with `alive = false`, never omits them mid-match.

If a rule in this document drifts from the test list, the tests win and this document is wrong. That is the right order of authority.
