# BomberMen-X Showcase

Live project showcase for **BomberMen-X**, a distributed multiplayer Bomberman prototype built for a Software Architecture and Development module.

This repository hosts the public presentation page and browser-based walkthrough. The full source project is maintained separately.

## Live Demo

[Open the showcase](https://abhilashanuku.github.io/bombermenx/)

## What It Demonstrates

- Client-server architecture for real-time multiplayer gameplay
- Server-authoritative simulation for fair state management
- Component-and-Connector architecture documentation
- arc42-style architecture explanation
- Runtime sequence diagrams and deployment view
- Interactive browser walkthrough of the game flow

## Recruiter Notes

This repo is intentionally a showcase page, not the full implementation repository. It is useful for quickly reviewing:

- How the system is explained to a non-code audience
- Architecture trade-offs and design decisions
- UI flow and gameplay concept
- Visual documentation quality

## Repository Structure

```text
.
├── index.html                 # Public GitHub Pages showcase
├── assets/                    # Screenshots, banners, diagrams, character art
├── prototype/                 # Self-contained browser walkthrough
└── README.md
```

## Related Source Project

The implementation is a Java 17 / Maven client-server prototype with:

- shared core gameplay rules
- authoritative game server
- JavaFX desktop client
- WebSocket communication
- automated build/test support

## Local Preview

Because this is a static site, it can be previewed with any simple static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Status

Public showcase page for academic and portfolio review.
