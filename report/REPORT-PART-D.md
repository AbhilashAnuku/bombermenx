## Chapter 20 — Privacy, Safety and Compliance

BomberMen-X is a real-time multiplayer game that, in its v1 beta form, intentionally collects the smallest set of personal data that is compatible with offering authenticated sessions, fair matchmaking, and basic moderation. The team treats privacy and safety as a design constraint rather than a documentation exercise, and every wire-protocol message in Appendix B was reviewed against the three companion documents in `docs/`: `PRIVACY.md`, `TERMS.md`, and `COMPLIANCE.md`. A fourth document, `docs/SAFETY.md`, captures the operational rules — age gate, profanity filter, voice channel — and is referenced from both the client and the moderator runbook.

### 20.1 Data the platform collects

At v1 the server stores only what is required to make a session work and to act on a moderation report. The categories are:

- **Display name.** A short, profanity-filtered string chosen by the player. Stored in plaintext because it appears in the kill feed and the lobby.
- **Hashed OAuth subject.** When a player signs in with Google, the server keeps the SHA-256 of the OAuth `sub` claim and the issuer (`accounts.google.com`). The original token is discarded after `AUTH_RESULT`.
- **Gameplay events.** Match metadata (arena, mode, duration, score) and per-tick event totals (bombs placed, kills, deaths). Individual `INPUT` packets are not persisted past the snapshot ring buffer.
- **Chat messages.** Lobby and in-match chat are logged with author, timestamp, and channel for moderation. Voice frames are never recorded; they are relayed as opaque bytes.
- **Operational telemetry.** RTT, packet loss, and dropped-frame counts, used for capacity planning. These rows carry only the hashed account id, never the display name.

### 20.2 Data the platform deliberately does not collect

The team made an explicit decision early in the project to avoid collecting categories that would expand the regulatory footprint without adding value to the beta:

- No real names, postal addresses, or phone numbers.
- No payment data; there is no monetization at v1, and no in-app purchase plumbing exists in `bomb-client`.
- No precise geolocation. The matchmaker uses only the coarse region returned by Cloud Run.
- No biometric data, contacts, or device-identifier scraping.
- No third-party advertising SDKs in the desktop client.

### 20.3 Retention

Retention windows were chosen to balance moderation needs against the principle of data minimization:

| Data class | Window | Reason |
|---|---|---|
| Chat messages | 7 days | Long enough for a moderator to action a report; short enough that backlogs cannot accumulate. |
| Gameplay events | 30 days | Required for weekly balance review and anti-cheat heuristics. |
| Account record | Until deletion request | Required to keep a stable display name. |
| Crash logs | 14 days | Long enough for triage; aggregated daily. |
| Voice frames | Not stored | Relayed only; held only in the JVM heap. |

Retention is enforced by a nightly job that runs `DELETE` statements against PostgreSQL and emits a row count to the operations channel.

### 20.4 COPPA stance

The team treats COPPA seriously because Bomberman-style games attract under-13 players. The first time a client launches it shows an age-class gate that yields one of three states: `unknown`, `under_13`, or `13_plus`. The `under_13` class disables voice chat, hides the chat panel, disables friend-code search, and forces an opaque display name (`Player-####`). The age class is stored locally and on the server, and cannot be raised without account recovery. The team does not market BomberMen-X to children under 13 and the website carries the standard disclaimer in `docs/PRIVACY.md`.

### 20.5 GDPR data-subject rights

At v1, export and deletion requests are handled manually through a support email listed in `docs/PRIVACY.md`. The runbook is:

1. Verify the requester controls the account by sending a one-time challenge to the OAuth provider.
2. Run a packaged script that joins the account, chat, and event tables and emits a JSON archive.
3. For deletion, run a transactional script that anonymizes events (replaces account id with a stable random token) and deletes account and chat rows.

V1.5 introduces a self-service admin tool that wraps the same scripts behind a signed URL, eliminating manual handling and shortening the deadline well below the 30-day GDPR target.

### 20.6 Play Console mapping

When the Unity Android client ships in V2, the team must complete the Play Console data-safety section. `docs/COMPLIANCE.md` carries a row-by-row mapping from each Play Console category to the actual fields in the BomberMen-X schema, so the form can be filled without rediscovery. The mapping uses the same language Play Console uses: "Personal info — Name (collected, encrypted in transit, deletable)", "App activity — In-app actions (collected, encrypted in transit, kept 30 days)", and so on.

### 20.7 Voice channel rules

Voice is intentionally a narrow feature at v1. The server relays opaque Opus frames between the four humans in a match and never decodes them. The client shows a persistent banner on the first three voice sessions warning the player that conversations are not recorded but can be reported, that the mute button is a hard mute that drops frames before the speaker output, and that voice is disabled entirely for `under_13` accounts.

### 20.8 Reporting flow

The reporting flow is a single straight line and is deliberately easy to invoke from the in-match HUD:

1. Player taps the report button next to a kill-feed entry or the chat panel.
2. The client builds a ticket containing the offender's account id, the channel, and the last 20 chat lines.
3. The server inserts the ticket into the moderator queue (a `tickets` table).
4. A moderator opens a Compose-built console, reviews the context, and applies one of: warning, 24-hour mute, 7-day suspension, or permanent ban.
5. The outcome is written back to the ticket and to an audit table.

### 20.9 Compliance status

The current state of each obligation is tracked in a small table that the team keeps in `docs/COMPLIANCE.md`:

| Obligation | Status at v1 | Owner | Closing milestone |
|---|---|---|---|
| Privacy policy published | Done | AA | n/a |
| Terms of service published | Done | AA | n/a |
| Age gate in client | Done | SK | n/a |
| Profanity filter | Done | JC | n/a |
| Voice opt-out | Done | SK | n/a |
| Self-serve export/delete | Manual at v1 | AA | V1.5 admin tool |
| Play Console data safety | Mapped, not filed | AA | V2 Android |
| Cookie banner on web client | Done | SK | n/a |
| Incident response runbook | Done | AA (DevOps hat) | n/a |
| External privacy review | Open | AA | Pre-V2 |

## Chapter 21 — Coordination and Team Process

A three-person team that is also a three-architect team needs explicit process or it falls into one of two failure modes: everyone touches everything (and the codebase loses coherence), or one architect quietly becomes the bottleneck for every decision. The team built the process below to avoid both.

### 21.1 The three-architect rule

Any change that crosses module boundaries — for example, a new field in a `MessageType` payload that touches both `bomb-server` and `bomb-client`, or a schema change in `bomb-core` that touches both servers — requires sign-off from at least two of the three architects (AA, SK, JC). Within-module changes need only the module owner's sign-off. The rule is enforced by a CODEOWNERS file in the repository and by a pull-request template that asks the author to list which modules the diff touches.

The team chose "two of three" rather than "all three" because the architects are also the engineers, and gating every cross-module change behind unanimous approval would have collapsed velocity to zero. Two out of three has worked: when the third architect later disagrees, the decision is revisited at the Friday architecture review, but the work is not blocked in the meantime.

