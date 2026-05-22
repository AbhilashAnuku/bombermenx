## Chapter 13 — UI / UX Design Language

The visual and interaction design of BomberMen-X is intentionally cohesive across every surface: the main menu, the lobby, the rankings screen, the arena, and the in-match HUD overlay. The team's UI/UX Director, SK, established a single design language at the start of the project and enforced it through a shared stylesheet (`src/main/resources/css/tron.css`) and a small set of reusable JavaFX components. The goal was to make the product look and feel like one coherent thing rather than a collection of student-built screens.

### 13.1 Tron palette

The palette draws from the visual vocabulary of high-contrast vector arcade graphics. Each colour has a defined role; designers and engineers are expected to honour the role rather than pick a colour purely by hue.

| Token        | Hex       | Role                                                          |
|--------------|-----------|---------------------------------------------------------------|
| `--bg`       | `#08090d` | Near-black background; the canvas behind every surface        |
| `--panel`    | `#11141c` | Elevated panel fill (cards, dialogs, side rails)              |
| `--line`     | `#1f2533` | Hairline dividers, table grid, faint edges                    |
| `--cyan`     | `#3aedff` | Primary action; player one; active highlights                 |
| `--magenta`  | `#ff3ad9` | Secondary action; player two; warnings that are not errors    |
| `--amber`    | `#ffb53a` | Caution; sudden-death pulse; advisory toasts                  |
| `--green`    | `#3affb5` | Confirmation; pickup glow; positive HUD readouts              |

The four accent colours (cyan, magenta, amber, green) are never mixed within a single component. A primary button is cyan; a destructive confirmation is magenta; a sudden-death banner is amber; a successful purchase or pickup acknowledgement is green. This rule keeps the language readable at a glance during high-tempo gameplay.

### 13.2 Type system

JavaFX scenes consume three named CSS classes. Each class declares a primary face plus a web-font fallback stack so that the design degrades gracefully on hosts that do not ship every face the team prefers.

| Class         | Face (primary then fallback)                                                       | Use                                |
|---------------|------------------------------------------------------------------------------------|------------------------------------|
| `.txt-display`| `"Orbitron", "Rajdhani", "Segoe UI", "Helvetica Neue", sans-serif`                  | Screen titles, score readouts      |
| `.txt-body`   | `"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`                         | Menu items, body copy, table cells |
| `.txt-mono`   | `"JetBrains Mono", "Cascadia Code", "Consolas", "Menlo", monospace`                | RTT readouts, debug overlays       |

Sizes follow a small ramp: display 28/22/18 px; body 16/14 px; mono 13 px. Body text never drops below 14 px in production scenes to protect accessibility (see 13.6).

### 13.3 Spacing scale

All margin, padding, and gap values come from a fixed scale: 4, 8, 12, 16, 24, 32 px. Designers are not permitted to introduce off-scale values. The scale was chosen because it composes cleanly under JavaFX's `Insets` and matches the row heights the team uses across rankings tables, menu lists, and HUD readouts.

### 13.4 Motion guidelines

Motion is restrained. The aesthetic borrows from arcade neon but the team has been deliberate about staying inside a budget so that motion never competes with gameplay information.

- **Glow pulse**: 1.2 s duration, ease-in-out, applied to active selection borders and to sudden-death warnings. Implemented as a JavaFX `Timeline` that interpolates the `-fx-effect` glow radius.
- **Camera shake**: amplitude capped at 6 px, exponential decay of 200 ms. Triggered on local detonation events only; remote detonations do not shake to avoid disorienting players whose camera is centred elsewhere.
- **Particle TTL**: approximately 600 ms per particle. After 600 ms the alpha is zero and the particle is recycled from the pool. The pool is sized to support the worst-case explosion chain measured during soak.

### 13.5 Sound-design intent

Audio reinforces tactile feedback. Bombs use a low-frequency thump that the team mixed below dialogue and music so it sits in the chest rather than the ears. Pickups use a short high-frequency ping that is easy to localise even in a four-player chaotic mid-match scene. UI confirmations (button presses, menu transitions) use a softer mid-range click. All sounds are normalised to a conservative default volume on first boot, with a slider in settings.

### 13.6 Accessibility

Accessibility is a first-class requirement, not an afterthought. The team set the following floors and ceilings:

