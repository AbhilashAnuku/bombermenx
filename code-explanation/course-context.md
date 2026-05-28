# Course Context

**Module:** Software Architecture & Design (SAD)
**Programme:** M.Sc. Applied Computer Science, SRH University Stuttgart
**Supervisor:** the course supervisor
**Cohort:** Summer term 2026
**Team:** Abhilash Anuku (AA), Simranjot Kaur (SK), Jithendra Chittomothu (JC)
**Date:** 29 May 2026 — Week 8 of 8

## What the prototype is, in the language of the module

In the course supervisor's module the word "prototype" has a precise meaning. It is not a sketch and it is not a finished product. It is an executable artefact that demonstrates the soundness of an architecture by realising the architecturally significant requirements end-to-end, while leaving non-significant requirements deliberately incomplete. The prototype proves that the chosen building blocks, the chosen communication style, the chosen quality-attribute tactics, and the chosen deployment shape compose into a working whole. It does not prove that every feature on the backlog is implemented.

BomberMen-X satisfies this definition by realising the full vertical slice from input capture through server-authoritative simulation to client rendering, for the central gameplay use cases: authenticate, join lobby, start match, place bomb, collect power-up, score, end match. The bot AI, the moderation pipeline, the haptics service, and the metrics endpoint are present because each of them exercises a quality-attribute tactic that the module asks us to defend. Voice chat, animation rigging, and stat-tracking dashboards are deliberately left as stubs because they would inflate the deliverable without exercising any architectural concept that we have not already demonstrated elsewhere.

## Learning outcomes the module declares

The module's learning outcomes are taken verbatim from the programme handbook and from the slide decks distributed in weeks one through six. They are:

1. **LO-1.** Students can describe a software architecture in terms of building blocks, runtime interactions, and deployment shape, and can choose among reference architectures with documented reasoning.
2. **LO-2.** Students can articulate quality attributes (performance, availability, security, maintainability, modifiability, usability) and can map architectural tactics onto them.
3. **LO-3.** Students can capture architecturally significant decisions in ADR form, with context, decision, and consequences.
4. **LO-4.** Students can apply a systematic documentation template (arc42) to a real system without producing irrelevant boilerplate.
5. **LO-5.** Students can demonstrate traceability from requirements to implementation, and can defend gaps where they exist.
6. **LO-6.** Students can implement a non-trivial system in a team of three, with explicit ownership and a working build/deploy pipeline.

## How this submission satisfies the outcomes

**LO-1 is satisfied** by the explicit reference-architecture choice documented in `architecture-spec-arc42.md` section 4 (Solution Strategy) and in `systems-architecture.md`. We chose a client-server architecture with an event-driven core, layered within each module. The reasoning is recorded in ADR-002 (server-authoritative simulation) and ADR-003 (JavaFX desktop client). Alternatives — peer-to-peer with deterministic lock-step, web client, hybrid relay — are documented as rejected with stated reasons.

**LO-2 is satisfied** by the Quality Requirements section of the arc42 spec and by the dedicated `sad-theory-and-roles.md` document. We name three primary quality attributes (performance, security, maintainability) and the tactics that realise each. Performance is realised by the 60 Hz fixed-tick simulation with a hard budget of 16.67 ms per tick, and by client-side interpolation. Security is realised by server-side validation of every gameplay envelope. Maintainability is realised by the strict three-module dependency DAG.

**LO-3 is satisfied** by the three ADRs embedded in the arc42 spec and by the supporting discussion in `code-walkthrough.md`. The ADRs have explicit context, decision, and consequences sections, and they are referenced from the source code where they apply.

**LO-4 is satisfied** by the arc42 document itself, which follows the canonical section ordering and omits sections that would be empty rather than padding them with filler.

**LO-5 is satisfied** by the requirements traceability matrix in `requirements-traceability.md`. Every functional, non-functional, use-case, and business-rule requirement has a row binding it to a Java class and a source file path.

**LO-6 is satisfied** by the existence of the three-module Maven reactor, the docker-compose deployment, the run scripts under `infra/scripts`, and the ownership matrix in `systems-architecture.md`.

## Mapping to the lecture weeks

The module ran weekly from mid-March to mid-May 2026. The mapping below identifies the lecture material that each deliverable artefact draws from.

**Week 1 — Course introduction; what architecture is and is not.** The introduction to the arc42 spec, especially the framing in §1, draws on this lecture's distinction between architecture and design.

**Week 2 — Stakeholders, drivers, constraints.** The Constraints section of the arc42 spec (§2) and the Risks section (§11) draw on the stakeholder mapping exercise from this lecture.

**Week 3 — Reference architectures.** This week's content is the most heavily cited. the course supervisor introduced client-server, peer-to-peer, pipe-and-filter, layered, event-driven, and microkernel as canonical reference architectures, and walked through how to choose among them based on dominant quality drivers. The choice of client-server with an event-driven core was made in week three and is recorded in ADR-002. Every section of `systems-architecture.md` that names a subsystem boundary leans on the dependency-direction discipline taught in this week.

**Week 4 — Quality attributes and tactics.** This is the second heavily-cited week. The performance, security, and maintainability tactics named in §10 of the arc42 spec and in `sad-theory-and-roles.md` come directly from the Bass/Clements/Kazman tactic catalogue introduced in this lecture.

**Week 5 — Documentation styles; arc42 walkthrough.** The arc42 deliverable is the direct response to this week.

**Week 6 — ADRs and architectural significance.** The three ADRs in the arc42 spec respond to this week, and the framing of "architecturally significant requirement" used in this very document comes from week six.

**Week 7 — Prototype demos and dry runs.** The deliverables portal, the run guide, and the learning guide were produced this week to support the demo. **Week 8 (current) — Final report, defence rehearsal, viva.**

**Week 8 — Final report, presentation deck, defence.** The presentation deck (separate deliverable) and the defence Q&A preparation (`LEARNING_GUIDE.md`) are produced in this week.

## What the prototype does not claim

A prototype claims less than a finished system. We name the claims we are not making, so that the examiner can place the work correctly.

We do not claim production-grade observability. The metrics endpoint emits enough counters to discuss in the defence; it is not connected to a Grafana stack.

We do not claim production-grade security. The auth path uses Google OAuth in the production-mode configuration, but the development provider is also present and is selected by environment variable; a real deployment would remove the development provider from the artefact.

We do not claim feature completeness. Several wire envelopes (`VoiceFrame`, parts of the lobby state model) are defined but unused; their existence documents the planned extension surface, not work that we have done.

We do not claim test coverage parity across modules. The core module has two tests, the server one, and the client zero. The asymmetry reflects priority during the prototype window: the simulation and the wire are the highest-risk surfaces and so are the only ones covered.

## Closing remark

The course context places the prototype within the course supervisor's pedagogy. The deliverable is not a game we built and then dressed in documentation; it is a documentation programme that happens to compile and run. Every document in the `deliverables/code-explanation` directory exists because the module's learning outcomes demand it, and every Java class in `src` exists because some document references it as the implementing artefact of a named requirement. The bidirectional traceability is the point.
