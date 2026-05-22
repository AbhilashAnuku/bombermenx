# Descriptive Plan — Bomber Man X

## Project framing

Bomber Man X is a master's capstone project that the three architects deliberately ran as if it were a small indie studio rather than a classroom assignment. The framing mattered because it set expectations for everything that followed: ship a playable, deployable product on a hard 14-day clock, document the work in a way an external reviewer could follow, and treat each module as something that could be handed to a successor team without ceremony. The brief was a competitive grid-arena bomber game with up to eight concurrent players, deterministic simulation, gamepad and keyboard input, and a Cloud Run deployment target. The team chose to overshoot the brief in a few specific places (a zero-install browser client, a 3D war-room dashboard for the demo) and undershoot it in others (mobile, persistent ranking) so that the result felt complete inside its own boundary rather than half-finished across a wider one.

## Team and ownership

The three architects sharing accountability are Abhilash Anuku (AA), Simranjot Kaur (SK), and Jithendra Chittomothu (JC). All three signed off on every cross-module change. Inside that frame the team rotated engineering hats day by day so that no single architect owned a single module in isolation. AA carried planning, the project poster, and the initial architecture spike. SK led the gameplay engine and the UX surface. JC led the network layer and the deployment pipeline. The ownership table for each two-day window is captured in the sprint plan, and the day-by-day actuals are reflected in the timeline below.

## Timeline

The sprint ran for eight weeks total (six weeks of build). The day-by-day windows came from the project README and the team treated them as soft commitments rather than hard gates — work that fell behind was carried into the next window rather than dropped silently.

- Day 1 (AA): analysis and planning, project poster, repository scaffolding, decision log opened. Deliverable: the planning bundle in `deliverables/plans` and the poster in `deliverables/presentation`.
- Days 2–3 (AA plus the architecture hat): multi-module Maven layout, Docker Compose dev stack, Postgres and Redis containers wired, CI skeleton in `.github/workflows/ci.yml`. Deliverable: a green `mvn verify` on an empty engine.
- Days 4–5 (backend plus gameplay hats): `bomb-core` deterministic simulation reached parity with the spec, `bomb-server` Netty WebSocket entry point came up, the wire `MessageType` enum was frozen, and the first end-to-end round-trip ran against a single bot.
- Days 6–7 (AI plus physics hats): bomb chain reactions, pickup spawn tables, and a baseline bot policy landed. The bot is intentionally simple — distance-weighted bomb avoidance plus opportunistic pickup grabs — because the deterministic core made it cheap to iterate.
- Days 8–10 (UX, UI, motion hats): the Tron-styled HUD, particle layer, scanline shader, and age gate landed on the JavaFX client. The scene router and arena renderer reached their shipping shape during this window.
- Days 11–12 (QA hat): unit suites, integration suites, a 256-bot soak harness in `loadtest.py`, and the CodeQL security scan all reached green. This is also where the team caught and fixed the largest cluster of bugs.
- Day 13 (DevOps hat): Cloud Run deploy from `deploy-cloudrun.yml`, signed release artefacts from `release.yml`, and the nightly soak from `nightly.yml` all ran end-to-end against the production project.
- Week 8 (Delivery Lead hat): beta release announcement, share-link script published, demo recorded for the war-room dashboard.

## Scope decisions

The team made three explicit scope cuts and recorded each in the decision log so the rationale would survive past the sprint.

- The Unity Android client was deferred. The JavaFX desktop client and the zero-install web client cover the demo surface, and a Unity port was judged to be a second-sprint problem rather than a first-sprint one.
- Kryo serialization was deferred. The wire protocol stayed on JSON over WebSockets for the full sprint. Kryo would have shaved bandwidth and parse time, but the JSON path is debuggable in a browser dev-tools panel and that mattered more during the build-out than the saved bytes.
- Postgres-backed rankings were stubbed. The schema exists, the writes happen, and the read path returns canned data for the leaderboard. Real ranking math depends on a longer match history than a six-week build window inside an eight-week programme can produce.

What did make the cut: FFA, TEAMS, KING_OF_GRID, and LEVELS game modes; the 60 Hz authoritative tick on the server with a 60 FPS client render; the 100 ms RTT same-region target; the ten-concurrent-matches-per-instance target on a 512 MiB Cloud Run revision; gamepad support via JInput; an age gate on the client; CodeQL on every merge.

## Tools and rituals actually used

Rituals that earned their place:

- A 15-minute morning standup. Camera on, three questions, no laptop screens shared.
- An async decision log in the repository. Every architectural call landed there before it landed in code.
- GitHub Issues and a single GitHub Projects board. Every issue had an owner, a module label, and a sprint-day label.
- A Docker Compose stack that stayed up on every architect's laptop. The cost of "is the database running" went to zero.
- A `share-link` script that produced a one-line invite for the web client. This was the single most-used tool during demos.

Rituals that the team tried and dropped: a Friday retro (folded into the end-of-day demo on Day 7), and a separate design review channel (folded into the decision log).

## Quality gates that fired

Three gates ran in anger during the sprint and each caught something real.

- The pre-beta gate in `ci.yml` blocked two merges during Days 11–12: one for a flaky integration test that turned out to be a real race in `MatchSession`, and one for a unit test that exposed a deterministic-replay drift in `GameWorld`.
- The nightly soak in `nightly.yml` ran the 256-bot harness from `loadtest.py` and caught a memory leak on Day 12 in the WebSocket disconnect path. The fix was a single missing `release()` call.
- The CodeQL scan caught a deserialization warning on Day 11 that the team addressed by tightening the JSON allow-list on `MessageType`.

## Outputs

What shipped at the end of Week 8:

- The `bomb-server` Netty + WebSocket server, deployed to Cloud Run with a signed image.
- The `bomb-client` JavaFX 21 desktop client with the Tron HUD, gamepad support, and age gate.
- A zero-install web client served from the same Cloud Run revision, accessed via the share-link script.
- A 3D war-room dashboard used for the live demo, fed by the same telemetry endpoint as the production dashboard.
- The four planning artefacts in `deliverables/plans` and the code-walk-through bundle in `deliverables/code-explanation`.

## What slipped

In the spirit of an honest write-up, the team logged the following slips:

- Persistent ranking math never landed. The leaderboard is real-time only.
- The replay viewer is a half-built tool. The deterministic seed-plus-inputs guarantee is real, but no UI consumes it yet.
- The voice-channel moderation gap (see the risk list in the prescriptive plan) was identified late and not closed inside the sprint.
- Spectator mode reached a working prototype on Day 12 but did not get its own polish pass before the beta cut.
- The Android Unity client is on the wish list, not the shipped list.