### 21.2 Daily standup

The team runs a 15-minute standup at 09:30 every weekday. The format is the standard yesterday/today/blockers triple, but with one rule borrowed from the project's QA discipline: any blocker that has been on the board for more than three days becomes a Friday agenda item automatically. Standups are video for two of the three architects and audio-only for the third, who is sometimes commuting.

### 21.3 Async decision log

Decisions that affect more than one module are written to a markdown file in `studio/` with a stable naming scheme: `DECISION-YYYYMMDD-<slug>.md`. Each file has four sections — Context, Options considered, Decision, Consequences — and a single owner. The decision log has two effects. First, it forces the team to write the rationale at the moment of the decision rather than reconstructing it later. Second, it makes onboarding a future maintainer plausible: a reader can walk the log chronologically and understand why the system looks the way it does. Examples include the choice of JSON over a binary wire codec at v1, the choice of JavaFX over a web-only client, and the decision to keep the deterministic core in pure Java rather than Kotlin.

### 21.4 Weekly architecture review

Every Friday at 16:00 the three architects meet for a 60-minute architecture review. The agenda is fixed: outstanding decision logs, blockers carried from standups, incident retrospectives if any, and a 10-minute "future" slot to discuss V2 and beyond. The review is the only place where the team is allowed to argue about the long-term shape of the system; outside of Friday the conversation stays close to the week's work. Notes are written into a running `studio/REVIEWS.md` file.

### 21.5 Conflict resolution

The team uses a deliberately simple escalation: debate, then vote. If a 1-1-1 vote arises (which has happened twice in the project), the architect carrying the Delivery Lead hat (AA at v1) facilitates the tie-break, but only after the loser of the debate is given the chance to summarize the other side's argument. The "summarize the other side" step is borrowed from the engineering literature on consensus and consistently shortens the disagreement. The Delivery Lead has used the tie-break twice: once to keep the JSON wire codec at v1 against JC's preference for binary, and once to keep scanline shaders enabled by default against SK's preference for off.

### 21.6 Incident retrospectives

When an incident occurs — for example, the Cloud Run quota event captured in `studio/INCIDENTS/INC-20260507-01.md` — the team writes a retrospective within 48 hours. The template has five sections: Timeline (UTC), Root cause, Contributing factors, Action items, and Owners. Action items are required to be small, specific, and owned. The team has so far written three incident files, all linked from the runbook in `docs/COMPLIANCE.md`.

### 21.7 Escalation path

The escalation path is short because the team is small: engineer hat → architect lead for the affected module → Delivery Lead. Architect leads are AA for the platform and protocol surface, SK for the client and content pipeline, and JC for gameplay and bots. The Delivery Lead is the final internal escalation point; the next step beyond is the academic supervisor, who is consulted on academic deliverables but not on engineering decisions.

### 21.8 Tooling

The team uses a small toolset deliberately. GitHub Issues + Projects track work. GitHub Discussions is the home for design proposals that have not yet become decision logs. Pull requests are gated by CI (build, unit tests, CodeQL). Voice happens over a single Discord server with channels mirroring the modules. There is no project management tool beyond GitHub; the team experimented with one and found that the overhead exceeded the benefit at this size.

### 21.9 Ritual table

| Ritual | Cadence | Length | Participants | Output |
|---|---|---|---|---|
| Standup | Daily, 09:30 | 15 min | All | Verbal blockers |
| End-of-day demo | Daily, 17:30 | 5 min | All | Screen recording |
| Architecture review | Friday, 16:00 | 60 min | Three architects | `REVIEWS.md` entry |
| Sprint planning | Monday of each week | 30 min | All | Issue assignment |
| Retrospective | End of each two-week block | 45 min | All | Action items |
| Incident review | On trigger | 30 min | All + on-call | `INC-*.md` file |

## Chapter 22 — Role Contributions in Detail

Although the team is three people, the codebase carries thirteen role bibles in `studio/ROLES/`. The bibles describe the discipline rather than the headcount: the three architects rotate through them as the work demands. The mapping table below shows which architect carried each hat at v1 and which module(s) the role primarily touched.

| Role | Owner | Module(s) |
|---|---|---|
| Delivery Lead | AA | All (coordination, schedule, releases) |
| UX Director | SK | bomb-client |
| Gameplay Director | JC | bomb-core, bomb-server |
| Architecture Engineer | AA | bomb-core, bomb-server, bomb-client |
| Backend Developer | AA | bomb-server |
| DevOps Engineer | AA (with JC on CI) | infra, CI |
| UI Designer | SK | bomb-client |
| Frontend Developer | SK | bomb-client |
| Motion Artist | SK | bomb-client (FX) |
| Gameplay Engineer | JC | bomb-core |
| AI Engineer | JC | bomb-server (bots) |
| Physics Engineer | JC | bomb-core |
| QA Lead | All (rotating) | tests across all modules |

### 22.1 Delivery Lead (AA)

The Delivery Lead hat sat with AA throughout the programme. The role is captured in `studio/ROLES/CEO_AA.md` (kept under its legacy file name for archival continuity) and is mostly non-engineering: it carries scope decisions, schedule, external communication, and the final tie-break. AA's notable decisions in this hat were keeping v1 JSON-only on the wire to compress the schedule, scoping voice to relay-only so the team could ship without a separate moderation stack, and choosing Cloud Run over Kubernetes for v1 to keep the operational surface small. AA also owned the academic deliverables: the four-part report, the demo video plan, and the viva-defense outline.

### 22.2 UX Director (SK)

SK carried the UX Director hat across the whole client, with `studio/ROLES/UX_DIRECTOR_SK.md` as the reference document. The work that shipped includes the lobby flow, the warmup screen, the in-match HUD, the kill feed, and the post-match screen. SK's notable decisions were the tap-to-step movement model (the player taps a direction and the avatar moves one tile, with hold-to-repeat), the dark Neon Plaza palette inherited from the Tron visual brief, and the choice to make the scanline shader on by default but discoverable as a toggle. SK also drove the color-blind palette pass after a v0.3 playtester reported red/green confusion.

### 22.3 Gameplay Director (JC)

JC carried the Gameplay Director hat (`studio/ROLES/GAMEPLAY_DIRECTOR_JC.md`) and was the final authority on every constant in `GameConfig` and every rule in `GameWorld`. JC shipped the FFA, KING_OF_GRID, and CAPTURE modes, the super-ability system (Nuke, Dash, Mine, Shield, Phase), and the bot ladder. Notable decisions were the 150-tick bomb fuse (chosen after twenty rounds of playtesting between 90 and 180), the 0.40 destructible density (any higher and bots dominated; any lower and matches stalled), and the 3-token cost for Nuke (low enough that it appeared in most matches, high enough that it was a choice).

### 22.4 Architecture Engineer