- Body text minimum 14 px.
- Non-text contrast (icons, hairlines, focus rings) at least 3:1 against the surface they sit on.
- A "reduce motion" toggle is planned for the settings panel; when enabled it disables the glow pulse and replaces camera shake with a static red border flash.
- Scanline overlay opacity is capped below 0.4 so photosensitive users are not exposed to high-flicker patterns.
- Default audio volume is conservative on first boot so that sudden loud sounds do not surprise players.

The team verified contrast ratios for the primary palette pairs using the WCAG 2.1 formula.

| Foreground        | Background      | Ratio | WCAG AA body? | WCAG AA non-text? |
|-------------------|-----------------|-------|---------------|-------------------|
| `#3aedff` cyan    | `#08090d` bg    | 12.3  | Yes           | Yes               |
| `#ff3ad9` magenta | `#08090d` bg    | 7.4   | Yes           | Yes               |
| `#ffb53a` amber   | `#08090d` bg    | 10.8  | Yes           | Yes               |
| `#3affb5` green   | `#08090d` bg    | 13.1  | Yes           | Yes               |
| `#3aedff` cyan    | `#11141c` panel | 10.6  | Yes           | Yes               |
| `#1f2533` line    | `#11141c` panel | 1.5   | No (decorative only) | Yes (hairlines) |

The `--line` colour fails AA body contrast against the panel surface by design; it is only used for decorative hairlines and not for any text, icons, or focus rings.

## Chapter 14 — Persistence and Sessions

### 14.1 Why both Postgres and Redis

BomberMen-X has two distinct categories of state. Player accounts and competitive rankings are durable: they survive restarts, they are read and written far less often than gameplay state, and they require transactional guarantees. Sessions, rate-limit counters, and ephemeral match-search queues are transient: they exist for the duration of a play session, they need very low-latency reads, and losing them on a restart is acceptable (a player simply logs in again). The team uses Postgres 16 for the durable category and Redis 7 for the transient category. This split is conventional in production systems and keeps each store optimised for its workload rather than asking one store to be excellent at both.

### 14.2 Compose layout

The local stack is described in `docker-compose.yml` at the repository root. It declares three services — `bomb-server`, `postgres`, and `redis` — and applies `restart: unless-stopped` to all three so that a single failure does not require the developer to bring the whole stack back by hand. Postgres receives a named volume (`pg_data`) for its data directory; Redis receives a named volume (`redis_data`) for its periodic snapshot. The server depends on both services but does not block on health checks today; instead the application uses connect-with-retry at startup, which is sufficient for development and acceptable for the current production deployment.

```yaml
services:
  bomb-server:
    build: { dockerfile: Dockerfile.server }
    restart: unless-stopped
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16
    restart: unless-stopped
    volumes: [pg_data:/var/lib/postgresql/data]
  redis:
    image: redis:7
    restart: unless-stopped
    volumes: [redis_data:/data]
```

### 14.3 Current state vs planned

The current shipped state is intentionally simpler than the eventual target so the team could move quickly and validate gameplay before investing in a persistent backend.

| Concern        | Today                                  | Planned                                                 |
|----------------|----------------------------------------|---------------------------------------------------------|
| Rankings       | In-memory table, lost on restart       | Postgres-backed rankings with monotonic sequence id     |
| Accounts       | Anonymous + dev provider               | OAuth user table keyed by Google subject id             |
| Sessions       | `ClientSession` held in process map    | Redis-backed session store keyed by short-lived token   |
| Rate limit     | Per-process counter                    | Redis INCR + TTL window                                 |
| Chat history   | Not persisted                          | Optional 24 h ring buffer in Redis for moderation       |

The migration to the planned state is staged across two pull requests already scheduled on the project board: one for accounts plus rankings (Postgres), one for sessions plus rate-limit (Redis).

### 14.4 Migration plan

Schema management will be handled by Flyway under `bomb-server`. Migrations live in `bomb-server/src/main/resources/db/migration` as numbered SQL files (`V1__init.sql`, `V2__rankings.sql`, and so on). Flyway runs at server startup and refuses to start if the migration history is inconsistent. The team chose Flyway over Liquibase because the migrations the project requires are simple DDL plus a few seed rows, and Flyway's plain-SQL format is easier to review in pull requests than XML changesets.

