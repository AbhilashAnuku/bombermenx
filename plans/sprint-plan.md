# Sprint Plan — Bomber Man X

Two-week sprint, eight weeks total (six weeks of build). Day 1 is 2026-05-08. The day-by-day rows below mirror the ownership table in the project README and expand each row into a concrete deliverable, a definition-of-done line, and the upstream dependencies that have to be in place before the day starts.

The three architects are Abhilash Anuku (AA), Simranjot Kaur (SK), and Jithendra Chittomothu (JC). The "engineering hat" rotation is shown in the Owner(s) column alongside the architect on point for that day.

## Day-by-day plan

| Day | Date | Owner(s) | Deliverable | Definition of done | Dependencies |
|-----|------|----------|-------------|--------------------|--------------|
| 1 | 2026-05-08 | AA | Analysis, planning, project poster, repository scaffolding | Four planning artefacts in `deliverables/plans` merged; poster in `deliverables/presentation`; empty multi-module Maven project builds green; decision log opened. | None. |
| 2 | 2026-05-09 | AA + Architecture hat (SK) | Multi-module Maven layout, module boundary contracts, initial `GameConfig` | `bomb-core`, `bomb-server`, `bomb-client` exist as Maven modules; `mvn verify` green at the parent; `GameConfig` constants frozen and reviewed. | Day 1 scaffolding. |
| 3 | 2026-05-10 | AA + Architecture hat (JC) | Docker Compose dev stack, CI skeleton, secrets plan | `docker compose up` brings Postgres, Redis, and a stub server online; `.github/workflows/ci.yml` runs `mvn verify` on push; secrets documented in the decision log. | Module skeleton from Day 2. |
| 4 | 2026-05-11 | Backend hat (JC) + Gameplay hat (SK) | `bomb-core` deterministic sim reaches parity with spec | `GameWorld` ticks at 60 Hz deterministically; replay-from-seed test passes; `MessageType` enum frozen and reviewed by all three architects. | `GameConfig` from Day 2. |
| 5 | 2026-05-12 | Backend hat (JC) + Gameplay hat (SK) | `bomb-server` Netty + WebSocket entry point, first end-to-end loop | `BombServerApplication` starts; `WebSocketServer` accepts a connection; `MatchManager` allocates a `MatchSession`; one bot client completes a round-trip. | `bomb-core` from Day 4. |
| 6 | 2026-05-13 | AI hat (AA) + Physics hat (SK) | Bomb chain reactions, pickup spawn tables | Chain-reaction test suite green; pickup tables match design doc; deterministic replays still pass. | Server loop from Day 5. |
| 7 | 2026-05-14 | AI hat (AA) + Physics hat (SK) | Baseline bot policy, eight-player FFA stable | Bot avoids bombs and grabs pickups; eight-bot FFA match completes without desync; integration test exercises the path. | Day 6 work merged. |
| 8 | 2026-05-15 | UX hat (SK) + UI hat (AA) | JavaFX `ClientLauncher`, `SceneRouter`, age gate | Client launches; age gate gates entry; routes between menu, lobby, and arena scenes; connects to local server. | Server stable from Day 7. |
| 9 | 2026-05-16 | UX hat (SK) + Motion hat (JC) | Tron HUD, `ArenaRenderer` shipping shape | HUD shows health, bombs, pickups, timer; renderer holds 60 FPS on the reference machine; gamepad input through JInput working. | `ClientLauncher` from Day 8. |
| 10 | 2026-05-17 | UI hat (AA) + Motion hat (JC) | Particle layer, scanline shader, polish pass | Particles fire on bomb, pickup, and death events; scanline shader toggleable; visual regression screenshots captured. | HUD and renderer from Day 9. |
| 11 | 2026-05-18 | QA hat (AA) | Unit and integration suites green across all modules | Coverage above the agreed floor on `bomb-core`; integration suite covers connect, play, disconnect; CodeQL clean. | Client feature-complete from Day 10. |
| 12 | 2026-05-19 | QA hat (AA) | Performance tuning, nightly soak, security scan | `loadtest.py` with 256 bots runs for one hour without leaks; p99 RTT under 100 ms same-region; CodeQL re-run clean. | Day 11 suites passing. |
| 13 | 2026-05-20 | DevOps hat (JC) | Cloud Run deploy, signed release artefacts | `deploy-cloudrun.yml` deploys a tagged build; `release.yml` produces a signed artefact; `nightly.yml` scheduled and green. | Day 12 quality bar met. |
| 14 | 2026-05-21 | Delivery Lead hat (AA) | Beta release announcement, share-link script, demo recording | Announcement published; share-link script invites a guest into a live match; demo recording captured for the war-room dashboard. | Day 13 deploy live. |

