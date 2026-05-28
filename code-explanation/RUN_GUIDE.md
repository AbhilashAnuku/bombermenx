# Run Guide

**Project:** BomberMen-X
**Maintainer:** Abhilash Anuku (delivery and build), with input from JC (server) and SK (client)
**Date:** 29 May 2026

This guide takes a reviewer from a clean checkout to a running client connected to a running server. The procedure is tested on Windows 11 (the primary examiner platform) and on Ubuntu 22.04. The guide covers prerequisites, a native run, a Docker-based run, the port layout, environment variables, and the small but important set of troubleshooting steps that have caught us during demonstration rehearsals.

## 1. Prerequisites

- **JDK 17.** Red Hat OpenJDK 17 is the verified distribution. A portable installation under `~/tools/jdk17` is the convention used by the team and assumed throughout this guide. The portable layout avoids any change to system PATH.
- **Maven 3.9.** A portable installation under `~/tools/maven` is the team convention. The launcher is `~/tools/maven/bin/mvn.cmd` on Windows and `~/tools/maven/bin/mvn` on Linux.
- **Docker Desktop (optional).** Only required if you take the Docker path. Version 4.30 or newer is recommended.
- **Git.** Any recent version. The repository is cloned to `F:\Bomber Man X\BomberMan-X` on the team's reference Windows workstation.

To verify the toolchain, run:

```
~/tools/jdk17/bin/java -version
~/tools/maven/bin/mvn -version
```

The expected output names OpenJDK 17 and Apache Maven 3.9. If either command fails, fix the toolchain before continuing; nothing downstream will work without it.

## 2. Clone

The reference checkout lives at `F:\Bomber Man X\BomberMan-X`. On Linux, any path under your home directory is fine; the repository contains no absolute path assumptions in the source. From the parent directory of where you want the project to live:

```
git clone <repository-url> BomberMan-X
cd BomberMan-X
```

## 3. Build and test

From the repository root, run the reactor build:

```
~/tools/maven/bin/mvn clean test
```

The command compiles all three modules (`bomberman-core`, `bomberman-server`, `bomberman-client`) and runs the small but focused test suite: `WireCodecTest` and `GameWorldTest` in the core module, and `ProfanityFilterTest` in the server module. The client module currently has no tests; this is documented as known technical debt in the arc42 spec.

On a cold cache the build takes about 110 seconds on the team's reference workstation; a warm build takes 25 seconds. If the build fails, the most common cause is a stale `target/` directory left behind by a previous run with the server JAR still locked (see §7 troubleshooting).

To produce the runnable artefacts without running tests:

```
~/tools/maven/bin/mvn clean package -DskipTests
```

This produces `src/bomberman-server/target/bomberman-server.jar` and a runnable client JAR under `src/bomberman-client/target/`.

## 4. Run the server natively

In one terminal:

```
~/tools/jdk17/bin/java -jar src/bomberman-server/target/bomberman-server.jar
```

The server starts the Netty WebSocket listener on TCP 8080 and the metrics HTTP endpoint on TCP 8081. The startup banner logs the active authentication provider and the configured tick rate. A successful boot prints a final line of the form `BombServerApplication ready on ws://0.0.0.0:8080`.

If you need to override the port or the authentication provider, set the environment variables documented in §6 before starting the process.

## 5. Run the client natively

In a second terminal, use the launcher script that matches your platform:

```
infra/scripts/run-client.cmd        (Windows)
infra/scripts/run-client.sh         (Linux/macOS)
```

The launcher script resolves the portable JDK path, sets the JavaFX module-path arguments, and runs the client JAR. The client opens its main menu and offers a connect dialog defaulting to `ws://localhost:8080`. If the server is already running on the default port, the connect succeeds immediately and the lobby view appears.

For a development run without the script, invoke Maven directly from the repository root:

```
~/tools/maven/bin/mvn -pl src/bomberman-client -am javafx:run
```

This path is slower (it recompiles before running) but is the most robust during active development because it bypasses the JAR-locking issues described in §7.

## 6. Docker alternative

A Docker Compose stack provides a hermetic deployment without requiring the host to have a JDK installed. From the repository root:

```
docker compose -f infra/docker-compose.yml up --build
```

The stack builds the server image from `infra/Dockerfile.server` and exposes ports 8080 (game wire) and 8081 (metrics) on the host. The client must still run on the host machine because JavaFX inside a container would require display forwarding; the typical demo configuration is server in Docker, client on the host.

To shut the stack down cleanly:

```
docker compose -f infra/docker-compose.yml down
```

The shutdown is graceful: the server emits a `MatchEnd` envelope to every active session before closing its WebSocket listener.