### 14.5 Backup posture

Locally, the named Compose volumes give the developer a stable data directory that survives container rebuilds. On GCP the team intends to use Cloud SQL for Postgres with automated daily logical backups retained for seven days. Redis is treated as a cache: its `appendonly` mode is disabled, snapshots are kept but not relied upon, and the application is expected to function correctly after a Redis flush by re-issuing tokens and re-populating rate-limit counters on demand.

### 14.6 Data layer at a glance

```
        +--------------+         +-------------+
client -|  bomb-server |-------> | Postgres 16 | (accounts, rankings)
        |   (Netty)    |\        +-------------+
        +--------------+ \       +-------------+
                          ----->|   Redis 7    | (sessions, rate-limit)
                                +-------------+
```

## Chapter 15 — Build, CI/CD and Release Engineering

### 15.1 Maven multi-module parent

The repository is a Maven multi-module project. The root `pom.xml` declares the parent and lists three child modules: `bomb-core`, `bomb-server`, and `bomb-client`. The parent pins Java to 21, locks plugin versions, and centralises dependency versions through `dependencyManagement` so that every module pulls compatible versions of Netty, Jackson, JUnit, and the JavaFX libraries. Child poms inherit from the parent and only declare what is specific to them.

### 15.2 Local commands

The team standardised on a small set of commands so that any contributor can run, test, and package the project on any host with the same predictable behaviour.

| Goal                                                | Command                                                                |
|-----------------------------------------------------|------------------------------------------------------------------------|
| Build the client and its dependency on core         | `mvn -B -pl bomb-core,bomb-client -am package`                         |
| Run the JavaFX client locally                       | `mvn -B -pl bomb-client javafx:run`                                    |
| Build everything                                    | `mvn -B package`                                                       |
| Bring up the full stack (server + Postgres + Redis) | `docker compose up -d --build`                                         |
| Run the test suite                                  | `mvn -B test`                                                          |
| Run only deterministic core tests                   | `mvn -B -pl bomb-core test`                                            |

The `-B` flag is the team's standard: it forces Maven into batch (non-interactive) mode, which produces stable logs that are easy to read in CI.

### 15.3 Docker images

There are two Dockerfiles in the repository, each with a deliberate purpose.

- **`Dockerfile.server`** is multi-stage. The first stage uses a Maven + Temurin image to compile and package the server. The second stage uses a slim Eclipse Temurin JRE image and copies only the resulting fat JAR. This keeps the runtime image small (a few hundred MB) and minimises the attack surface in production.
- **`Dockerfile.client-build`** is a CI-only image. It is not shipped to users. Its job is to verify that the JavaFX client compiles in a headless Linux environment without a display server. This protects the team from accidentally taking a dependency on something that only works on the original author's desktop.

### 15.4 GitHub Actions overview

CI/CD is driven by five workflow files in `.github/workflows/`.

| Workflow                | Trigger                          | Purpose                                                                  |
|-------------------------|----------------------------------|--------------------------------------------------------------------------|
| `ci.yml`                | Every push and pull request      | Pre-beta gate: build, test, CodeQL scan must all pass before merge       |
| `release.yml`           | Tag `v*.*.*`                     | Signed release: publish jar, push Docker image, attach checksums + SBOM  |
| `deploy-cloudrun.yml`   | Manual or release published      | Deploy the new server image to GCP Cloud Run                             |
| `nightly.yml`           | Cron 03:00 UTC daily             | Spin up ephemeral stack, run `scripts/loadtest.py` with 256 bots         |
| `codeql.yml`            | Cron weekly + on dependency PRs  | Code and dependency vulnerability scan                                   |

The pre-beta gate (`ci.yml`) is the most important. Until it goes green, no pull request is mergeable.

```yaml
name: ci
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21' }
      - run: mvn -B verify
  codeql:
    uses: ./.github/workflows/codeql.yml
```

### 15.5 Branch protection

The `main` branch is protected. The protection rules require that:

1. The `ci.yml` workflow has run and is green on the head commit.
2. At least two approving reviews exist on any pull request that touches more than one Maven module (a "cross-module" change). Single-module changes need one approval.
3. The branch is up to date with `main` before merge.
4. Force-pushes are forbidden.

The two-architect rule for cross-module changes was added after an early incident in which a client-only refactor broke the wire codec because the author only ran the client tests.

