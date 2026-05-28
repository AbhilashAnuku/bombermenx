# BomberMen-X — Build and Run Guide

**Project:** BomberMen-X (M.Sc. capstone, SAD module, SRH University Stuttgart)
**Supervisor:** the course supervisor
**Document date:** 29 May 2026

This document describes how to build, test, and run the BomberMen-X prototype. It targets a fresh Windows 11 or Linux developer machine. All paths in this guide are absolute or repository-relative.

---

## 1. Prerequisites

### 1.1 Java Development Kit

BomberMen-X requires **JDK 17** (LTS). The reference toolchain is **Red Hat OpenJDK 17**, installed at:

```
C:\Program Files\RedHat\java-17-openjdk-17.0.19.0.10-1
```

Any conforming JDK 17 distribution will work (Temurin, Zulu, Liberica). Versions 18 – 21 have not been validated and should be avoided for the submission demo.

Verify with:

```
java -version
```

Expected output begins with `openjdk version "17.`.

### 1.2 Apache Maven

BomberMen-X requires **Maven 3.9** or newer. A portable installation under the user's home directory is recommended and is what the team uses:

```
~/tools/maven/bin/mvn.cmd          (Windows)
~/tools/maven/bin/mvn              (Linux / macOS)
```

No admin rights or PATH configuration are required when the portable layout is used. Verify with:

```
~/tools/maven/bin/mvn.cmd -v
```

Expected: `Apache Maven 3.9.x` plus the Java runtime line pointing at the Red Hat JDK.

### 1.3 Optional — Docker Desktop

Required only for the Compose deployment walkthrough in section 5. Any recent Docker Desktop with BuildKit enabled is sufficient.

### 1.4 Optional — Git

Required only to clone the repository. The submission ZIP contains a self-contained source tree and does not require Git.

---

## 2. Quick start (under 90 seconds)

From the repository root `F:\Bomber Man X\BomberMan-X\`:

```
# 1. Build and run all tests
~/tools/maven/bin/mvn.cmd clean test

# 2. Package the server fat-jar
~/tools/maven/bin/mvn.cmd -pl src/bomberman-server -am package

# 3. Run the server
java -jar src/bomberman-server/target/bomberman-server-0.1.0-SNAPSHOT.jar

# 4. In a second terminal, run the client
~/tools/maven/bin/mvn.cmd -pl src/bomberman-client -am javafx:run
```

A successful run prints `WebSocketServer listening on :8080` on the server side and opens the JavaFX `MainMenuView` on the client side. Use `DevAuthProvider` (anonymous UUID) to sign in, pick a lobby slot, and start a match.

---

## 3. Detailed build steps per module

### 3.1 `bomberman-core`

The shared library. No runtime dependencies beyond Jackson for JSON. Build with:

```
~/tools/maven/bin/mvn.cmd -pl src/bomberman-core install
```

The resulting `bomberman-core-0.1.0-SNAPSHOT.jar` is installed into the local Maven repository at `~/.m2/repository/com/bombermenx/bomberman-core/0.1.0-SNAPSHOT/`. The two tests `WireCodecTest` and `GameWorldTest` are executed automatically.

### 3.2 `bomberman-server`

Depends on `bomberman-core` plus Netty 4 and a small SLF4J binding. Build a runnable fat-jar with:

```
~/tools/maven/bin/mvn.cmd -pl src/bomberman-server -am package
```

The `-am` flag also rebuilds `bomberman-core` if it has changed. The output is `src/bomberman-server/target/bomberman-server-0.1.0-SNAPSHOT.jar`, which is fully self-contained and can be moved to any JDK-17 machine.

Run with:

```
java -jar src/bomberman-server/target/bomberman-server-0.1.0-SNAPSHOT.jar
```

The server reads its configuration from environment variables (section 6) and from `src/bomberman-server/src/main/resources/server.properties` if present.

### 3.3 `bomberman-client`

JavaFX desktop client. The simplest way to run it is via the `javafx-maven-plugin`:

```
~/tools/maven/bin/mvn.cmd -pl src/bomberman-client -am javafx:run
```

This handles the JavaFX module path correctly without further configuration. To produce a redistributable fat-jar that includes the JavaFX runtime libraries shaded, use:

```
~/tools/maven/bin/mvn.cmd -pl src/bomberman-client -am package
```

The resulting `bomberman-client-0.1.0-SNAPSHOT.jar` can be launched with `java -jar` on any JDK 17 machine. The launcher class is `com.bombermenx.client.ClientLauncher`.

---

## 4. Running with Docker Compose

The infrastructure layer under `infra/` contains everything required for a containerised server. From the repository root:

```
docker compose -f infra/docker-compose.yml up
```

This:

1. Builds the server image from `infra/Dockerfile.server` (base `eclipse-temurin:17-jre-jammy`).
2. Starts a single `bombermenx-server` container.
3. Maps host port `8080` to the WebSocket endpoint and host port `9091` to the metrics endpoint.

Stop with `Ctrl+C` followed by `docker compose -f infra/docker-compose.yml down`.

A second Compose file at `infra/Dockerfile.client-build` is the **builder** image used by CI to package the client fat-jar without polluting the developer machine; it is not used for runtime.

---

## 5. Ports

| Port  | Bound by              | Purpose                                                 |
| ----- | --------------------- | ------------------------------------------------------- |
| 8080  | `WebSocketServer`     | Primary `ws://` endpoint for the wire protocol.         |
| 9091  | `MetricsHandler`      | Prometheus-style scrape page at `/metrics`.             |

