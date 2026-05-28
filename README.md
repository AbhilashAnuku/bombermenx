# Deliverables Pack

**Date:** 28 May 2026 · Week 7 of 8 — Prototype

This is the capstone deliverables pack for **BomberMen-X** (SAD module, M.Sc. Applied Computer Science, SRH University Stuttgart). Open `index.html` in any browser to start.

## What's here

```
deliverables/
  index.html                          portal — open this first
  README.md                           this file
  architecture-report-en.html         the submission report

  code-explanation/                   defence pack + reference docs
    architecture-spec-arc42.md        arc42 architecture specification (22 sections)
    requirements-traceability.md      FR-01 to FR-86, NFR, UC, BR mapped to Java classes
    systems-architecture.md           twelve named systems with ownership
    course-context.md                 course context, learning outcomes
    RUN_GUIDE.md                      build + run, step by step
    LEARNING_GUIDE.md                 night-before-defence cheat-sheet
    code-walkthrough.md               consolidated tour of all three modules

    game-design.md                    game rules, modes, scoring, mechanics (5 Mermaid)
    server-client-communication.md    protocol + thread model (4 Mermaid)
    input-validation.md               FR-82..FR-86 mapped to validation code
    sad-theory-and-roles.md           SAD lecture concepts × code × three architects
    glossary.md                       Bomberman + network + SAD + theme terminology

  report/REPORT.md                    consolidated project report
  plans/PLANS.md                      descriptive + prescriptive + sprint plans (Mermaid Gantt)
  build/BUILD_AND_RUN.md              how it builds and how to run it

  diagrams/                           architecture, sequence, deployment (SVG + viewer)
  uml/                                class, package, use case, activity (SVG + viewer)
  presentation/slides.html            self-contained slide deck
  exports/                            defence-pack documents as DOCX (editable in Google Docs / Word)
  assets/                             portal images and CSS / JS
```

## Defence pack — what the prof reads in order

1. `architecture-spec-arc42.md` — the 22-section arc42 specification.
2. `requirements-traceability.md` — every FR / NFR / UC / BR mapped to a Java class and file.
3. `systems-architecture.md` — twelve named systems with three-way ownership.
4. `course-context.md` — what "prototype" means in this module, learning outcomes.
5. `RUN_GUIDE.md` — step-by-step build and run.
6. `LEARNING_GUIDE.md` — twenty likely defence questions with prepared answers.

Each is also available as DOCX under `exports/`.

## Three architects

- **Abhilash Anuku (AA)** — delivery, planning, architecture spec, requirements traceability, build & deploy.
- **Simranjot Kaur (SK)** — UI / UX, gameplay engine (movement, bomb, scoring), HUD.
- **Jithendra Chittomothu (JC)** — networking, server lifecycle, bot AI, deploy pipeline.

Source code lives under `../src/` (Maven modules: `bomberman-core`, `bomberman-server`, `bomberman-client`) and is licensed under MIT.