The Architecture Engineer hat is shared but primarily worn by AA, with `studio/ROLES/ARCHITECTURE_ENGINEER.md` as the reference. The role shipped the module split (bomb-core, bomb-server, bomb-client), the Maven multi-module layout, the `MessageType` enum and envelope shape, and the deterministic-core contract that lets the same `GameWorld` class run on both the server (authoritative) and the client (prediction). Notable decisions were keeping bomb-core dependency-free so it could later be ported to other JVMs and forbidding any direct field access on the world model from outside the module.

### 22.5 Backend Developer

AA carried the Backend Developer hat (`studio/ROLES/BACKEND_DEVELOPER.md`). The deliverable was the `bomb-server` module: the Netty WebSocket pipeline, the matchmaker, the per-room tick loop, the bot loop, the chat relay, the voice relay, and the PostgreSQL persistence layer. Notable decisions were running the server tick on a single-threaded executor per room (avoiding cross-room contention), using Jackson with a fixed `ObjectMapper` configuration, and putting an `IdleStateHandler` in the pipeline to evict disconnected clients without polling.

### 22.6 DevOps Engineer

The DevOps hat sat with AA, with JC contributing to CI for the gameplay test matrix. The reference document is `studio/ROLES/DEVOPS_ENGINEER.md`. Deliverables include the Docker images for server and dev-stack, the GitHub Actions workflow that builds, tests, runs CodeQL, builds the image, and pushes to Artifact Registry, the Cloud Run service definition, and the Cloud SQL Postgres instance. Notable decisions were running the GitHub Actions matrix on Linux only (Windows runs locally for the desktop client team but not in CI) and keeping the Compose stack in the same repo so a contributor can `docker compose up` and have a full local environment.

### 22.7 UI Designer

SK carried the UI Designer hat (`studio/ROLES/UI_DESIGNER.md`). The work was the visual language: the Tron-inspired neon palette, the typography stack (Inter for UI, JetBrains Mono for HUD numerics), the iconography for power-ups and abilities, and the responsive layout rules for the lobby. Notable decisions were committing to a single grid (8 px) for every UI surface, baking the glow effect into the assets rather than running a real-time bloom shader (cheaper on low-end hardware), and producing a small icon library that the v2 Unity client can reuse.

### 22.8 Frontend Developer

SK also carried the Frontend Developer hat (`studio/ROLES/FRONTEND_DEVELOPER.md`). The deliverable was the JavaFX desktop client and the thin WebSocket web client used for spectating. SK wrote the rendering loop, the input layer (keyboard, mouse, JInput gamepad), the lobby scene, the in-match scene, the warmup scene, and the post-match scene. Notable decisions were keeping the rendering loop separate from the network loop (the renderer reads a triple-buffered snapshot, never blocks on the network) and using JInput for gamepad rather than a JavaFX-native abstraction because JInput has better Linux coverage.

### 22.9 Motion Artist

SK carried the Motion Artist hat (`studio/ROLES/MOTION_ARTIST.md`). The work was the FX layer: bomb-place pulses, fuse flash, explosion stages, glow trails on dashes, hit shake, kill-feed slide-in, and the post-match camera dolly. Notable decisions were running every FX as a tween over fixed-tick counts (so they remain deterministic-replayable when the replay tool ships in V1.5) and making the haptic events match the FX timeline so a gamepad rumble lines up with the visual.

### 22.10 Gameplay Engineer

JC carried the Gameplay Engineer hat (`studio/ROLES/GAMEPLAY_ENGINEER.md`). The deliverable was the deterministic core: `GameWorld`, `Tile`, `Bomb`, `Player`, `PowerUp`, `EventBus`. JC wrote the tick loop, the movement system, the bomb-explode chain, the pickup logic, and the mode-specific scoring. Notable decisions were one tile per logical step (no sub-tile positions; collisions are trivial), a fixed-size event ring buffer (so per-tick garbage is bounded), and a single `advance(int dt)` entry point for the world.

### 22.11 AI Engineer

JC carried the AI Engineer hat (`studio/ROLES/AI_ENGINEER.md`). The work was the bot ladder: a behavior-tree fill bot at Easy, a utility-AI bot at Medium, and a search-based bot at Hard that performs a bounded BFS over the next 30 ticks. Notable decisions were running every bot on the same tick budget (a bot must respond within one tick, no exceptions) and keeping bot RNG seeded per match (so the same match replays identically).

### 22.12 Physics Engineer

JC carried the Physics Engineer hat (`studio/ROLES/PHYSICS_ENGINEER.md`). Because the game lives on a tile grid the physics surface is small: bomb-blast propagation, soft-wall destruction, chain reactions, and pickup collection. JC's notable decisions were processing blasts in BFS layers (so the visual order matches a wave from the bomb outward) and making chain reactions strictly synchronous within a tick (so the order of triggered bombs is stable across replays).

### 22.13 QA Lead

The QA Lead hat rotates weekly so each architect carries it for one week in three; the role document is `studio/ROLES/QA_LEAD.md`. The deliverables are the unit-test suite (around 240 tests at v1), the integration suite (server + client + bot, around 30 tests), the manual playtest checklist, and the bug-triage discipline. Notable decisions were holding a hard pre-merge bar (no test goes in red) and writing a one-page checklist for the manual playtest so different sessions are comparable.

## Chapter 23 — Risks, Mitigations, and Known Limitations

