# BomberMen-X — Project Report
*A Tron-inspired distributed multiplayer arena — design, build, and delivery in fourteen days.*

---

## Title Page

| Field | Value |
|---|---|
| Project | BomberMen-X |
| Subtitle | A Tron-inspired distributed multiplayer arena |
| Team | Abhilash Anuku, Simranjot Kaur, Jithendra Chittomothu |
| Programme | Master's Capstone |
| Document | Final Project Report |
| Version | v1.0 |
| Date | 2026-05-22 |
| Repository | bomber-men-x (monorepo, Maven multi-module) |
| Licence | Open source, MIT-style attribution |

---

## Team and Roles

The team operated under a deliberately flat "three architects" charter. Every member held an equal seat on architecture-level decisions, and each member led one functional area end-to-end. The matrix below records the lead hat each person wore, the secondary hats they picked up across the sprint, and the modules where they spent the majority of their commits.

| Member | Initials | Lead Role | Secondary Hats | Primary Modules |
|---|---|---|---|---|
| Abhilash Anuku | AA | Architect, Delivery Lead | Release engineering, DevOps, GCP deploy, decision-log curator | bomb-server, CI/CD workflows, Docker Compose |
| Simranjot Kaur | SK | Architect, UI/UX Director | Onboarding flow, accessibility, age-gate UX, Neon Plaza visual identity | bomb-client (JavaFX), presentation/play.html, warroom.html |
| Jithendra Chittomothu | JC | Architect, Gameplay Director | Determinism harness, AI bot behaviour, balance tuning, power-up tables | bomb-core, AI bot package in bomb-server |

The team agreed at kickoff that no member would single-handedly own the wire protocol, the build, or the deploy pipeline. Those three artefacts were declared "shared surface" and required two of three architects to sign off on any change.

---

## Honour Declaration

We, the BomberMen-X team, declare that the work presented in this report and in the accompanying source repository is our own. Each chapter, code module, configuration file, and presentation artefact was written by the named team members during the capstone window. All third-party libraries, frameworks, sprite assets, and reference materials we drew upon are listed in the References chapter, and their licences are recorded in the project's `THIRD_PARTY_NOTICES.md`. Where we adapted ideas from books, papers, or open source projects, the influence is acknowledged in the relevant chapter. We further declare that no part of this report was submitted, in whole or in part, for any other academic credit. We accept full responsibility for the contents of this document and the behaviour of the deployed system.

Signed (in initials, in alphabetical order of surname): AA · SK · JC.

---

## Acknowledgements

We thank the capstone faculty and the programme office for shaping a brief that genuinely stretched our software engineering muscles, and for the patient question-and-answer sessions during the planning week. The teaching assistants who reviewed our weekly check-ins gave us steady, calm feedback at moments where it was easy to lose sight of the goal.

We owe a large debt to the open-source projects on which BomberMen-X stands. The Netty project gave us a stable, well-documented foundation for the WebSocket gateway and made the asynchronous I/O model approachable. The JavaFX runtime carried our desktop client at a steady sixty frames per second on the hardware we tested. The JInput library let us treat a USB gamepad as a first-class input device on a Friday afternoon, which was a small miracle. Jackson made JSON-on-the-wire ergonomic. PostgreSQL and Redis served as quiet, reliable sidecars that never asked for attention. Docker and Docker Compose let us hand the same stack to every team member without the usual "works on my machine" friction. The wider Java, Tron-aesthetic, and indie-multiplayer communities supplied tutorials, blog posts, and example repositories that shortened our path.

Finally, the three of us would like to thank each other. Two weeks is a short time to ship something we are proud of, and there were several evenings where the only thing keeping the build green was that one teammate stayed online twenty minutes longer than they had planned. That spirit of mutual cover is the part of this project we are most proud of.

---

## Abstract

The capstone brief asked us to deliver a non-trivial, end-to-end software product in fourteen calendar days, on a budget of zero dollars, with a team of three. We chose to build BomberMen-X, a Tron-inspired, server-authoritative multiplayer arena game in the Bomberman lineage. The problem we set ourselves was that, although Bomberman is a well-trodden genre, the public open-source landscape lacks a project that is simultaneously (a) zero-install in the browser, (b) playable on the desktop with a gamepad, (c) server-authoritative for cheat resistance, (d) deployable inside a free Cloud Run envelope, and (e) safe enough by default to demonstrate in a classroom. Our approach was to split the system into three Maven modules: a deterministic Java 17 simulation core (bomb-core), a Netty WebSocket gateway with matchmaking, AI bots, Postgres, and Redis (bomb-server), and a JavaFX 21 desktop client with gamepad support and an age gate (bomb-client). On top of those, we shipped a zero-install HTML and JavaScript browser client and a three-dimensional Three.js war-room dashboard for live demos. We adopted a studio-style two-week sprint, a strict three-architect sign-off rule on shared surface, and a written decision log. The headline results are a desktop client that renders at sixty frames per second against a sixty-hertz authoritative tick, end-to-end round-trip times under one hundred milliseconds within a single Cloud Run region, an always-on local Compose stack, and a CI pipeline that runs build, tests, and CodeQL on every push. We learned, above all, that determinism in the core layer is the single highest-leverage decision a small networked-game team can make.