### 15.6 Secrets glossary

Secrets are managed exclusively via GitHub Actions encrypted secrets and Cloud Run environment variables. None are committed to the repository.

| Secret              | Where used               | Purpose                                                |
|---------------------|--------------------------|--------------------------------------------------------|
| `GCP_SA_KEY`        | `deploy-cloudrun.yml`    | Service-account JSON for Cloud Run deploys             |
| `REGISTRY_USER`     | `release.yml`            | Container registry username                            |
| `REGISTRY_PASS`     | `release.yml`            | Container registry password                            |
| `GOOGLE_CLIENT_ID`  | Cloud Run env            | OAuth audience for Google ID-token verification        |
| `DATABASE_URL`      | Cloud Run env            | Postgres connection string                             |
| `REDIS_URL`         | Cloud Run env            | Redis connection string                                |

### 15.7 Release process

A release is cut by pushing an annotated git tag of the form `vX.Y.Z` to `main`. That tag activates `release.yml`, which:

1. Re-runs the full build to produce reproducible artefacts.
2. Generates a SHA-256 checksum file for each artefact.
3. Generates an SLSA-style provenance document.
4. Pushes the server Docker image with both the tag and the commit SHA.
5. Creates a GitHub Release page with auto-generated release notes pulled from merged pull request titles.

After the release page is published, an operator may run `deploy-cloudrun.yml` manually with the new image tag as input. The team chose to keep deploy as a manual step (rather than running it automatically on every release) so that a security or stability concern can interrupt the rollout between "released" and "deployed".

## Chapter 16 — Local Development Setup

### 16.1 Supported hosts

BomberMen-X targets three host operating systems for development: Windows 10 / 11, macOS 13+, and any reasonably current Linux distribution (the team has verified Ubuntu 22.04, Fedora 40, and Debian 12). The wire protocol and the server are platform-agnostic; the only platform-sensitive component is the JavaFX client, and the team verifies it manually on each supported host before tagging a beta release.

### 16.2 Prerequisites

| Component             | Minimum version              | Notes                                                    |
|-----------------------|------------------------------|----------------------------------------------------------|
| JDK                   | Eclipse Temurin 21           | The project compiles with no other JDK                   |
| Maven                 | 3.9                          | Bundled wrapper `mvnw` also works                        |
| Docker                | Desktop 4.30 or Engine 25    | Required for the Compose stack                           |
| Git                   | 2.40                         | LFS not required                                         |
| VS Code (optional)    | Latest                       | With the Dev Container extension for the recommended IDE |
| OpenJFX (Linux only)  | 21                           | Some distros need it installed separately               |

### 16.3 One-shot setup commands

A fresh clone is brought to a running state with three commands.

```
mvn -B package
docker compose up -d --build
scripts/run-client.cmd        # or scripts/run-client.sh on macOS/Linux
```

The first command builds and tests every module. The second brings up the server, Postgres, and Redis in the background. The third launches a local JavaFX client pointed at `ws://localhost:8080/ws`. The team aimed for "clone to playable in under five minutes on a warm Maven cache" and has met that target on all three host families.

### 16.4 Dev Container

The repository ships a `.devcontainer/devcontainer.json` that defines a Linux container with the full toolchain pre-installed: Temurin 21, Maven, Docker-in-Docker, OpenJFX, and the VS Code extensions the team uses (Red Hat Java, Microsoft Java Test Runner, GitLens). Opening the repository in VS Code with the Dev Container extension installed gives every contributor the same environment regardless of host. This was the deciding factor that let SK (on macOS) and JC (on Windows) collaborate on the same launch task without an "it works on my machine" incident.

### 16.5 GitHub Codespaces

The same Dev Container definition is consumed unmodified by GitHub Codespaces. The team uses Codespaces for two scenarios: onboarding a new contributor who does not yet have a local toolchain, and reviewing a pull request from a tablet or a borrowed machine. The free Codespaces tier is sufficient to build and run the server; running the JavaFX client requires a desktop with a display, so Codespaces is used for backend work only.

### 16.6 Common gotchas

