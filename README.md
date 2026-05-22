# BomberMan-X — Architecture Deliverables

Public mirror of the reviewer-facing architecture pack for **BomberMan-X**, a
real-time multiplayer game built in Java for the *Software Architecture and
Development* module at **SRH University Stuttgart**.

- **Brief:** *Lastenheft*, Prof. Steffen Becker
- **Authors:** Abhilash Anuku · Simranjot Kaur · Jithendra Chittomothu
- **Live:** https://abhilashanuku.github.io/bombermenx/

> The source code lives in a private repository. This mirror carries the
> documents the team chose to share publicly.

## Start here

| Document | Purpose |
|---|---|
| [`architecture-report.html`](architecture-report.html) | 12-page Architecture Report. Open in any browser → Print → Save as PDF (A4). |
| [`architecture-report.md`](architecture-report.md) | The same report as Markdown. Drop into Google Drive and **Open with Google Docs**. |
| [`uml/print-each.html`](uml/print-each.html) | One A4 per UML diagram. |
| [`presentation/slides.html`](presentation/slides.html) | Slide deck for the defence. |

## Folder map

```
.
├── index.html                       portal entry — open this first
├── architecture-report.html         12-page report — print to PDF
├── architecture-report.md           same report as Markdown (Google Docs friendly)
├── architecture/                    four deep-dives (protocol, sync, AI, patterns)
├── uml/                             six UML diagrams + print-each helper
├── diagrams/                        architecture, sequence, deployment SVGs
├── code-explanation/                guided per-module walk-throughs
├── plans/                           descriptive, prescriptive, sprint
├── build/, setup/                   build and quickstarts
├── audits/                          security, UI, clean-code
├── report/                          long-form report in four parts (Markdown)
├── presentation/slides.html         slide deck
└── assets/                          banners, avatars, viewer.css, portal.js
```

## How to export the PDF

1. Open `architecture-report.html` in any browser.
2. `File → Print → Destination "Save as PDF"`.
3. Paper "A4", margins "default", background graphics ON.
4. The output is exactly 12 pages.

## How to open as a Google Doc

1. Upload `architecture-report.md` to Google Drive.
2. Right-click the file and pick **Open with → Google Docs**.
3. Drive converts the Markdown into a regular Docs document.

For automatic Markdown conversion on upload, turn on
**Settings → Convert uploads** in Drive, or inside Docs go to
**Tools → Preferences → Enable Markdown**.

## License and attribution

The report, deep-dives, audits, and diagrams are the team's own work and are
released under MIT. The *Lastenheft* used as the project brief is the work
of Prof. Steffen Becker; only the team's own reading of it is published here.

---

*22 May 2026 — Anuku · Kaur · Chittomothu.*