The risk register is reviewed in the Friday architecture review and updated whenever an incident closes. Each risk is rated by likelihood (Low/Medium/High) and impact (Low/Medium/High). "Status" captures whether the mitigation is in place, in flight, or accepted.

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-1 | Cloud Run free-tier quota exhaustion during a viral spike | Medium | High | Region-scoped budget alerts; auto-scaling cap; warm spare in second region for V3; player-facing "queue full" banner | Mitigated; alert at 60% of monthly budget |
| R-2 | Critical CVE in Netty | Medium | High | Pinned versions; weekly Dependabot run; CodeQL workflow on every PR; documented hotfix playbook | Mitigated |
| R-3 | Critical CVE in Jackson | Medium | High | Same controls as R-2; additional strict-typing on every `readValue` call in `bomb-server` | Mitigated |
| R-4 | Voice channel used for harassment (server cannot inspect frames) | High | Medium | Hard client mute; report-to-moderator flow; visible warning on first three voice sessions; voice disabled for under-13 accounts | Accepted at v1; revisited V2 with on-device speech-to-text moderation |
| R-5 | Age gate is self-declaration, not legal verification | High | Medium | Conservative defaults for `under_13`; voice and chat disabled; opaque names; documented in `docs/SAFETY.md` | Accepted at v1; verified-age provider candidate for V2 |
| R-6 | JSON wire bandwidth at scale | Medium | Medium | Per-room sharding; per-tick budget; bandwidth telemetry; binary protocol planned for V1.5 | Mitigated; binary in flight |
| R-7 | Single-region (eu-west) latency hurts distant players | High | Medium | Region picker at sign-in; warmup buffer absorbs short spikes; multi-region in V3 | Accepted at v1 |
| R-8 | JavaFX gamepad on Linux relies on JInput which is loosely maintained | Medium | Low | Detection fallback to keyboard; JInput shaded into client; Unity client in V2 replaces JInput entirely | Mitigated |
| R-9 | Postgres cold-start on Cloud SQL after idle | Medium | Low | Min-instances=1 on Cloud SQL; matchmaker pre-warms a connection at boot; degraded-mode banner if database is slow | Mitigated |
| R-10 | Profile-picture upload (out of v1 scope) becomes a moderation hole | n/a | n/a | Feature explicitly out of scope at v1; tracked for V1.5 with moderation hooks | Accepted |
| R-11 | Rank-table inflation: no rating decay at v1 | Medium | Low | Display rank only, not absolute; decay added in V1.5 alongside persistent rankings | Accepted |
| R-12 | Bot loop starves the server tick under load | Low | High | Hard 1-tick budget per bot; circuit breaker downgrades to Easy bot if budget is exceeded twice in a row | Mitigated |
| R-13 | Moderation queue grows faster than humans can clear | Medium | Medium | Auto-categorize by report keyword; escalation rules; weekly KPI on time-to-action | In flight |
| R-14 | Repository contains a secret by accident | Low | High | Secret-scanning enabled on the repo; pre-commit hook; quarterly key rotation | Mitigated |
| R-15 | Academic deadline at risk if scope creep continues | Medium | High | Scope freeze 2 weeks before submission (start of week 7 in the 8-week programme); Delivery Lead breaks tie on scope; deliverable checklist in `studio/DELIVERABLES.md` | Mitigated |
| R-16 | Dependency on a single OAuth provider (Google) | Low | Medium | Hashed-sub scheme keeps options open; second provider added in V2 | Accepted |
| R-17 | Replay tooling needs deterministic core to be exact; floating-point in any new code threatens this | Medium | Medium | Core code is integer-only by convention; PR review checks for `double`/`float` | Mitigated |
| R-18 | Anti-cheat at v1 is server-authoritative only; no client attestation | Medium | Medium | Speed and bomb-count caps on the server; statistical detector flags impossible kills/min | Accepted at v1; hardened in V3 |

The team treats "Accepted" risks as risks that the user must be informed about and that we will revisit on schedule. None of the accepted risks would block an academic delivery, but several of them are explicit gates on the V2 launch.

## Chapter 24 — Lessons Learned

The team writes lessons as plain bullets, grouped by the discipline they belong to. The intent is operational, not retrospective: each bullet should change the next decision the team makes.

### 24.1 Engineering lessons

- The deterministic core paid for itself in test value alone. Because `GameWorld.advance(int dt)` is pure given a seed, every gameplay rule is testable without spinning up Netty or JavaFX. The unit-test surface is wider than it would be in a typical multiplayer codebase.
- Tap-to-step movement felt better than continuous movement in playtests, even though the team's initial assumption was that continuous would feel more "modern". The lesson is that the genre's pacing — short steps, frequent decisions — is what makes Bomberman work, and a fluid analogue does not preserve that pacing.
- The Netty pipeline is short and worth owning. Building the WebSocket frame handler, the heartbeat handler, and the dispatch handler from scratch (rather than pulling a framework) cost two days but eliminated an entire class of "magic" debugging.
- The Compose stack for local development was the single biggest productivity win after the first sprint. A new contributor can clone the repo, run one command, and have a working server, database, and Redis on their laptop. The same Compose file is the basis of the integration tests.
- JSON-on-the-wire was the right call for v1. The schedule did not allow for a custom binary codec, and JSON's tooling (curl, browser devtools, jq) made debugging trivial. The cost — roughly 3x the byte size of a careful binary — is acceptable at v1 traffic levels.
- Integer-only arithmetic in the core simplified replay determinism but added subtle friction in places where the team wanted a smooth value (e.g. interpolation of player position on the client). The solution was to do all floating-point work outside the core, in the renderer, where determinism doesn't matter.
- The CodeQL workflow caught two genuine issues in PRs that humans missed. The cost of running it on every PR is small.

### 24.2 Process lessons

- The three-architect rule prevented one-person decisions but cost some velocity. On balance the team would adopt it again, but with the qualifier that within-module changes must remain a single-architect decision; otherwise the rule collapses under its own weight.
- The daily 17:30 end-of-day demo was the single highest-leverage ritual. Five minutes, screen-shared, anything that moved on the day. It surfaced integration problems within hours rather than days, and it reinforced the discipline of leaving the day with something demonstrable.
- The decision log made onboarding the (hypothetical) next team conceptually possible. A new engineer can walk forward in time through the decisions and understand the system as a sequence of constrained choices, not as a finished artefact.
- The scope freeze two weeks before academic submission (start of week 7 in the 8-week programme) was the most important schedule decision the team made. Without it, JC's enthusiasm for super-abilities would have shipped a V1.5 feature inside V1.
- The team underestimated the cost of compliance documents on the first pass. Privacy, terms, safety, and the Play Console mapping took longer to write well than to draft. Future projects should budget engineering time for compliance, not just calendar time.

### 24.3 Product lessons

- Bot fill was the single biggest contributor to perceived liveness in beta. When a player joined a half-empty lobby, the difference between "wait 60 seconds" and "start now with bots, swap them out as humans arrive" was the difference between a player who stayed and a player who closed the client.
- The Tron skin sold the project visually. Playtesters who saw a five-second clip of a match remembered the neon trail more than any gameplay detail. The team should not assume that the gameplay carries the visual identity.
- Scanlines need a toggle. SK was right to make them on by default — they unify the aesthetic — but enough playtesters reported eye fatigue that the toggle had to ship. The lesson is to ship the toggle alongside the default, not later.
- Power-up drop rate (0.40) was the single most-tuned constant. Lower than 0.30 and matches stalled into a wall-breaking grind; higher than 0.50 and the first player to get lucky snowballed. The team's playtest discipline — log the drop, log the win, plot — was worth more than its intuition.
- The kill feed deserved more design attention than it got. A small UI element that every player sees every few seconds is a high-leverage surface. The team should have iterated on it earlier.

## Chapter 25 — Roadmap

The roadmap is reviewed every Friday and re-baselined at the end of each major version. The team uses four versions: V1 (the current beta), V1.5, V2, and V3, with V4 held as exploratory.

### 25.1 V1 — current beta

V1 is the academic delivery for the 8-week capstone programme. Scope is JSON-over-WebSocket, JavaFX desktop client, three modes (FFA, KING_OF_GRID, CAPTURE), bot fill, Google sign-in, lobby chat, voice relay, the Tron-inspired skin. Success criteria for V1 were: ship by end of week 8, demonstrate a four-player match end-to-end, support 50 concurrent matches under load test, pass CodeQL on the main branch, complete the final report. All criteria met.