## Daily ceremonies

- 09:00 IST — 15-minute morning standup. Three questions: what shipped yesterday, what ships today, what is blocked. Camera on. No laptop screens shared.
- 17:00–18:00 IST — merge window. All reviews finalised in this hour. Builds green at the end of it. Nothing merges after 18:00 except hotfixes.
- 18:00 IST — 5-minute end-of-day demo to the other two architects. The owner of the day shows the deliverable running. Two architects sign off or call out a defect.
- Friday end-of-week — integration day. The day's build window is shorter; the integration window is longer. Main must be green at end-of-day Friday.

## Decision points

Architecture-level sign-off from all three architects was expected on the following days. Each of these touched a module boundary or a long-lived contract.

- Day 2 — multi-module Maven layout and module boundaries.
- Day 3 — Docker Compose stack, secrets handling, CI shape.
- Day 4 — `MessageType` enum freeze. This is the single most consequential decision point in the sprint.
- Day 5 — `MatchManager` and `MatchSession` lifecycle contract.
- Day 8 — `SceneRouter` contract and age-gate placement.
- Day 11 — definition-of-done for the pre-beta gate.
- Day 13 — Cloud Run deployment shape, rollback procedure, release-signing trust chain.

Sign-off lands in the decision log on the same day. A missed sign-off blocks the next day's merge window.

## Risk burndown

Top five risks tracked across the sprint. Status is set on Day 1, reviewed every Friday, and closed by Week 8.

| Risk | Day 1 | Day 5 | Day 10 | Week 8 | Owner | Mitigation |
|------|-------|-------|--------|--------|-------|------------|
| Cloud Run cold-start latency above target | Amber | Amber | Amber | Green | JC | Min-instances=1 on the production revision; warm path exercised by the nightly soak. |
| Deterministic replay drift in `GameWorld` | Amber | Green | Green | Green | SK | Seed-plus-inputs test in CI; failures block merge. |
| Free-tier quota burn (Cloud Run, Postgres, Actions minutes) | Green | Amber | Amber | Amber | JC | Weekly burn projection; alarms at 70 percent of monthly cap. |
| Dependency CVEs surfaced late | Amber | Amber | Green | Green | AA | CodeQL on every push; Dependabot weekly triage on Mondays. |
| Voice-channel moderation gap on launch | Red | Red | Red | Red | AA | Voice deferred to next sprint; documented as a launch blocker for any voice rollout. |

A risk that is red on Week 8 is not a failure — it is a documented carry-over into the next sprint. The voice-channel risk is the only one in that state at the end of the founding sprint.

## Notes for the next sprint

- The Day 4 `MessageType` freeze deserves to be moved earlier. If the wire is locked on Day 3, the integration tests on Days 5–7 are cleaner.
- The Day 10 polish pass crowded against the Day 11 QA gate. Either shorten the polish pass or extend the QA window.
- The Day 13 deploy day depended on the rollback procedure being rehearsed earlier. Move a rollback rehearsal to Day 7 next time.
- The Week 8 demo benefited from the war-room dashboard. Treat the dashboard as a Day 1 deliverable in the next sprint, not a Week 8 one.