---

## Table of Contents

1. Introduction and Project Context
2. Problem Statement and Goals
3. Stakeholders and Personas
4. Requirements
5. Methodology and Working Process
6. System Architecture Overview
7. Domain Model
8. Network Protocol
9. Server Implementation
10. Game Simulation and Rules
11. AI / Bot Design
12. Client Implementation
13. UI / UX Design Language
14. Persistence and Sessions
15. Build, CI/CD and Release Engineering
16. Local Development Setup
17. Testing Strategy
18. Performance and Soak Results
19. Security Review
20. Privacy, Safety and Compliance
21. Coordination and Team Process
22. Role Contributions in Detail
23. Risks, Mitigations, and Known Limitations
24. Lessons Learned
25. Roadmap
26. References

Appendix A. Glossary
Appendix B. Wire Protocol Reference
Appendix C. Module-by-Module File Inventory
Appendix D. Build & Run Cheatsheet
Appendix E. Game Constants Reference

---

## Chapter 1 — Introduction and Project Context

### 1.1 What BomberMen-X is

BomberMen-X is a real-time, multiplayer, top-down arena game in the Bomberman tradition, dressed in a Tron-inspired neon aesthetic and engineered as a distributed system rather than as a single-process desktop title. Up to eight players occupy a grid arena. Each player walks a character that drops timed bombs. Bombs explode in cross-shaped patterns and destroy soft blocks, players, and other bombs that have not yet finished their fuse. Surviving long enough means walking through the wreckage to grab power-ups that increase fire range, allow more concurrent bombs, or grant a one-shot kick on a placed bomb. A match ends when the configured win condition is met for the chosen mode: last-survivor in Free-For-All, last team standing in Teams, a score race in King-of-Grid, or completion of a scripted sequence in Levels.

What distinguishes BomberMen-X from a casual hobby clone is the system layout behind the gameplay. The simulation runs on a server, not on the client. The client is a thin renderer of the authoritative game state. The server runs in a container that can be brought up locally with a single Docker Compose command, or pushed to Google Cloud Run for a free-tier-friendly deployment. Two clients ship in the box: a JavaFX desktop application with USB gamepad support, and a zero-install browser client at `presentation/play.html`. A third surface — a three-dimensional Three.js dashboard called the Neon Plaza war room — is provided for presentations and live spectating.

The project is open source, zero-budget, and was built from a blank slate in fourteen calendar days by a team of three.

### 1.2 Why a multiplayer arena game as a capstone

Capstone projects are often skewed toward either a deep but narrow technical artefact (for example, a single research-grade algorithm) or toward a broad but shallow showcase (for example, a four-page web prototype). We wanted to occupy the harder middle ground: a system whose every layer is non-trivial, but whose surface is small enough that three people can hold the whole architecture in their heads at once.

A real-time multiplayer arena game has several useful properties for that goal. It forces honest engagement with concurrency, because a tick-based simulation cannot be hand-waved. It forces honest engagement with network protocols, because the client cannot lie about the world. It forces engagement with state persistence, because rankings and sessions must survive a server restart. It forces engagement with user experience, because a confused player at the title screen never reaches the gameplay code. And it forces engagement with operations, because a game server in production must be observable, recoverable, and bounded in cost.

Bomberman in particular is a well-understood genre with a small rule set, which let us spend the saved design time on system structure instead of on inventing new mechanics. The Tron visual identity gave us a strong, opinionated art direction that we could execute with simple, geometric sprites and a small palette, instead of commissioning bespoke art.

### 1.3 Constraints

Three constraints shaped every decision in this project, and the team referred back to them whenever a debate ran long.

The first was budget. The project had a zero-dollar budget. Every piece of infrastructure had to fit inside a permanently free tier or a local container. We could not pay for a managed game server, a managed database with a credit card on file, or a paid art asset. This eliminated several otherwise attractive options early.