### 25.2 V1.5 — hardening

V1.5 is the post-academic hardening pass and does not require a new client.

- **Binary wire protocol.** Replace JSON with a compact LEB128-prefixed binary format. Target: 3x to 5x reduction in per-tick bytes. Keeps the `MessageType` enum.
- **Persistent rankings.** Persist a per-mode Elo rating in PostgreSQL with weekly decay. Display rank in lobby and post-match.
- **Replay tooling.** Use the deterministic core's seed + input log to reconstruct a match for playback. Ship a viewer in the JavaFX client.
- **Profile pages.** Avatar (chosen from a curated set, no upload), career totals, recent matches.
- **Mute/report UI.** Replace the v1 text-only flow with a proper modal and an in-client report status view.
- **Admin tool for GDPR.** Self-service export and delete behind signed URL.

Success criteria: binary protocol live in production; replay tool runnable from the JavaFX client; admin tool used to fulfil at least one real GDPR request end-to-end. Dependencies: V1 stable for 4 weeks. Candidate timeline: 3 calendar months after V1 submission.

### 25.3 V2 — Android and ranked

V2 is the first version that requires a new client and a non-trivial server change. The Unity Android client is the headline.

- **Unity Android client.** A clean port of the rendering and input layers. Shares the wire protocol and the asset library with the JavaFX client. Min-spec Android 10.
- **Ranked competitive queue.** A second matchmaker queue with strict skill banding and connection-quality gating. Penalty for early disconnect.
- **Region pinning.** Player picks a home region; matchmaker only matches within region unless the player opts into cross-region in the queue.
- **Verified-age provider (candidate).** Replace self-declared age gate with a verified-age provider in jurisdictions where it is available.

Success criteria: Android client passes Play Console review and ships to internal testers; ranked queue holds a 60-second median match time at 200 concurrent players; cross-region rate stays below 10%. Dependencies: V1.5 binary protocol; second region in production. Candidate timeline: 6 to 9 calendar months after V1.5.

### 25.4 V3 — clustering and tournaments

V3 lifts the operational ceiling and introduces a structured competitive surface.

- **Server clustering across regions.** Multi-region active-active with regional matchmakers and a global lobby presence service.
- **Tournament mode.** Scheduled brackets with seeding from the Elo rating. Spectator slots.
- **Anti-cheat hardening.** Statistical anomaly detector, client-side attestation token, server-side replay diff against expected inputs.
- **Operational maturity.** SLOs, error-budget process, on-call rotation, dashboards beyond the basic Cloud Monitoring view.

Success criteria: two-region cluster stable for 30 days under production load; first sanctioned tournament completed end-to-end with at least 64 entrants; anti-cheat detects and actions a known cheat client within 24 hours. Dependencies: V2 stable. Candidate timeline: 12 calendar months after V2.

### 25.5 V4 — exploratory

V4 is intentionally vague because the team does not yet have evidence for the scope.

- **AR/VR experimentation.** A Quest-class prototype of a single-player Bomberman variant, used to learn what the genre feels like in head-mounted form.
- **WebGL spectator.** A browser-side spectator that joins a match as a read-only client. Built on the same binary protocol as V1.5.
- **Modding surface.** A small declarative format for custom arenas, vetted server-side.

Success criteria for V4 are deliberately weak: ship one prototype, learn one thing, decide whether to invest further. Dependencies: V3 stable. Candidate timeline: not committed.

### 25.6 Cross-version themes

Three themes thread through every version. First, the deterministic core is not allowed to regress: any feature that requires non-determinism must isolate it outside the core. Second, the wire protocol is the contract between modules and is versioned explicitly. Third, the team's "two architects must sign off" rule survives every version of the roadmap, including the ones that involve a much larger team.

## Chapter 26 — References

The team cites primary sources, official project pages, and the standards documents the system relies on. Access date for every entry is 2026-05-22.

1. Netty Project. *Netty — an asynchronous event-driven network application framework*. The Netty Project Contributors. Accessed 2026-05-22.
2. OpenJDK Project. *OpenJFX — the open-source JavaFX project*. Oracle and the OpenJFX Community. Accessed 2026-05-22.
3. JInput Project. *JInput — a library for cross-platform game-controller input on the JVM*. JInput Contributors. Accessed 2026-05-22.
4. FasterXML. *Jackson — high-performance JSON processor for Java*. FasterXML LLC. Accessed 2026-05-22.
5. PostgreSQL Global Development Group. *PostgreSQL — The World's Most Advanced Open Source Relational Database*. PGDG. Accessed 2026-05-22.
6. Redis Ltd. *Redis — the open source, in-memory data store*. Redis Ltd. Accessed 2026-05-22.
7. Fette, I. and Melnikov, A. *RFC 6455 — The WebSocket Protocol*. Internet Engineering Task Force, December 2011. Accessed 2026-05-22.
8. Hudson Soft. *Bomberman game family*. Hudson Soft (later Konami). Cited as genre inspiration only. Accessed 2026-05-22.
9. Lisberger, S. (director). *Tron*. Walt Disney Productions, 1982. Cited as visual inspiration only. Accessed 2026-05-22.
10. Google Cloud. *Cloud Run — fully managed compute platform for containerized applications*. Google LLC. Accessed 2026-05-22.
11. Open Worldwide Application Security Project. *OWASP Top Ten — 2021*. OWASP Foundation. Accessed 2026-05-22.
12. GitHub. *CodeQL documentation*. GitHub Inc. Accessed 2026-05-22.
13. United States Federal Trade Commission. *Children's Online Privacy Protection Rule, 16 CFR Part 312*. FTC. Accessed 2026-05-22.
14. European Parliament and Council. *Regulation (EU) 2016/679 — General Data Protection Regulation*. Official Journal of the European Union, 4 May 2016. Accessed 2026-05-22.
15. Google. *Google Identity — OAuth 2.0 for Server-Side Web Applications*. Google LLC. Accessed 2026-05-22.
16. Bloch, J. *Effective Java*. Addison-Wesley, third edition, 2018. Cited as a general engineering reference. Accessed 2026-05-22.
17. Fowler, M. *Patterns of Enterprise Application Architecture*. Addison-Wesley, 2002. Cited as a general engineering reference. Accessed 2026-05-22.
18. Nystrom, R. *Game Programming Patterns*. Genever Benning, 2014. Cited as a gameplay-engineering reference. Accessed 2026-05-22.
19. Millington, I. *AI for Games*. CRC Press, third edition, 2019. Cited for the bot ladder design. Accessed 2026-05-22.
20. Google Play. *Data safety section for Play Console*. Google LLC. Accessed 2026-05-22.
21. International Organization for Standardization. *ISO/IEC 27001 — Information security management systems*. ISO. Cited as an aspirational target for V3. Accessed 2026-05-22.
22. Internet Engineering Task Force. *RFC 7519 — JSON Web Token (JWT)*. IETF, May 2015. Accessed 2026-05-22.
23. Khronos Group. *OpenGL ES 3.x and Vulkan specifications*. Khronos. Cited for the V2 Android renderer. Accessed 2026-05-22.
24. World Wide Web Consortium. *WebSocket API — W3C Recommendation*. W3C. Accessed 2026-05-22.