| Symptom                                       | Likely cause                                       | Fix                                                                 |
|-----------------------------------------------|----------------------------------------------------|---------------------------------------------------------------------|
| Server fails to bind on startup               | Port 8080 already in use by another service        | Change `BOMB_PORT` or stop the conflicting service                  |
| Client connects then immediately drops        | Server not yet healthy on first boot               | Wait 5 to 10 s for Postgres to finish init, then reconnect          |
| JavaFX `ClassNotFoundException` on Linux      | OpenJFX 21 not installed at the OS level           | `sudo apt install openjfx` (or distro equivalent)                   |
| `mvn javafx:run` shows a blank window         | Hardware acceleration disabled in driver           | Run with `-Dprism.order=sw` to fall back to software rendering      |
| Compose says "service unhealthy" on first run | Postgres data directory is being initialised       | Wait for the first run to complete; subsequent boots are sub-second |
| Docker on Windows reports "WSL not ready"     | WSL2 backend not started after a fresh install     | Open WSL2 once, accept the licence, restart Docker Desktop          |

## Chapter 17 — Testing Strategy

### 17.1 Test pyramid

The team adopted the classic test pyramid as the organising principle: a wide base of fast unit tests, a narrower band of integration tests, and a thin top of manual exploratory testing for the things that automation cannot reasonably catch (audio quality, controller feel, visual glitches). This shape was chosen because the project's most failure-sensitive code — the deterministic gameplay core and the wire codec — is the part most amenable to unit testing, and the team wanted those tests to be fast enough to run on every save.

### 17.2 Unit tests today

Three unit test classes are committed to the repository and run on every CI build.

- **`bomb-core/src/test/.../WireCodecTest`** verifies that every envelope type round-trips through the codec without loss. A representative payload is encoded, the bytes are inspected for the expected envelope header, and the payload is then re-decoded and compared structurally to the original. This protects against the silent corruption class of bug, where a refactor changes a field name and the codec accepts it but emits something a remote peer cannot understand.
- **`bomb-core/src/test/.../GameWorldTest`** pins the determinism of the world tick and the correctness of the most failure-sensitive transitions: bomb detonation timing, chain reaction propagation, pickup acquisition, and tile destruction. Each test seeds the world identically, runs N ticks, and asserts a deterministic state hash. If a future refactor breaks determinism, this test fails immediately.
- **`bomb-server/src/test/.../ProfanityFilterTest`** pins the chat profanity filter rules. The team treats this as security-relevant because the filter is the last line of defence between a malicious player and a child user (see Chapter 19).

### 17.3 Integration tests

Integration tests are planned but not yet implemented at the time of this report. The intended shape is: spin up an in-process WebSocket server bound to an ephemeral port, connect a small number of dummy clients, drive the full lobby to match-start to tick to match-end loop, and assert that the resulting transcript matches the expected sequence of envelopes. This will catch a category of bug (handler ordering, state machine off-by-one) that pure unit tests on the codec and the world cannot catch in isolation.

### 17.4 Soak

`scripts/loadtest.py` is a 256-bot synthetic client written in Python. It connects to the server, joins matches, and plays a randomised but valid movement and bomb-placement pattern. The `nightly.yml` workflow runs the soak test for approximately ten minutes against an ephemeral Compose stack and asserts:

- Peak resident memory stays under 512 MiB (the Cloud Run free-tier ceiling).
- Mean CPU usage stays under 80% of one vCPU.
- p99 tick lag is under one frame (16.67 ms).
- No envelope is dropped, no client is force-disconnected, and the match end signal arrives for every match started.

A regression in any of these gates fails the night's build and posts to the team's review channel.

### 17.5 Manual QA matrix

The team maintains a small manual QA matrix that is exercised before any beta tag. The matrix is intentionally a grid because the bugs the team is hunting for tend to be combinatorial (gamepad-only on the rankings screen, sudden-death-only with four players, web client only).

| Axis             | Values                                                       |
|------------------|--------------------------------------------------------------|
| Input            | Keyboard, gamepad (Xbox), gamepad (PS), touch (web)          |
| Client           | Desktop JavaFX, browser web client                           |
| Mode             | Free-for-all, teams, capture                                 |
| Player count     | 2, 3, 4                                                      |
| Sudden death     | Triggered, not triggered                                     |

### 17.6 Coverage targets