The second was time. We had fourteen calendar days from kickoff to final demo, including weekends and including the time required to write this report. That window translated, in practice, to approximately ten engineering days, two quality days, one deployment day, and one release day. The sprint plan in Chapter 22 reflects that allocation.

The third was team size. Three people, working in parallel, can build a remarkable amount in two weeks, but only if coordination overhead is kept ruthlessly low. We could not afford a project manager, a separate QA hire, a dedicated devops engineer, or a designer outside the team. Every role had to be carried by one of the three architects, in addition to their share of the code.

### 1.4 Document map

This report is organised in three arcs. Chapters 1 through 6 lay the foundation: what we built, why, for whom, against what requirements, under what process, and on what architecture. Chapters 7 through 21 are a deep tour through each module and each cross-cutting concern, written so that a future maintainer can stand up the system from this document alone. Chapters 22 through 26 are reflective: the day-by-day sprint narrative, the decisions log, the limitations of what we shipped, and what we learned. The appendices collect the reference material — glossary, constants, wire catalogue, runbook, and citations — that did not belong inline.

Throughout the document, code excerpts are short and illustrative rather than exhaustive. The repository remains the source of truth for executable behaviour, and every chapter cross-references the path inside the repository where the canonical artefact lives.

---

## Chapter 2 — Problem Statement and Goals

### 2.1 The problem

We surveyed the open-source landscape for real-time multiplayer Bomberman variants during the planning day and found that, although the genre has dozens of hobby implementations, none of them met all five of the criteria we cared about at the same time. We articulated the problem in a single sentence and posted it on the project wiki on Day 1:

> There is no zero-install, server-authoritative, free-tier-friendly Bomberman that a small team can ship end-to-end in two weeks, on a desktop and a browser, with safety controls on by default.

Each clause in that sentence corresponds to a property we found missing in the existing landscape.

"Zero-install" excludes implementations that require downloading a native binary or installing a runtime. We wanted a teacher to be able to open a browser tab and play.

"Server-authoritative" excludes implementations in which the client computes the game state. Those implementations are easier to write but trivially cheat-prone, which makes them unsuitable for a classroom demonstration.

"Free-tier-friendly" excludes implementations that assume a paid game server, a paid database, or a paid CDN. Our deploy target had to fit inside Cloud Run's permanent free envelope.

"Ship in two weeks" excludes implementations that depend on a large engine such as Unreal or Unity, where the integration and licensing surface alone would consume more time than we had.

"Desktop and browser" excludes implementations that only run as a webpage or only run as a native app. We wanted the same authoritative server to feed both.

"Safety on by default" excludes implementations that ignore age gating, profanity filtering, or kill-feed moderation. A classroom-facing project must not require an opt-in to be safe.

### 2.2 Primary goals

Out of that problem statement we distilled five primary goals that every architecture decision had to serve.

1. **A deterministic simulation core.** Given the same initial seed and the same ordered input stream, the simulation must produce a byte-identical state at every tick. Determinism is the foundation for replay, integration testing, and cheat detection.
2. **Server authority.** The server is the only authority on the game state. The client sends intents (move north, drop bomb) and renders the server's snapshots. The client cannot author game state.
3. **Free-tier hostability.** The whole stack must run inside a Cloud Run container within the permanently free quota, with a Postgres and Redis sidecar pair that also fits inside free tiers.
4. **Two clients on the same server.** A JavaFX desktop client and a zero-install HTML and JavaScript browser client must both connect to the same WebSocket gateway and play in the same matches.
5. **Safety on by default.** A working age gate, a profanity filter on usernames and chat, and a kill feed that cannot leak unfiltered strings must be enabled out of the box.

### 2.3 Non-goals

A short list of explicit non-goals was as important as the goal list. The team agreed early that any feature on the non-goal list would be deferred to a hypothetical version two, even if it became technically tempting mid-sprint.

- Native mobile clients (iOS, Android) at version one. The browser client is the mobile surface for now.
- A competitive ranked ladder with skill matching. We ship a flat matchmaker that fills empty slots with bots.
- A client-side anti-cheat agent. Server authority is the only defence.
- A voice chat or voice moderation pipeline. Out of scope for two weeks.

### 2.4 Success criteria

We adopted a single, measurable success criterion per goal. Each criterion is quantitative, was written down at the start, and was checked at the end of the sprint.