## Appendix A — Glossary

The glossary defines terms in the order a reader most likely encounters them and uses the project's vocabulary, not the general industry vocabulary, where the two diverge.

- **Arena.** The rectangular tile grid on which a match is played. Default 15 by 13 tiles.
- **BFS.** Breadth-first search. Used by the deterministic core for blast propagation and by the Hard bot for short-horizon planning.
- **Bot.** A server-side, non-human player. Used to fill lobbies and to serve as a training partner. Three difficulty tiers: Easy, Medium, Hard.
- **Chain reaction.** A bomb whose blast reaches another bomb's fuse tile triggers it within the same tick. Resolved in BFS order from the original detonator.
- **Control point.** A scoring tile in KING_OF_GRID mode. Standing on it accrues score; teleports every 20 seconds.
- **Decision log.** A markdown file in `studio/` that captures Context, Options, Decision, Consequences for one cross-module decision.
- **Delivery Lead.** The architect carrying the schedule, scope, and external-communication hat. AA at v1.
- **Deterministic core.** The `bomb-core` module. Pure-Java, integer-only, no I/O, no clocks. Same seed plus same input produces the same world state.
- **Envelope.** The JSON object that wraps every wire message: type, sequence, timestamp, payload.
- **FFA.** Free-for-all. Last-player-standing mode.
- **Fuse.** The countdown a bomb runs after placement. Default 150 ticks (2.5 seconds at 60 Hz).
- **Ghost.** A spectator-mode camera that can move freely over the arena.
- **Glow trail.** The neon afterimage drawn behind a player who has used the Dash ability.
- **HUD.** The head-up display: score, ability charges, kill feed, ping.
- **IdleStateHandler.** A Netty handler that fires events when a channel has been idle for a configured duration. The server uses it to evict disconnected clients.
- **JInput.** A JVM library that exposes gamepads on Windows, macOS, and Linux. Used by the JavaFX client.
- **Kill feed.** A scrolling text element that shows recent kills, formatted as "killer → victim".
- **KING_OF_GRID.** The control-point mode. First player to 30 points wins.
- **LEVELS.** A small format for declarative arena definitions, used by the level pack.
- **Lobby.** The pre-match scene where players gather, pick characters, ready up, and chat.
- **Matchmaker.** The server component that pairs players into rooms based on mode, region, and (in V2) skill band.
- **MessageType.** The enum of every legal wire message. See Appendix B.
- **Neon Plaza.** The default visual skin: dark background, neon-cyan grid, magenta accents.
- **Pickup.** A consumable item that drops when a destructible wall breaks. See power-up.
- **Power-up.** A pickup that modifies a player attribute: +1 max bomb, +1 blast radius, +1 speed, etc.
- **ProfanityFilter.** A server-side class that scans chat and display names for blocked terms.
- **RTT.** Round-trip time. Measured on every PING/PONG pair.
- **Scanline.** A horizontal-stripe shader effect that gives the rendered scene a CRT look. Default on, toggle available.
- **Seed.** A 64-bit integer that initializes the match's random number generator. Logged at MATCH_START so replays are exact.
- **Server-authoritative.** The server, not the client, decides what is real. Clients send INPUT; the server emits SNAPSHOT.
- **Session.** A single connected client. Spans from HELLO to disconnect.
- **Snapshot.** A per-tick world state delta sent from server to client. The payload of a SNAPSHOT message.
- **Soft wall / hard wall.** Soft walls are destructible and may drop pickups. Hard walls are indestructible and form the grid skeleton.
- **Sudden death.** A late-match rule where the arena shrinks tile-by-tile from the outside.
- **Tap-to-step.** The movement model. A tap moves the avatar one tile; holding repeats at the player's move-speed limit.
- **Three-architect rule.** Any cross-module change requires sign-off from at least two of AA, SK, JC.
- **Tick.** One simulation step. The server runs 60 ticks per second.
- **Tile.** The unit cell of the arena grid.
- **Token.** A super-ability resource. Drops from destructible walls at a 6% rate. Spent on Nuke (3), Dash (1), etc.
- **Warmup.** A short pre-match countdown during which players can move but not place bombs.
- **WebSocket.** The transport layer for the wire protocol. RFC 6455.
- **Wire codec.** The encoder/decoder that converts MessageType envelopes to and from bytes. JSON at v1; binary planned for V1.5.
- **World snapshot.** A complete dump of arena state. Used at MATCH_START and as a periodic keyframe.

## Appendix B — Wire Protocol Reference

The wire protocol is the contract between every client and the server. It is the most-versioned surface in the system after the `GameWorld` API.

### B.1 MessageType table

The MessageType enum is split into two families: the **match** family carries gameplay traffic between the client and a per-room match server; the **lobby** family carries non-gameplay traffic between the client and the global lobby server.

| Name | Direction | Payload (field list) | Producer | Consumer | Trigger |
|---|---|---|---|---|---|
| HELLO | C → S | clientVersion, platform, locale | client | match server | First frame after WebSocket open |
| AUTH | C → S | oauthIdToken (Google) | client | match server | After WELCOME |
| JOIN_LOBBY | C → S | lobbyId, mode | client | match server | Player picks a lobby |
| LEAVE_LOBBY | C → S | — | client | match server | Player exits lobby |
| READY | C → S | ready (bool) | client | match server | Player toggles ready |
| INPUT | C → S | tick, seq, axis (N/E/S/W/none), actions (place, ability) | client | match server | Every tick or on change |
| ABILITY | C → S | abilityId, tick | client | match server | Player invokes super-ability |
| CHAT | C↔S | channel, text | client / server | server / clients | Chat send / broadcast |
| VOICE_FRAME | C↔S | speakerId, opusFrame (bytes) | client | clients (via relay) | Voice activity |
| PING | C → S | clientTs | client | match server | Heartbeat (every 1s) |
| WELCOME | S → C | sessionId, serverVersion, region | match server | client | First frame after HELLO |
| AUTH_RESULT | S → C | accountId (hashed), displayName, ageClass | match server | client | After AUTH |
| LOBBY_STATE | S → C | players[], mode, readyMask | match server | clients | Lobby membership change |
| MATCH_START | S → C | seed, arena, modeConfig, players[] | match server | clients | Countdown completes |
| SNAPSHOT | S → C | tick, delta (entities, walls, pickups, scores) | match server | clients | Every tick |
| EVENT | S → C | tick, kind, payload | match server | clients | Discrete gameplay event |
| KILL_FEED | S → C | killerId, victimId, weapon, tick | match server | clients | Player death |
| HAPTIC | S → C | kind, intensity, durationMs | match server | client | Aligned to FX |
| MATCH_END | S → C | winnerId, scoreboard, replayId | match server | clients | Win condition met |
| PONG | S → C | clientTs, serverTs | match server | client | Reply to PING |
| ERROR | S → C | code, message, retry (bool) | match server | client | Protocol or auth failure |
| LOBBY_HELLO | C → S | clientVersion, accountId | client | lobby server | Lobby open |
| LOBBY_MOVE | C → S | lobbyId | client | lobby server | Switch lobby |
| LOBBY_BUY | C → S | itemId | client | lobby server | Cosmetic purchase (V1.5+) |
| LOBBY_EQUIP | C → S | itemId, slot | client | lobby server | Cosmetic equip |
| LOBBY_WELCOME | S → C | accountId, currency, owned[] | lobby server | client | Reply to LOBBY_HELLO |
| LOBBY_SNAPSHOT | S → C | lobbies[], onlineCount | lobby server | client | Lobby roster change |
| LOBBY_ERROR | S → C | code, message | lobby server | client | Lobby failure |

