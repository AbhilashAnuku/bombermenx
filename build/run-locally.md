# Run BomberMen-X locally — one-page quickstart

Author: Abhilash Anuku (AA), Architect, Delivery Lead

Three ways to play. Pick whichever matches what you already have installed.

---

## (a) Docker stack — recommended

Brings up the full server plus Postgres 16 plus Redis 7 with `restart: unless-stopped`. The stack stays up across reboots.

Prerequisite: Docker Desktop (or Docker Engine on Linux).

```bash
cd "F:\Bomber Man X\BomberMan-X"
docker compose up -d --build
docker compose logs -f bomb-server
```

When you see the line `WebSocket server listening on ws://0.0.0.0:8080/ws`, the server is up. Now open one of the clients:

- Browser client: open `F:\Bomber Man X\BomberMan-X\presentation\play.html`, click CONNECT, then JOIN QUEUE.
- War-room dashboard: open `F:\Bomber Man X\BomberMan-X\presentation\poster.html` — it refreshes from `/metrics` every 1.5 seconds.

To stop:

```bash
docker compose down       # keep volumes
docker compose down -v    # nuke Postgres + Redis data
```

---

## (b) Desktop client (high-end Tron renderer)

Prerequisites: JDK 21 (Eclipse Temurin recommended) + Maven on the host. JavaFX modules are pulled in automatically by the `javafx-maven-plugin`. You also need the server running — either via the Docker stack (option a) or by launching the server jar directly.

```bash
# macOS / Linux
cd "F:\Bomber Man X\BomberMan-X"
./scripts/run-client.sh

# Windows
cd "F:\Bomber Man X\BomberMan-X"
scripts\run-client.cmd
```

Or directly through Maven:

```bash
mvn -B -pl bomb-core,bomb-client -am package
mvn -B -pl bomb-client javafx:run
```

---

## (c) Zero-install web client

Open `F:\Bomber Man X\BomberMan-X\presentation\play.html` in any modern browser. Click CONNECT, then JOIN QUEUE. The browser client speaks the same wire protocol as the JavaFX desktop client. No JDK install required.

Use this option for demos, recruiting, and quick smoke tests of a freshly built server.

---

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | WASD or arrow keys | left stick or D-pad |
| Place bomb | Space | A (Xbox) / X (PlayStation) |
| Quit to menu | Esc | — |

The gamepad is detected via JInput at scene-show time. Plug a controller in before opening the menu screen and it is picked up automatically. If you plug in mid-session, leave the menu and return — JInput re-scans on scene change.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker compose up` fails with "port 8080 already in use" | Another process owns 8080 on the host | Stop the other process or change the host-side port in `docker-compose.yml` (e.g. `"18080:8080"`) |
| `bomb-server` waits forever for Postgres on first boot | First-run Postgres init is slow on cold disk | Wait 30-60 seconds — the health check polls every 5 s and the server starts as soon as Postgres reports healthy |
| `mvn javafx:run` fails with "module javafx.controls not found" | Host has JDK 17 instead of JDK 21, or Maven did not resolve the JavaFX modules on cold cache | Install Eclipse Temurin 21, set `JAVA_HOME`, then run `mvn -U dependency:resolve` and retry `mvn javafx:run` |
| JavaFX client window is black or blurry | Wrong JDK / JavaFX combination | Confirm `java -version` reports 21.x. JavaFX 21 ships in the Maven coordinates, not the JDK; no separate SDK install needed |
| Gamepad not detected | Pad plugged in after the menu scene was shown | Press Esc to return to the menu, then re-enter — JInput re-scans on scene change |
| Browser client fails to connect | Mixed-content (HTTPS page, WS not WSS) or server not running | Confirm `docker compose ps` shows `bomb-server` Up; reload `play.html` from the local filesystem (`file://`) not from a remote HTTPS host |
| `presentation\poster.html` shows "0" everywhere | The poster reads `/metrics`; server may not be reachable | Open `http://localhost:8080/metrics` in the browser. If you see JSON, the poster CORS header is wrong on your build — pull `main` and rebuild |
| Match never starts when you queue solo | Default `BX_WARMUP_SECONDS=8` was overridden | Wait 8 seconds — solo human → 3 bots → match starts. If still stuck, check `docker compose logs bomb-server` for `Player ... joined queue` lines |
| Server consumes too much memory on Windows | Docker Desktop default WSL2 cap | Lower `JAVA_OPTS` `-XX:MaxRAMPercentage` or raise Docker Desktop's memory budget |

For anything not covered here, the single most useful command is:

```bash
docker compose logs -f bomb-server
```

The server emits slf4j logs at INFO that name the collaborator (`MatchManager`, `WebSocketServer`, `LobbyService`, `ChatRouter`, `AuthRegistry`) and the line is usually enough to localise the issue.