| Goal | Success criterion | Measurement |
|---|---|---|
| Deterministic core | More than eighty percent unit-test coverage of the simulation, and a replay harness that reproduces a recorded match byte-identically | JaCoCo report on bomb-core; replay test in CI |
| Server authority | Zero client-side game-state mutation; all moves round-trip through the server | Code review; tcpdump on the wire boundary |
| Free-tier hosting | Cloud Run instance fits in 512 MiB RAM and one vCPU; cold start under three seconds | Cloud Run console metrics; cold-start test in deploy-cloudrun workflow |
| Two clients | The same match accepts a JavaFX player and a browser player simultaneously | Integration test on Day 12 |
| Safety | Age gate blocks under-13 declarations; profanity filter rejects a fixed test list | UX walkthrough; unit tests in bomb-server |

The wider non-functional bar — sixty frames per second on the client, sixty-hertz authoritative tick on the server, end-to-end round-trip time under one hundred milliseconds within a single region — is set in Chapter 4 alongside the formal requirements.

---

## Chapter 3 — Stakeholders and Personas

### 3.1 Stakeholders

A real software product, even a small one, has more than one audience. We catalogued our stakeholders on Day 1 so that no group would surprise us in week two. The table below records the four groups we identified, the interest each group has in BomberMen-X, and the artefact in our deliverables that primarily serves that interest.

| Stakeholder group | Interest | Primary serving artefact |
|---|---|---|
| Course staff and capstone reviewers | Evidence of a complete, well-engineered software product and a defensible engineering process | This report, the decision log, CI green badges |
| The team (AA, SK, JC) | Genuine learning, a strong portfolio piece, a clean repository to point future employers at | The repository, this report, the recorded demo |
| Potential players (classmates, friends, demo-day visitors) | A game that is fun, safe, fast to start, and works on whatever device they have to hand | bomb-client, presentation/play.html, the Neon Plaza lobby |
| Infrastructure providers (Google Cloud, GitHub) | A workload that respects free-tier quotas and does not abuse shared resources | Cloud Run YAML, GitHub Actions concurrency limits, /metrics endpoint |

The first two groups are inward-facing and care about correctness and craft. The last two are outward-facing and care about experience and behaviour. The architecture had to satisfy both arcs at once.

### 3.2 Personas

We wrote three personas during the planning day. Each persona is a single fictional individual, anchored against a real type of player we expected to meet on demo day. The personas drove a surprising number of small decisions later in the sprint — for example, the choice to put the age gate before the username entry, rather than after, came directly from the friction analysis under Maya below.

#### 3.2.1 Persona A — "Theo", the Tron-loving casual player

Theo is twenty-eight, works in a non-engineering job, and watches every Tron rerun on streaming. He saw the project poster on the corridor noticeboard and is intrigued by the neon aesthetic. He has never played Bomberman seriously, but he has a vague memory of dropping bombs in cartoons.

- **Scenario.** Theo opens the play page on his laptop in a café, plays one match against three bots, and decides whether to come to demo day.
- **Motivations.** Aesthetic delight, low cognitive friction, a feeling of "I get it" within the first thirty seconds.
- **Friction points.** A long tutorial would lose him. A username form that demands a password would lose him. Any frame-rate stutter would lose him.
- **What we did.** The browser client opens straight into a single-page lobby with a one-click "Play as guest" button. The first match is always against bots if no human is queued, so Theo never sees an empty lobby. The neon palette, scanline overlay, and tracer effects do most of the welcoming work without text.

#### 3.2.2 Persona B — "Reza", the competitive multiplayer enthusiast

Reza is twenty-three, a long-time Counter-Strike player, owns a wired gamepad and a mechanical keyboard, and instinctively distrusts any new multiplayer game until he has confirmed it is server-authoritative.

- **Scenario.** Reza downloads the JavaFX client, plugs in his gamepad, and joins a four-player Free-For-All. Within five matches he wants to know whether the game has predictable hit-boxes, deterministic explosions, and a low-latency feel.
- **Motivations.** Mechanical mastery, a fair fight, a tight input-to-action loop, a kill feed he trusts.
- **Friction points.** Any frame where the client and server disagree about whether he placed a bomb. Any controller drift. Any hit registered on a tile where his sprite was not visually present.
- **What we did.** The deterministic core means there is exactly one truth at any tick. The JInput integration was tested with the team's own gamepads on Day 8. The kill feed is rendered from server-emitted events, never from client speculation. Reza also gets a /metrics endpoint he can curl if he is suspicious.

#### 3.2.3 Persona C — "Maya", the new player who needs a ramp

Maya is fifteen, accompanies an older sibling to the demo, and has never used a keyboard for gameplay. She is the persona who pushed our safety thinking the hardest.