### B.2 Envelope shape

Every wire message is a JSON object with four reserved top-level keys: `t` (type, string), `s` (sequence, int), `ts` (sender timestamp, int ms), and `p` (payload, object). Reserving exactly these keys keeps the envelope cheap to parse and lets the server route by `t` without parsing `p`.

### B.3 Framing

Frames are WebSocket text frames at v1. The server enforces a 16 KB maximum frame size; messages larger than this are split at the application layer with a continuation flag. In practice only the initial `MATCH_START` (which carries the full arena) approaches the limit, and it is well below it.

### B.4 Versioning

The protocol version is carried in two places: the `clientVersion` field on `HELLO` and the `serverVersion` field on `WELCOME`. Major version mismatch closes the connection with an `ERROR(code=PROTOCOL_VERSION)`. Minor version mismatch is logged but allowed; the server's policy is to add fields, never remove or repurpose them.

### B.5 Planned binary path

V1.5 replaces the JSON envelope with a binary envelope built around a fixed 5-byte header (type 1 byte, sequence 2 bytes, length 2 bytes) followed by a LEB128-encoded payload. The MessageType integer values are stable across formats so a client can sniff the first byte and decide. The binary path is a strict superset: any message that can be expressed in JSON can be expressed in binary with the same field names.

### B.6 Example envelopes

```json
// INPUT
{"t":"INPUT","s":4821,"ts":1716391012345,
 "p":{"tick":18432,"seq":4821,"axis":"E","actions":["place"]}}
```

```json
// SNAPSHOT (truncated)
{"t":"SNAPSHOT","s":18432,"ts":1716391012360,
 "p":{"tick":18432,
      "delta":{
        "players":[{"id":"p1","x":6,"y":4,"hp":1,"bombs":1,"power":3},
                   {"id":"p2","x":9,"y":7,"hp":1,"bombs":2,"power":4}],
        "bombs":[{"id":"b17","x":6,"y":4,"fuse":140,"power":3}],
        "pickups":[{"id":"u3","x":3,"y":2,"kind":"POWER"}],
        "scores":{"p1":2,"p2":1}}}}
```

```json
// KILL_FEED
{"t":"KILL_FEED","s":1287,"ts":1716391023100,
 "p":{"killerId":"p1","victimId":"p3","weapon":"BOMB","tick":19890}}
```

```json
// LOBBY_SNAPSHOT
{"t":"LOBBY_SNAPSHOT","s":612,"ts":1716391023990,
 "p":{"onlineCount":214,
      "lobbies":[
        {"id":"L-31","mode":"FFA","arena":"NeonPlaza","seats":4,"taken":3},
        {"id":"L-32","mode":"KING_OF_GRID","arena":"NeonPlaza","seats":4,"taken":4},
        {"id":"L-33","mode":"CAPTURE","arena":"NeonPlaza","seats":4,"taken":2}]}}
```

### B.7 Sequencing and retransmission

The protocol does not retransmit application messages. WebSocket runs over TCP, which gives ordered delivery within a connection. When a client reconnects mid-match, the server replays the last full snapshot followed by the most recent delta; the client then catches up from there. Sequence numbers on `INPUT` and `SNAPSHOT` exist to detect server-side gaps and to align replay tooling.

### B.8 Error model

The `ERROR` envelope carries a stable string code (e.g. `AUTH_INVALID`, `PROTOCOL_VERSION`, `ROOM_FULL`, `RATE_LIMITED`) and a human-readable message. The `retry` flag tells the client whether reconnecting is meaningful. Clients are required to honor `retry=false` and back off; the server logs ignored backoffs and may temporarily ban the source IP.

## Appendix C — Module-by-Module File Inventory

The team keeps each Java source file annotated with its role in the system. The list below is grouped by module and uses the production package paths.

### C.1 `bomb-core`

- `core/GameWorld.java` — the deterministic world state and the `advance(int dt)` entry point.
- `core/Tile.java` — enum and helpers for empty / soft / hard / pickup tiles.
- `core/Bomb.java` — bomb entity: position, owner, fuse, power.
- `core/Player.java` — player entity: position, hp, max bombs, blast power, speed, tokens.
- `core/PowerUp.java` — pickup entity and effect application.
- `core/EventBus.java` — fixed-size ring of per-tick events emitted by the world.
- `core/Arena.java` — tile grid model with seedable generator.
- `core/RNG.java` — deterministic random number generator wrapper.
- `core/GameConfig.java` — public constants (tick rate, defaults).
- `core/Mode.java` — interface for game modes.
- `core/modes/FreeForAll.java` — last-player-standing implementation.
- `core/modes/KingOfGrid.java` — control-point implementation.
- `core/modes/Capture.java` — capture-the-token implementation.
- `core/abilities/Ability.java` — base interface for super-abilities.
- `core/abilities/NukeAbility.java` — arena-wide cleanse.
- `core/abilities/DashAbility.java` — two-tile teleport.
- `core/abilities/MineAbility.java` — proximity-triggered bomb.
- `core/abilities/ShieldAbility.java` — one-blast immunity.
- `core/abilities/PhaseAbility.java` — temporary wall-pass.
- `core/replay/InputLog.java` — append-only log of player inputs for replay.

### C.2 `bomb-server`

