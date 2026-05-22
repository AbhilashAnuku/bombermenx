# Prescriptive Plan — Bomber Man X

This document is written for the next team that picks Bomber Man X up. It is not a retrospective of what the founding team did — that lives in `descriptive-plan.md`. It is a recommendation, with the bias of having just lived through the first sprint, on how to run the second one.

## Recommended sequencing

The single most useful rule the founding team stumbled into was: build the core first, then the server, then the client. Do not invert this order. The reasons are mechanical, not stylistic.

1. Build `bomb-core` first. Lock the `GameConfig` constants, freeze the `MessageType` enum, and write deterministic-replay tests against `GameWorld` before any network code touches it. The deterministic guarantee is the foundation that every later debug session leans on. If a bug reproduces from a seed plus an input log, you save days.
2. Build `bomb-server` next. Stand up the Netty WebSocket entry point, wire `MatchManager` to spin up `MatchSession` instances, and exercise the loop with a synthetic bot client before any human-facing client connects. The Postgres and Redis dependencies should be there from day one via Docker Compose so the "does the data path work" question is answered early.
3. Build `bomb-client` last. JavaFX scene routing, the HUD, the particle layer, and the age gate all benefit from a fully-formed server contract. Do not let client polish work block server progress.

A common temptation is to interleave for the sake of "showing something visual quickly". Resist it. A console-only bot match against the server is a more honest milestone than a half-wired JavaFX window.

## Recommended team shape

Keep the three-architect structure. Three is small enough to hold a single shared mental model and large enough to enforce the cross-review rule below. Inside the three-architect frame, rotate engineering hats — backend, gameplay, AI, physics, UX, UI, motion, QA, DevOps — day by day. The rotation prevents single-person ownership of any module and forces the bus-factor up to three on every line of code.

Keep the three-architect-sign-off rule for cross-module changes. Any pull request that touches more than one of `bomb-core`, `bomb-server`, `bomb-client` requires an approval from each architect. Single-module changes need one approver. This rule is heavier than it sounds for two days, then it disappears into the background and starts paying for itself.

## Recommended definition of done

Every pull request, no exceptions:

- Builds green on `mvn verify` across all three modules.
- Unit tests pass. Integration tests pass. New code carries new tests.
- CodeQL scan is clean on the diff.
- The `REPORT` excerpt for the touched module is updated in the same PR. If a class signature changed, the report changes with it.
- If the change is architectural — new module boundary, new wire message, new external dependency, new deployment surface — a decision log entry lands in the same PR.
- The PR description names the sprint day, the owner, and the linked issue.

Definition of done for a sprint day:

- The day's deliverable is merged to `main`.
- The end-of-day demo to the other two architects happened.
- The decision log is current.
- The CI pipeline is green on `main`.

## Recommended weekly rhythm

Two-week sprints. Inside each week:

- Monday: planning, scope confirmation, decision log review.
- Tuesday through Thursday: build days. One architect drives, two review.
- Friday: integration day. Merge window 17:00–18:00 IST. End the week on a green main.

Inside each day:

- 09:00 IST: 15-minute standup. Three questions, camera on.
- 09:15–17:00: build window.
- 17:00–18:00: merge window. Reviews finalised, builds green, deploys triggered.
- 18:00: 5-minute end-of-day demo to the other two architects.

The merge window matters. Without it, reviews drift and integrations land at midnight. With it, the day has a clean edge.

## Recommended risk-tracking checklist

Track these five risks every Friday for the duration of the sprint. Each gets a colour (green/amber/red), an owner, and a mitigation line. None of these are theoretical — each one fired or nearly fired during the founding sprint.

1. Rollback time. How long does it take to revert a bad Cloud Run revision and confirm players are on the previous build? Target under five minutes. If it climbs, the deploy pipeline needs work.
2. Free-tier quota burn. Cloud Run, Postgres, Redis, GitHub Actions minutes, CodeQL minutes. Watch the burn rate weekly. Project the run-out date. If it is inside the sprint horizon, change the plan.
3. Dependency CVEs. CodeQL and Dependabot will surface these. Triage every Monday. Anything CVSS 7+ blocks the next merge until patched.
4. Voice-channel moderation gap. The game has no voice today. The moment voice ships, moderation, abuse reporting, and minor-safety policies become a separate workstream. Do not let voice ship without that workstream having an owner.
5. COPPA and Play Console compliance. The age gate covers the front door. If you ship to Play Console, the back door — data collection, retention, parental consent flows — needs its own audit before the listing goes live.

## Recommended tooling additions

The founding team made deliberate "not yet" calls on each of these. For the next sprint, schedule them in:

- Binary protocol. Once the JSON wire has stabilised — meaning `MessageType` has not changed in two weeks — port it to a binary protocol. Kryo is the obvious candidate. Expect a 3–5x bandwidth reduction and a measurable RTT improvement.
- Replay tooling. The deterministic seed-plus-inputs guarantee is already in `bomb-core`. Build a UI on top of it. A replay viewer is the cheapest debugging tool the team will ever ship, because every reported bug becomes a reproducible one.
- Contract tests for the wire protocol. Today, `MessageType` is enforced by code review. It should be enforced by a contract-test suite that pins the schema for each message and fails CI on an unintended change.
- Soak SLOs in the nightly. The nightly soak runs but does not yet have SLOs attached. Pick numbers — p99 RTT, memory ceiling, leaked sessions per hour — and fail the nightly when they are missed. A green build that misses an SLO is a worse signal than a red one.
- Observability budget. Wire structured logs and a single tracing span per match through `MatchSession`. The cost is small. The first time a production match misbehaves, the cost pays itself back.

## What to do differently than us

A short, blunt list. None of these are catastrophes from the founding sprint, but each is a knob the next team should turn.

- Do not defer the replay viewer. The deterministic core makes it cheap. Ship it in the first week.
- Do not run the leaderboard as a stub. Either ship the persistence path or remove the leaderboard from the UI. A stub in the UI is a credibility tax.
- Do not let the JavaFX client lead the spec. Let the server and the wire lead. The client follows.
- Do not split the decision log across channels. One log, in the repository, single source of truth.
- Do not skip the Friday integration day. Two clean integration days a sprint is the floor.
- Do not promise mobile inside a six-week build window inside an eight-week programme unless the team is four people or more. The desktop and web clients are enough surface for a capstone-scale build.
- Do not let security scans pile up. Triage CodeQL findings weekly, not at the end of the sprint.
- Do not run demos against staging. Demo against production with a feature flag, or demo against a local Docker Compose stack. Staging will lie to you at the worst moment.