- **Scenario.** Maya sits at the demo laptop, sees a welcome screen, and is asked her age. She enters fifteen and proceeds. She plays a single match in the Levels mode against scripted bots.
- **Motivations.** Not embarrassing herself in front of her sibling, understanding the controls within the first thirty seconds, seeing one explosion and feeling rewarded.
- **Friction points.** Any adult language on screen. Any opponent username that is unkind. Confusing controls. Losing every single match instantly.
- **What we did.** The age gate enforces a hard floor of thirteen and stamps a non-removable "minor" flag on the session. The profanity filter rejects any username on a blocklist and any chat message that contains a flagged term. The Levels mode is tuned with slower bot reaction times and longer fuse times, so Maya gets at least one explosion she initiates. The kill feed cannot render an unfiltered string under any code path.

The three personas span the breadth we expected to meet: aesthetic-driven, skill-driven, and safety-sensitive. The features that serve all three at once — server authority, deterministic core, browser zero-install, age gate, profanity filter — became our non-negotiables. Features that served only one persona were ranked lower and, where time was tight, deferred to the future-work list in Chapter 24.

---

## Chapter 4 — Requirements

The requirements catalogue below is intentionally compact. Each entry is numbered, fits on a single line, and is traceable to a module in the mapping table at the end of the chapter. The wording follows the convention that "shall" denotes a hard requirement and "should" denotes a strong preference that may be relaxed under documented constraints.

### 4.1 Functional requirements

- **FR-1.** The server shall advance the simulation at a fixed tick rate of sixty hertz (`GameConfig.TICK_HZ = 60`).
- **FR-2.** The server shall be the sole authority on game state; the client shall submit intents only.
- **FR-3.** The server shall expose a WebSocket endpoint that accepts both the JavaFX client and the HTML browser client on the same path.
- **FR-4.** The server shall provide a matchmaker that fills empty slots in a starting match with AI bots, up to `GameConfig.MAX_PLAYERS = 8`.
- **FR-5.** The server shall support four game modes: Free-For-All, Teams, King-of-Grid, and Levels.
- **FR-6.** The client shall present an age gate before any gameplay input is accepted, and shall block self-declared ages below thirteen.
- **FR-7.** The server shall reject any username, team name, or chat message that matches the configured profanity blocklist.
- **FR-8.** The server shall publish a kill feed of moderated event strings to all clients in a match.
- **FR-9.** The desktop client shall support keyboard input and USB gamepad input via JInput, including haptic feedback on bomb placement when the device supports it.
- **FR-10.** The browser client shall be zero-install: a single HTML page (`presentation/play.html`) plus assets, no plug-in required.
- **FR-11.** The server shall persist player rankings and account stubs in PostgreSQL.
- **FR-12.** The server shall use Redis for session caches and rate-limit counters.
- **FR-13.** The server shall expose a `/metrics` endpoint in Prometheus exposition format.
- **FR-14.** The server shall log a structured line for every match start, match end, and disconnect event.
- **FR-15.** A spectating dashboard (`presentation/warroom.html`) shall render a live three-dimensional view of the current match for demo purposes.

### 4.2 Non-functional requirements

- **NFR-1.** The desktop client shall sustain sixty frames per second on the reference development laptop while rendering a full eight-player match.
- **NFR-2.** The server shall sustain its sixty-hertz tick under a load of ten concurrent matches without exceeding 512 MiB of resident memory.
- **NFR-3.** End-to-end round-trip time, measured from client input to authoritative state acknowledgement, shall be no more than one hundred milliseconds within a single Cloud Run region.
- **NFR-4.** A single Cloud Run instance shall be capable of hosting at least ten concurrent matches.
- **NFR-5.** The Cloud Run deployment shall fit inside an envelope of 512 MiB of memory and one vCPU, with autoscaling capped at three instances.
- **NFR-6.** The bomb-core simulation shall have unit-test coverage of greater than eighty percent (line and branch) at release time.
- **NFR-7.** A full Maven build from a clean checkout shall complete in under five minutes on a standard GitHub Actions runner.
- **NFR-8.** Container cold start on Cloud Run shall be under three seconds.
- **NFR-9.** The system shall have no high-severity findings open in the CodeQL workflow at release time.
- **NFR-10.** The Compose stack shall be reproducible: `docker compose up` on a clean machine shall bring up server, Postgres, and Redis in under sixty seconds.

### 4.3 Constraints