If port 8080 is in use, override with the `--port=<n>` flag accepted by `BombServerApplication`. The client picks the same port up via the `BOMBERMENX_SERVER_URL` environment variable (section 6).

---

## 6. Environment variables

| Variable                  | Default               | Purpose                                                                                  |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `BOMBERMENX_ENV`          | `dev`                 | One of `dev`, `staging`, `prod`. Selects defaults inside `ServerConfig`.                 |
| `BOMBERMENX_SERVER_URL`   | `ws://localhost:8080` | Client-side. The WebSocket URL `GameClient` connects to.                                 |
| `AUTH_PROVIDER`           | `dev`                 | `dev` or `google`. Selects the active `AuthProvider` registered in `AuthRegistry`.       |
| `DB_URL`                  | (unset)               | Reserved for v0.3. The prototype keeps rankings in memory; this variable is read but unused.|
| `BOMBERMENX_BOTS`         | `1`                   | Number of `BotController` slots `MatchManager` fills when a match is short of humans.    |
| `BOMBERMENX_LOG_LEVEL`    | `INFO`                | SLF4J level applied at boot.                                                             |

Variables are read by `com.bombermenx.server.config.ServerConfig` on the server side and inspected directly by `ClientLauncher` on the client side.

---

## 7. Troubleshooting

### 7.1 "Address already in use: bind" on port 8080

Another process is holding the port. On Windows the most common cause is a previous server instance whose jar is still locked. Identify and kill:

```
netstat -ano | findstr :8080
taskkill /F /PID <pid>
```

On Linux:

```
lsof -nP -iTCP:8080 -sTCP:LISTEN
kill -9 <pid>
```

Alternatively, launch with `--port=18080` and set `BOMBERMENX_SERVER_URL=ws://localhost:18080` on the client.

### 7.2 Windows reports the server jar is locked

A previous `java.exe` is still holding the jar file. Use Task Manager or:

```
taskkill /F /IM java.exe
```

This is safe in the development workflow because no other Java process should be running. In CI the team uses `mvn clean` to recreate the `target/` directory rather than overwriting locked jars.

### 7.3 Maven cannot resolve dependencies

Symptoms: `Could not transfer artifact ...` errors from `mvn clean test`. The most common causes are a corporate proxy and a poisoned local cache.

- Clear the suspect artefact: `rm -r ~/.m2/repository/com/bombermenx`
- Force a fresh download: `~/tools/maven/bin/mvn.cmd -U clean test`
- If the team is offline (typical on the demo day), pre-populate `~/.m2/repository` with `mvn dependency:go-offline` while still online.

### 7.4 Docker build is slow or runs out of memory

Enable BuildKit explicitly:

```
$env:DOCKER_BUILDKIT = "1"    # PowerShell
export DOCKER_BUILDKIT=1      # bash
docker compose -f infra/docker-compose.yml build
```

Allocate at least 4 GB to Docker Desktop. The server image is ~230 MB once built; subsequent builds reuse the layer cache and complete in under 20 seconds.

### 7.5 JavaFX fails with "Module javafx.controls not found"

The client must be launched with the JavaFX module path. Prefer `mvn javafx:run` for local development. For a packaged jar, ensure the fat-jar build profile is used:

```
~/tools/maven/bin/mvn.cmd -pl src/bomberman-client -am -Pshaded package
```

The shaded artefact bundles the JavaFX runtime and launches with a plain `java -jar`.

### 7.6 The client connects but stays on the menu

Verify the server is reachable. The status line at the bottom of `MainMenuView` shows `Disconnected` until `GameClient` completes a WebSocket handshake. Common causes are an incorrect `BOMBERMENX_SERVER_URL`, a firewall blocking outbound ws:// connections, or the server not yet ready (wait 1 – 2 seconds after launch).

### 7.7 Tests pass locally but fail on a fresh clone

Ensure the JDK and Maven versions match the reference toolchain (section 1). The most common cause is an inadvertent JDK 21 on the PATH overriding the Red Hat JDK 17.

---

## 8. Verifying a clean machine before the viva

The following checklist is run on the demo laptop on Sunday 01 June 2026:

1. `java -version` reports JDK 17.
2. `~/tools/maven/bin/mvn.cmd -v` reports Maven 3.9.
3. `~/tools/maven/bin/mvn.cmd clean test` is green.
4. `~/tools/maven/bin/mvn.cmd -pl src/bomberman-server -am package` produces the jar.
5. `java -jar src/bomberman-server/target/bomberman-server-0.1.0-SNAPSHOT.jar` listens on 8080 within 2 seconds.
6. `~/tools/maven/bin/mvn.cmd -pl src/bomberman-client -am javafx:run` opens the menu and connects.
7. A 90-second match against one `BotController` runs without errors.
8. `docker compose -f infra/docker-compose.yml up` starts the server image cleanly.

If every item is green, the laptop is ready for Tuesday 02 June 2026.