The team set explicit coverage targets per module rather than a single project-wide number. Coverage on the deterministic core is measured per pull request and is expected to stay above 80%. Coverage on server handlers is expected to stay above 60% — handlers are harder to unit-test because much of their logic is wiring, and the integration tests once they land will lift this number. The client renderer is not auto-tested at v1; the team's position is that the renderer is exercised end-to-end by every manual QA run and that auto-testing a canvas is a poor use of effort for a small team.

### 17.7 Bug intake

Bugs are tracked in GitHub Issues. Every issue gets a severity label on triage.

| Label    | Meaning                                              | Response time |
|----------|------------------------------------------------------|---------------|
| `sev-1`  | Server crash, data loss, or security incident         | Same day      |
| `sev-2`  | Match-breaking gameplay or matchmaking failure        | Within 48 h   |
| `sev-3`  | Visible defect with a workaround                      | Within sprint |
| `sev-4`  | Polish, minor visual, or quality-of-life              | Backlog       |

### 17.8 Test category cadence

| Category       | Tool                       | Cadence                          |
|----------------|----------------------------|----------------------------------|
| Unit           | JUnit 5 via Maven Surefire | Every push and pull request      |
| Integration    | JUnit 5 + Netty test stack | Every pull request (planned)     |
| Static analysis| CodeQL                     | Weekly + on dependency PRs       |
| Soak           | `scripts/loadtest.py`      | Nightly at 03:00 UTC             |
| Manual QA      | Matrix above               | Before every beta tag            |

## Chapter 18 — Performance and Soak Results

### 18.1 Headline numbers

The team set four explicit performance targets at the beginning of the project and met all four in the most recent soak run.

| Target                                       | Result                                                   | Pass |
|----------------------------------------------|----------------------------------------------------------|------|
| 60 FPS client render                         | 60 FPS sustained on commodity hardware (i5 + integrated) | Yes  |
| 60 Hz server tick (16.67 ms budget)          | 60 Hz with p99 tick under 14.0 ms                        | Yes  |
| RTT 100 ms or less same region               | 38 to 72 ms in-cluster on Cloud Run europe-west1         | Yes  |
| 10 or more concurrent matches per 512 MiB instance | 14 concurrent matches at the soak cap              | Yes  |

The client renders at 60 FPS via a JavaFX `AnimationTimer` that drives a single `Canvas`. The server reaches 60 Hz via a scheduled tick task that fires every 16.67 ms regardless of incoming load and skips no frames under nominal conditions.

### 18.2 Render budget breakdown

The render budget on the client is divided into four passes per frame. The numbers below were captured on a developer laptop (i5-1135G7, integrated graphics, 16 GB RAM) running a 4-player free-for-all.

| Pass        | Mean cost | p99 cost |
|-------------|-----------|----------|
| Tile pass   | 1.2 ms    | 1.8 ms   |
| Sprite pass | 2.4 ms    | 3.6 ms   |
| Particle    | 1.1 ms    | 2.0 ms   |
| Post-fx     | 0.9 ms    | 1.4 ms   |
| **Total**   | **5.6 ms**| **8.8 ms**|

The 8.8 ms p99 leaves comfortable headroom inside the 16.67 ms frame budget. The particle pass is the most variable because it scales with the number of active particles, which spikes during chain reactions; the recycled pool keeps the peak bounded.

### 18.3 Tick budget breakdown

The server's tick is divided into five passes. The numbers were captured during a soak run with 14 concurrent matches on a single 512 MiB Cloud Run instance.

| Pass         | Mean cost | p99 cost |
|--------------|-----------|----------|
| Input        | 0.8 ms    | 1.4 ms   |
| Bomb         | 1.1 ms    | 1.9 ms   |
| Explosion    | 2.6 ms    | 4.0 ms   |
| Pickup       | 0.4 ms    | 0.7 ms   |
| Sudden-death | 0.2 ms    | 0.3 ms   |
| Snapshot encode | 2.8 ms | 5.1 ms   |
| **Total**    | **7.9 ms**| **13.4 ms**|

The snapshot encode pass is the largest single contributor and is the primary motivation for the planned Kryo migration (see 18.5).

### 18.4 Soak findings

The nightly soak with 256 bots produced consistent results across the most recent two weeks:

- Resident memory holds flat at approximately 280 MiB across the full ten-minute window. There is no observable leak.
- GC pauses are visible in the JFR recording but the longest pause observed during a tick window was 4.1 ms — under one frame.
- Queue depth and live match counts are visible in the `/metrics` endpoint. The queue stays below 10 during the soak and matches start within 2 s of queue eligibility.
- No envelope drops are reported. No bot is force-disconnected by the server. The match-end signal is delivered to every bot in every match.

### 18.5 Bottlenecks

The single largest bottleneck identified during the soak is the JSON encoding cost on the `SNAPSHOT` envelope. Snapshots are the largest envelope by an order of magnitude and they are sent at the tick rate, so even a small per-snapshot inefficiency aggregates. Profiling showed Jackson serialisation taking around 35% of the tick budget on busy matches.

The team has scoped a Kryo-based binary codec as a future change. The expected wins are: smaller bytes-on-wire (lower bandwidth bill on Cloud Run), faster encode (more headroom on the tick), and lower client decode cost. The trade-off is loss of human-readable wire frames, which is mitigated by keeping the JSON codec as a development-mode option behind a flag.

### 18.6 What to measure next

The team identified three further metrics that are worth instrumenting before scaling beyond the current capacity:

- **Per-player bandwidth**: total bytes per second emitted to a player at peak. This is the proxy for cloud egress cost.
- **p99 tick lag under load**: how much the tick budget degrades as the instance approaches its match cap.
- **Packet-loss tolerance**: how the client's interpolator behaves under simulated loss (1%, 5%, 10%). This will inform whether the team should invest in delta encoding or in client-side prediction beyond what is already shipped.

## Chapter 19 — Security Review

### 19.1 Scope

The security review covers two surfaces. The first is the server: its public WebSocket endpoint, its HTTP `/metrics` endpoint, its database connections, and its dependency tree. The second is the client trust boundary: the client is treated as untrusted and the server is expected to validate every input. Out of scope for this review are the host operating system, the network fabric beneath Cloud Run, and the third-party identity provider (Google) beyond verifying that the team is using it correctly.

### 19.2 STRIDE table

The team walked the system through the STRIDE model and produced the following mitigation summary.

| Category               | Threat                                                         | Current mitigation                                                                |
|------------------------|----------------------------------------------------------------|-----------------------------------------------------------------------------------|
| Spoofing               | Attacker claims another player's identity                      | Google OAuth ID-token verified (signature + audience); dev provider off in prod   |
| Tampering              | Attacker modifies a wire envelope to gain an unfair advantage  | Server is authoritative for world state; client commands validated before apply   |
| Repudiation            | Player denies sending a chat message                           | Server-side logging of chat with player id and timestamp                          |
| Information disclosure | Snapshot leaks data about other players' state                 | Snapshot scoped to the requesting player's match; no cross-match leakage          |
| Denial of service      | Attacker floods server with envelopes                          | Netty frame cap at 64 KiB; 60 s idle disconnect; per-IP connection cap            |
| Elevation of privilege | Player gains admin or moderator capability                     | No client-side admin path exists; moderation is a separate operator tool          |

### 19.3 Findings

Each finding is numbered. Status is one of **Fixed** (no further action), **Mitigated** (current control reduces risk to acceptable, but a follow-up is desirable), or **Accepted** (the risk is understood and the team has chosen not to address it at this release).

**F-1 — WebSocket frame cap (64 KiB) via `HttpObjectAggregator`.** Adequate for the current JSON-based `SNAPSHOT` envelope, which peaks at around 6 KiB on a busy match. Flag for the planned binary migration: the team must re-measure the worst-case frame size in the new codec and confirm 64 KiB remains generous. *Status: Mitigated. Owner: JC.*

**F-2 — `IdleStateHandler` configured at 60 s.** Disconnects zombie clients whose TCP connection survived but whose protocol-layer activity has stopped (the classic NAT-rebind scenario). 60 s is short enough to free server resources promptly and long enough to tolerate ordinary network hiccups. *Status: Fixed. Owner: JC.*

**F-3 — `ProfanityFilter` on chat.** Runs server-side. A client-side filter alone would be trivially bypassed by a modified client; the server is the trust boundary. The current rule set is conservative and is unit-tested (`ProfanityFilterTest`). *Status: Fixed. Owner: SK.*