- **CON-1.** The project budget is zero dollars; no paid service, asset, or licence may be introduced.
- **CON-2.** The build window is fourteen calendar days from kickoff.
- **CON-3.** The team has three members, each carrying engineering and one cross-cutting hat.
- **CON-4.** The desktop client must target the Java ecosystem (Java 17 build, JDK 21 runtime, JavaFX 21) to align with team strengths and to keep the build graph homogeneous.
- **CON-5.** The deployment target is Google Cloud Run, with the Compose stack as the local development equivalent.
- **CON-6.** All third-party libraries must be available under licences compatible with our open-source release.

### 4.4 Requirement-to-module traceability

The mapping below records which module is the primary owner of each functional requirement. Several requirements involve more than one module; the primary owner is the module whose code would need to change first to satisfy or modify the requirement.

| Requirement | Primary module | Supporting modules |
|---|---|---|
| FR-1, FR-2, FR-5 | bomb-core | bomb-server |
| FR-3, FR-4, FR-7, FR-8, FR-11, FR-12, FR-13, FR-14 | bomb-server | bomb-core, infra |
| FR-6, FR-9, FR-10, FR-15 | bomb-client and presentation | bomb-server |
| NFR-1, NFR-9 | bomb-client | — |
| NFR-2, NFR-3, NFR-4, NFR-5, NFR-8, NFR-10 | bomb-server and infra | — |
| NFR-6, NFR-7 | bomb-core and build pipeline | all |

---

## Chapter 5 — Methodology and Working Process

### 5.1 Why a two-week studio-style sprint

We considered three working models during the planning day: a classic two-week Scrum sprint with backlog grooming and retrospectives, a Kanban flow with continuous pull, and what we ended up calling a "studio sprint" inspired by short game-jam practice. We chose the third.

A Scrum cadence would have spent too much of our scarce time on ceremonies that were designed for larger teams over longer horizons. A pure Kanban flow would have left us without a forcing function for the daily integration we knew we needed. The studio sprint, by contrast, treats each calendar day as the unit, gives each day a named owner and a named deliverable, and closes each day with a short demo. It is a known fit for small teams, short windows, and visually demonstrable products. A multiplayer game is, fortunately, very visually demonstrable.

### 5.2 The three-architect rule

Because no single person could afford to become a bottleneck, the team adopted what we called the three-architect rule. Each member was an equal architect on the project, and the rule had three clauses.

First, any cross-module change — that is, any change that touches the wire protocol, the persistence schema, the deploy pipeline, or the public interface of one module that another module depends on — required two of three architects to sign off in writing on the pull request. The third architect could veto with a written reason, but could not block silently.

Second, intra-module changes within an owner's area required only the owner's own approval but had to be merged within a working day, so that no long-lived branch could drift away from main.

Third, the three-architect rule applied to documentation. Any update to the decision log or the wire-protocol document needed the same two-of-three nod. This kept our written record of the project honest and current.

### 5.3 Daily rituals

We kept ceremonies short and rigid. The day was bookended by two scheduled meetings and a continuous chat presence in between.

| Ritual | Cadence | Time-box | Owner |
|---|---|---|---|
| Morning stand-up | Every day | 15 minutes | Rotating, AA on Mondays |
| Mid-day async check-in | Every day | Chat-only, no meeting | Each architect for own area |
| End-of-day demo | Every day | 5 minutes | The architect who shipped the day's headline change |
| Decision-log entry | As needed | 5 minutes per entry | The architect who proposed the decision |
| Weekly retro | End of each week | 30 minutes | Rotating |

The end-of-day demo turned out to be the most valuable single ritual. It forced an integration moment every twenty-four hours, and it made it impossible to hide an unfinished feature behind a confident standup verbal report.

### 5.4 Decision-log discipline

We maintained a single markdown file, `docs/decisions/`, with one entry per architecture-level call. The format was inherited from the lightweight Architecture Decision Record practice: every entry has four sections — Context, Options, Decision, and Consequences — and is no more than one printed page. Examples that ended up in the log include the choice of JSON over Kryo for the v1 wire format (with a note that Kryo is planned for v2), the choice of Cloud Run over a managed VM, and the choice of JavaFX over a native game engine for the desktop client. The decisions log is summarised in Chapter 23.

### 5.5 Branching model

We used trunk-based development with very short-lived feature branches. The rules were simple. The `main` branch is always releasable; feature branches live for at most twenty-four hours; any branch that cannot land in twenty-four hours is broken into smaller branches. Commit messages follow the Conventional Commits convention, which made the changelog at release time almost free to generate.

We deliberately avoided long release branches and the merge-train patterns common in larger teams. With three architects and a two-week window, a long-lived branch is a hidden risk that we could not afford to carry.

### 5.6 CI gates