## 7. Troubleshooting

### Windows JAR lock after a server restart

After the server has been running, Windows may hold an exclusive lock on `bomberman-server.jar` for several seconds after the JVM exits. If you immediately re-run `mvn clean package`, the build fails with "could not delete target". Resolution:

```
taskkill /F /IM java.exe
```

This kills any lingering Java process and releases the file lock. The command is safe to use on the demo workstation because no other Java process is expected to be running.

### Port 8080 already in use

If the server fails to bind, another process is occupying TCP 8080. Identify it:

```
netstat -ano | findstr :8080         (Windows)
ss -tlnp | grep :8080                (Linux)
```

Kill the offending process or set `BMX_PORT=8090` (or any free port) before starting the server.

### Client cannot connect

If the client's connect dialog times out, verify in order: (a) the server log shows "ready on ws://0.0.0.0:8080"; (b) `curl http://localhost:8081/health` returns 200 OK; (c) the client connect dialog points to `ws://localhost:8080` (note the `ws://` scheme, not `http://`).

### JavaFX module-path errors on Windows

If the client fails with "module javafx.controls not found", the launcher script is using a JDK without JavaFX modules. The portable JDK at `~/tools/jdk17` bundles the JavaFX SDK; verify that `JAVA_HOME` points at it before running the launcher.

### Profanity filter rejects test chat

If you are testing the chat path and your message contains incidentally-flagged words, the filter returns a `LobbyError`. This is correct behaviour. Disable the filter for the test run by setting `BMX_PROFANITY_FILTER=off` before starting the server.

## 8. Port table

| Port | Protocol      | Component        | Purpose                              |
|------|---------------|------------------|--------------------------------------|
| 8080 | WebSocket/TCP | `WebSocketServer` | Game wire (client ↔ server)         |
| 8081 | HTTP          | `MetricsHandler`  | Health and metrics endpoint          |

The metrics endpoint exposes `/health` (returns 200 OK if the server is alive) and `/metrics` (returns Prometheus-format counters). Both endpoints are read-only and require no authentication.

## 9. Environment variables

| Variable                  | Default                       | Description                                                     |
|---------------------------|-------------------------------|-----------------------------------------------------------------|
| `BMX_PORT`                | 8080                          | Game wire TCP port.                                             |
| `BMX_METRICS_PORT`        | 8081                          | Metrics HTTP port.                                              |
| `BMX_AUTH_PROVIDER`       | dev                           | One of `dev`, `google`. Selects the active provider.            |
| `BMX_GOOGLE_CLIENT_ID`    | (empty)                       | Google OAuth client id; required when provider is `google`.     |
| `BMX_TICK_HZ`             | 60                            | Server tick rate. Reducing this is useful during debugging.     |
| `BMX_PROFANITY_FILTER`    | on                            | Set to `off` to disable the moderation filter.                  |
| `BMX_RANKINGS_FILE`       | `data/rankings.csv`           | Path to the rankings persistence file.                          |
| `BMX_LOG_LEVEL`           | INFO                          | One of `DEBUG`, `INFO`, `WARN`, `ERROR`.                        |

These variables are read by `ServerConfig` at boot. The client also honours `BMX_SERVER_URL` to override the default connection target.

## 10. Demo runbook (for the defence)

For the defence demonstration, the following sequence has been rehearsed and is the recommended path:

1. Open three terminals.
2. Terminal 1: start the server with `BMX_LOG_LEVEL=DEBUG` so the wire traffic is visible.
3. Terminal 2: start client A. Authenticate, enter the lobby, customise an avatar.
4. Terminal 3: start client B. Authenticate, enter the lobby, customise an avatar.
5. From client A, start a match. Both clients join.
6. Demonstrate: bomb placement, power-up pickup, throw, kill, kill feed, match end, rankings.
7. From terminal 1, hit `Ctrl+C`. The server emits `MatchEnd` to both clients and closes cleanly.

Keep the metrics endpoint open in a browser tab throughout the demo for live counter inspection. The examiner appreciates seeing the snapshot-broadcast counter ticking at 60 Hz.

## 11. Source-of-truth pointers

If something in this guide disagrees with the source, the source wins. The relevant files are:

- `pom.xml` (root reactor)
- `src/bomberman-server/pom.xml`
- `src/bomberman-client/pom.xml`
- `infra/docker-compose.yml`
- `infra/Dockerfile.server`
- `infra/scripts/run-client.cmd`, `infra/scripts/run-client.sh`
- `src/bomberman-server/src/main/java/de/srh/bomberman/server/config/ServerConfig.java`

Report any drift to AA.
