# Plans

> Our plan for BomberMen-X. We are in **Week 7 of 8** and currently **building the prototype**.

## Programme shape

The programme is 8 weeks. The build window inside it is 6 weeks (W2 to W7). Week 1 was analysis and planning; Week 8 is reserved for defence preparation and the final write-up.

| Week | Focus |
|---|---|
| 1 | Analysis, planning, project poster, repo scaffolding |
| 2 to 3 | Multi-module Maven layout, Docker stack, CI skeleton |
| 4 to 5 | Deterministic 60 Hz core; Netty WebSocket server; wire protocol |
| 6 | JavaFX client + mandala HUD; bot AI; pickups |
| **7 (now)** | **Prototype hardening; deliverables pack; tests; security scan** |
| 8 | Defence preparation, final report, presentation |

## Team

Three architects, each carrying a lane. All three sign off on every cross-module change.

- **Abhilash Anuku (AA)** -- delivery, planning, architecture spec.
- **Simranjot Kaur (SK)** -- UI / UX, gameplay engine.
- **Jithendra Chittomothu (JC)** -- networking, deployment.

## Scope at Week 7

**In the prototype:** deterministic 60 Hz simulation, Netty WebSocket server, JavaFX desktop client with the mandala renderer, gamepad support, bot AI with 3 personality profiles, FFA + KING_OF_GRID + LEVELS + TEAMS game modes, 6 power-ups (EXTRA_BOMB, BOMB_POWER, SPEED, KICK, THROW, SHIELD), age gate, profanity filter, CI on GitHub Actions, Docker images, Cloud Run deploy workflow.

**Deferred:** Android Unity client; Kryo binary wire format (JSON for now); persistent ranking math (real-time data only); spectator mode polish; replay viewer UI (the deterministic seed-plus-inputs guarantee is in place; no UI consumes it yet).

## Rituals

- 15-minute morning standup; three questions; no shared screens.
- Async decision log in the repository -- every architectural call landed there before the code.
- Single GitHub Projects board; every issue has an owner, a module label, and a week label.
- Docker Compose stack stays up on every architect laptop.

## Next (Week 7 to Week 8)

- Close the remaining bugs found in playtests.
- Finalise the six defence-pack documents (linked from the portal).
- Rehearse the defence against the requirements-traceability matrix (FR-01 to FR-86).
- Write up the final report.