The CI pipeline lives in `.github/workflows/` and is composed of five workflows, each with a clear job. The pre-beta CI gate (`ci.yml`) is the one that runs on every push and pull request, and is the one whose green status is the precondition for any merge to main.

| Workflow file | Trigger | What it does |
|---|---|---|
| ci.yml | every push, every PR | Build all three Maven modules; run unit tests; publish JaCoCo coverage; run CodeQL static analysis |
| release.yml | tagged commit `v*` | Build and publish the desktop client artefact and a server fat-jar |
| deploy-cloudrun.yml | push to main | Build the server container; push to Artifact Registry; deploy to Cloud Run with a canary-style traffic shift |
| nightly.yml | scheduled, daily | Run the longer integration and replay tests that are too slow for the per-push gate |
| codeql.yml | scheduled, weekly | Deep CodeQL pass with the security-extended query suite |

The pre-beta gate is intentionally conservative. We would rather a pull request wait three extra minutes for CodeQL than ship a security finding into main.

### 5.7 Tools

The tool chain was kept boring on purpose. GitHub hosts the source, the issues, and the project board. GitHub Actions runs the CI. Docker and Docker Compose provide the local environment. Maven manages the multi-module build. JInput handles gamepad input on the desktop. GIMP produced the sprite sheets, which are stored as PNG atlases under `bomb-client/src/main/resources/sprites/`. JetBrains IntelliJ IDEA and Visual Studio Code were the editors of choice, depending on each architect's preference; both were configured to share the same Checkstyle and Spotless rule sets so that formatting was never a topic in code review.

The team's communication ran over a single shared chat channel with two pinned messages: the project's success criteria, and the current decisions log link. Everything that needed to outlive a chat message was promoted into the repository.

---

## Chapter 6 — System Architecture Overview

### 6.1 Three-module Maven layout

The repository is a Maven multi-module project with a parent POM and three child modules. The parent POM declares the Java toolchain (Java 17 source level, JDK 21 runtime target), shared plugin versions, the Checkstyle and Spotless rule sets, and a single dependency-management section that pins the third-party library versions used across the project. Each child module declares only its own source-level dependencies and inherits everything else from the parent.

```
bomber-men-x/
├── pom.xml                  (parent)
├── bomb-core/               (deterministic simulation + wire DTOs)
├── bomb-server/             (Netty gateway, matchmaker, AI, persistence)
├── bomb-client/             (JavaFX desktop client, JInput, age gate)
├── presentation/
│   ├── play.html            (zero-install browser client)
│   └── warroom.html         (3D Three.js dashboard)
├── infra/
│   ├── docker-compose.yml
│   └── cloudrun.yaml
└── .github/workflows/
```

The most important property of this layout is the dependency direction. `bomb-server` depends on `bomb-core`. `bomb-client` depends on `bomb-core`. `bomb-server` and `bomb-client` never depend on each other, directly or transitively. This single rule, enforced by Maven and by code review, prevents the most common architectural drift in distributed systems: clients leaking implementation knowledge of servers, or vice versa.

### 6.2 Why server-authoritative

The decision to make the server the sole authority on game state was the first architecture-level call recorded in the decisions log, on Day 2. Three arguments carried it.

The first argument was cheat resistance. In a client-authoritative design, any malicious client can claim it placed a bomb on a tile it never occupied, or that it survived an explosion that should have killed it. Defending against such claims after the fact requires either an anti-cheat client or a server that re-simulates the match and compares — at which point the server is, in effect, authoritative anyway, but with more code.

The second argument was a single source of truth. With server authority, there is exactly one canonical state at any tick. Bug reports become reproducible because the server's tick log is the unambiguous history. Replays are trivial because the server's tick log is the replay.

The third argument was demo-day robustness. If two browser clients disagree about whether a player exploded, the audience sees the bug. With server authority, both clients are downstream of the same truth; the only failure mode is a rendering glitch on one client, which is much less embarrassing.

The cost of server authority is round-trip latency. Every input has to make the trip to the server and back before it visibly takes effect. That cost is paid in our hundred-millisecond round-trip budget (NFR-3), and is mitigated by the small input-prediction window in the client renderer that displays the local player's tentative move while waiting for the server to confirm.

### 6.3 Why a deterministic core

The simulation is deterministic in a strict sense: given the same initial seed and the same ordered input stream, every run produces a byte-identical state at every tick. This is not the natural default in a language like Java, because the standard library is full of non-deterministic ordering — `HashMap` iteration order, parallel streams, default `Random` seed — and because floating-point arithmetic can vary subtly across platforms.