- `server/Main.java` — bootstrap: Netty server, matchmaker, persistence.
- `server/net/WebSocketServerInitializer.java` — Netty pipeline setup.
- `server/net/FrameDecoder.java` — text-frame to envelope converter.
- `server/net/FrameEncoder.java` — envelope to text-frame converter.
- `server/net/HeartbeatHandler.java` — wraps `IdleStateHandler` and emits PING.
- `server/net/MessageDispatcher.java` — routes envelopes to room or lobby loops.
- `server/match/MatchRoom.java` — per-room state, tick loop, snapshot fan-out.
- `server/match/MatchLoop.java` — single-threaded executor wrapper.
- `server/match/Matchmaker.java` — queues, banding, region pinning (V2 hook).
- `server/match/BotLoop.java` — bot tick budget, fallback to Easy on overrun.
- `server/bots/EasyBot.java` — behavior-tree bot.
- `server/bots/MediumBot.java` — utility-AI bot.
- `server/bots/HardBot.java` — bounded BFS bot.
- `server/lobby/LobbyServer.java` — lobby loop and roster broadcast.
- `server/lobby/ChatRelay.java` — text relay with `ProfanityFilter` invocation.
- `server/lobby/VoiceRelay.java` — opaque Opus frame relay.
- `server/auth/GoogleVerifier.java` — verifies OAuth id tokens.
- `server/auth/AccountStore.java` — JDBC access to the `accounts` table.
- `server/persistence/PgPool.java` — HikariCP-backed connection pool.
- `server/persistence/EventWriter.java` — gameplay event ingestion.
- `server/persistence/ChatLog.java` — chat retention enforcement.
- `server/moderation/ProfanityFilter.java` — server-side word list.
- `server/moderation/TicketStore.java` — moderator queue.
- `server/metrics/Telemetry.java` — RTT, ticks/s, room counts.

### C.3 `bomb-client`

- `client/Main.java` — JavaFX launcher.
- `client/scenes/LobbyScene.java` — lobby UI and chat panel.
- `client/scenes/WarmupScene.java` — pre-match countdown.
- `client/scenes/MatchScene.java` — in-match HUD and renderer.
- `client/scenes/PostMatchScene.java` — scoreboard and replay link.
- `client/render/Renderer.java` — tile, entity, FX drawing.
- `client/render/ScanlineShader.java` — CRT scanline pass.
- `client/render/FxLayer.java` — tween-driven FX timeline.
- `client/input/KeyboardInput.java` — JavaFX key adapter.
- `client/input/MouseInput.java` — pointer-based lobby input.
- `client/input/JInputGamepad.java` — JInput gamepad adapter.
- `client/net/Connection.java` — WebSocket client wrapper.
- `client/net/EnvelopeCodec.java` — JSON envelope encode/decode.
- `client/net/SnapshotBuffer.java` — triple-buffered snapshot store.
- `client/net/PingMonitor.java` — RTT measurement.
- `client/state/ClientWorld.java` — predicted local world over `GameWorld`.
- `client/state/Prediction.java` — input reconciliation.
- `client/audio/Audio.java` — sample-based SFX and music.
- `client/voice/VoiceCapture.java` — Opus capture and emit.
- `client/voice/VoicePlayback.java` — Opus decode and mix.
- `client/ui/HUD.java` — HUD layout and overlays.
- `client/ui/KillFeed.java` — kill-feed widget.

## Appendix D — Build & Run Cheatsheet

The full developer flow fits on one page. The team treats this list as the source of truth for new contributors.

```bash
# Build everything (Maven multi-module)
./mvnw clean install -T1C

# Bring up the local stack (Postgres, Redis, server)
docker compose -f infra/compose.yml up -d

# Run the desktop client against localhost
./mvnw -pl bomb-client -am exec:java

# Run the thin web client (spectator)
cd web-client && npm ci && npm run dev

# Run the loadtest (synthetic 200 clients)
./mvnw -pl bomb-loadtest -am exec:java -Dclients=200

# Run unit tests only
./mvnw test -pl bomb-core,bomb-server,bomb-client

# Build the server Docker image
docker build -f bomb-server/Dockerfile -t bombermenx-server:dev .

# Deploy to Cloud Run (staging)
gcloud run deploy bombermenx-server --image bombermenx-server:dev \
  --region europe-west1 --allow-unauthenticated

# Tail the server logs
gcloud run services logs read bombermenx-server --region europe-west1

# Run CodeQL locally before pushing
gh workflow run codeql.yml --ref $(git rev-parse --abbrev-ref HEAD)
```

The standard daily flow is `mvn install`, then `docker compose up`, then `mvn exec:java` in `bomb-client`. The Compose stack persists across restarts; the team rebuilds it only when `infra/compose.yml` changes.

## Appendix E — Game Constants Reference

Every gameplay-affecting constant lives in two places: `GameConfig` (defaults that apply across modes) and the v0.2 super-ability block inside `GameWorld` (constants that depend on the world rather than the config object). The table below is the source of truth.

| Constant | Default | Units | Rationale |
|---|---|---|---|
| TICK_HZ | 60 | ticks/s | Matches typical desktop refresh; aligns with the renderer's free-running 60 fps target. |
| TICK_MS | 1000/60 ≈ 16.67 | ms/tick | Derived from TICK_HZ; used by the match loop sleep. |
| DEFAULT_ARENA_WIDTH | 15 | tiles | Wide enough for 4–8 players; narrow enough that bomb chains reliably reach across the map. |
| DEFAULT_ARENA_HEIGHT | 13 | tiles | Aspect ratio close to 5:4 to fit 16:9 displays with HUD margins. |
| MAX_PLAYERS | 8 | players | Hard cap that drives slot allocation in MATCH_START. |
| DEFAULT_BOMB_FUSE_TICKS | 150 | ticks | 2.5 seconds at 60 Hz; tuned in twenty rounds of playtest between 90 and 180. |
| DEFAULT_EXPLOSION_LIFETIME_TICKS | 36 | ticks | 0.6 s; long enough to read visually, short enough to not block flow. |
| DEFAULT_BOMB_POWER | 3 | tiles | Starting blast radius; +1 per POWER pickup. |
| DEFAULT_MOVE_SPEED | 12 | tiles/s | Caps to 5 steps per second on tap-to-step; +1 per SPEED pickup. |
| DEFAULT_DESTRUCTIBLE_DENSITY | 0.40 | fraction | Soft-wall density on arena generation; lower stalls matches, higher feeds bots. |
| POWERUP_DROP_RATE | 0.40 | fraction | Probability that a destroyed soft wall drops a power-up. |
| DEFAULT_MAX_BOMBS | 1 | bombs | Starting bomb capacity; +1 per BOMB pickup. |
| NUKE_COST | 3 | tokens | High enough to be a choice, low enough to fire in most matches. |
| NUKE_COOLDOWN | 12 | seconds | Prevents repeated nukes from one player dominating a match. |
| DASH_COST | 1 | token | Cheap by design; encourages aggression. |
| DASH_COOLDOWN | 6 | seconds | Long enough that bots cannot kite the player by dashing. |
| CORE_TOKEN_DROP_RATE | 0.06 | fraction | Probability that a destroyed soft wall drops a super-ability token. |
| KING_SCORE_TARGET | 30 | points | Average KING_OF_GRID match length ≈ 4 minutes. |
| KING_NODE_TELEPORT | 20 | seconds | Forces re-engagement; prevents camping. |

The table is intentionally short. The team treats new constants as a code smell and prefers to derive values from these primitives wherever possible.