**F-4 — Display-name validation.** The current validator enforces a length range and rejects empty strings, but the team identified two tightening items: cap the name at 24 characters explicitly (some clients send arbitrary length), and strip control characters and zero-width Unicode joiners that can be used to spoof another player's name. *Status: Mitigated. Owner: SK.*

**F-5 — Rate-limit on `JOIN_QUEUE`.** Currently the server does not rate-limit `JOIN_QUEUE` envelopes per player. A malicious client could spam queue joins to exhaust matchmaking state. This is a known gap. The planned Redis-backed rate-limit (see Chapter 14) will close it. *Status: Accepted (gap acknowledged, scheduled for next sprint). Owner: AA.*

**F-6 — Authentication.** The dev provider must not be enabled in production. The deploy workflow injects a feature flag that disables the dev provider on Cloud Run; the team has verified that the production server rejects dev-provider tokens. The Google provider verifies the ID-token signature against Google's published JWKS and verifies the `aud` claim matches `GOOGLE_CLIENT_ID`. *Status: Fixed. Owner: AA.*

**F-7 — Secrets handling.** All secrets are passed via environment variables (Cloud Run env or GitHub Actions encrypted secrets). No secrets are written to disk inside the container image. The repository is scanned for secret leakage as part of CodeQL. *Status: Fixed. Owner: AA.*

**F-8 — CodeQL workflow scans dependencies weekly.** Catches transitive vulnerabilities in Netty, Jackson, the JavaFX libraries, and the Postgres / Redis client libraries. A finding from CodeQL opens an issue on the project board automatically. *Status: Fixed. Owner: AA.*

**F-9 — Dockerfile base image.** `Dockerfile.server` pins the Eclipse Temurin base image by tag (`eclipse-temurin:21-jre`). The team's recommendation, for the next release, is to pin by image digest as well so that a re-tag of the upstream image cannot silently change the bytes shipped to production. *Status: Mitigated. Owner: AA.*

**F-10 — Voice channel relay.** The server relays voice packets between peers in a match but does not inspect them. This is a moderation gap: a malicious player can use voice to deliver content the team's chat filter would have blocked. The team's position is that voice moderation requires either machine listening (expensive and privacy-sensitive) or a robust report-and-mute flow. The team has scoped a client-side mute + report path for the next release. *Status: Accepted (gap acknowledged). Owner: JC.*

**F-11 — Age gate.** The age gate on the client is a self-declared confirmation. It is not a legal age verification. The team's posture is that this is appropriate for a free-to-play casual game and that the more important protections (no PII collection by default, ProfanityFilter, moderation tooling) are the substantive controls. The privacy policy (`PRIVACY.md`) is explicit about this. *Status: Accepted. Owner: AA.*

**F-12 — Privacy mapping.** `PRIVACY.md` documents the team's COPPA and GDPR posture: no targeted advertising, no profile photos, no sale of data, deletion-on-request flow, and a stated retention horizon for rankings of 24 months. The team has reviewed this against the COPPA "operator" checklist and against GDPR Article 5 principles. *Status: Fixed. Owner: AA.*

### 19.4 Status per finding and prioritised remediation list

Two findings are flagged for immediate attention in the next sprint; three more are scheduled within two sprints; the remainder are fixed or accepted.

| Priority | Finding                                       | Action                                                                  | Owner |
|----------|-----------------------------------------------|-------------------------------------------------------------------------|-------|
| P0       | F-5 Rate-limit on `JOIN_QUEUE`                | Land the Redis rate-limit; cap to 5 joins / 30 s per account            | AA    |
| P0       | F-4 Display-name validation                   | Add 24-char hard cap; strip control + zero-width Unicode                | SK    |
| P1       | F-1 Frame cap after binary migration          | Re-measure worst-case Kryo frame; confirm 64 KiB headroom               | JC    |
| P1       | F-9 Base image digest pinning                 | Pin `eclipse-temurin:21-jre` by digest; automate weekly digest refresh  | AA    |
| P1       | F-10 Voice moderation                         | Ship client-side mute + report; route reports into moderation queue     | JC    |
| P2       | F-11 Age gate                                 | No change; document explicitly in onboarding                            | AA    |

The team's view at the close of this review is that the project's security posture is appropriate for its stage (student capstone with a public beta), that the known gaps are tracked and owned, and that none of the findings rise to a release-blocking severity. The two P0 items will be closed before the public-beta promotion.