We bought determinism by paying attention. The simulation uses no floating-point arithmetic in its core loop; positions and velocities are integers in tile units multiplied by a sub-tile scale. All collections that are iterated in the tick loop are `LinkedHashMap` or sorted lists. The random number generator is a single, seeded `SplittableRandom` whose seed is part of the match descriptor. Threading is forbidden inside the tick; all parallelism happens at the match boundary, not inside a match.

Determinism unlocks three properties that paid for the discipline many times over during the sprint. First, replays are free: a recorded input stream replays into the same state. Second, integration tests are stable: a flaky test cannot be blamed on race conditions inside the simulation. Third, cheat detection is possible: if a client's claimed state ever diverges from the server's, the server's state wins by definition.

### 6.4 Wire boundary

Between client and server, the boundary is a WebSocket carrying JSON-encoded messages defined as data-transfer objects in `bomb-core/src/main/java/.../wire/`. JSON is verbose on the wire but transparent to every browser and easy to inspect with a network panel during debugging. The plan, recorded in the decisions log, is to migrate the wire format to Kryo in a future version once the message catalogue stabilises. The DTOs are deliberately designed so that the migration is a codec swap, not a model rewrite.

The wire catalogue is short: `HelloMessage`, `JoinMatchMessage`, `IntentMessage`, `SnapshotMessage`, `KillFeedMessage`, `ChatMessage`, `GoodbyeMessage`. Chapter 12 enumerates each in full.

### 6.5 Sidecars

The server runs alongside two sidecar services: PostgreSQL 16 for durable state, and Redis 7 for ephemeral state. Postgres holds the account stubs, the per-mode rankings, and the audit log. Redis holds session tokens, rate-limit counters, and the matchmaker's wait queue. Both sidecars are managed by Docker Compose in local development and by hosted free-tier instances in the Cloud Run deployment. The split is conventional: anything that must survive a restart is in Postgres; anything that can be recomputed within seconds is in Redis.

### 6.6 The Neon Plaza lobby as a second service

The three-dimensional Neon Plaza lobby, served from `presentation/warroom.html`, is not a separate process. It is a second front-end that connects to the same WebSocket gateway as the play clients, on a sibling path. The gateway recognises a spectator handshake and feeds a read-only stream of snapshots without ever accepting an intent from that connection. This let us reuse the entire authority and snapshot pipeline for the demo dashboard, instead of building a parallel observability surface.

### 6.7 Component diagram

The ASCII diagram below records the live components and the connections between them as deployed.

```
                +----------------------------+
                |     presentation/          |
                |  play.html  |  warroom.html|
                +------+----------------+----+
                       |                |
                  WebSocket        WebSocket
                       |                |
                       v                v
   +-----------+   +----------------------------+   +----------+
   | bomb-     |   |        bomb-server         |   | Postgres |
   | client    +-->| Netty gateway              +-->| 16       |
   | (JavaFX)  |   | Matchmaker                 |   +----------+
   |           |   | AI bots                    |
   |           |   | Tick scheduler             |   +----------+
   |           |   | /metrics endpoint          +-->| Redis 7  |
   +-----------+   +-------------+--------------+   +----------+
                                 |
                                 v
                          +-------------+
                          |  bomb-core  |
                          | (sim + DTO) |
                          +-------------+
```

The diagram captures the property that `bomb-core` is a library, not a service. It is linked into both `bomb-server` and `bomb-client` at build time. The only services that run as their own processes are `bomb-server`, Postgres, and Redis. The two browser pages and the JavaFX client are clients that speak to `bomb-server`.

### 6.8 What this architecture optimises for, and what it sacrifices

The architecture is optimised for three properties: cheat resistance through server authority, debuggability through determinism and a transparent JSON wire, and low operational cost through a small Cloud Run footprint with two free-tier sidecars. Those three properties together pay back the discipline of writing a deterministic core and the round-trip cost of full server authority.

The architecture sacrifices three properties in exchange. First, it sacrifices the lowest possible input-to-screen latency, because every meaningful action round-trips through the server. We mitigate but do not eliminate this with a small predictive render window. Second, it sacrifices the convenience of a richer wire format such as Kryo or FlatBuffers in version one, accepting the size cost of JSON in exchange for transparency. Third, it sacrifices horizontal sharding inside a single match: each match runs on exactly one server process. That sacrifice is appropriate at this scale and would have to be revisited only if BomberMen-X grew past the size where one process per match suffices.

These trade-offs are revisited in Chapter 24, where they frame the future-work list. With the architecture pinned, the remainder of this report walks through each module and each cross-cutting concern in detail.
