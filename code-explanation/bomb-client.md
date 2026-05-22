# bomb-client — Code Walkthrough

Author: Simranjot Kaur (SK), Architect & UI/UX Director, BomberMen-X
Module: `bomb-client` (JavaFX 21)
Audience: Anyone joining the team mid-sprint who needs to read, extend, or debug the desktop client without spelunking through the whole tree.

This is the desktop JavaFX client. It owns everything the player sees and hears: the menu, the lobby, the arena, the HUD, particles, camera shake, scanlines, audio, and gamepad rumble. It does **not** own game rules — those live server-side in `bomb-server`. The client is, by design, a thin, fast, opinionated presentation layer wired around a single router.

---

## 1. Entry — `ClientLauncher` and the age gate

The launch path is intentionally short. `ClientLauncher` extends `javafx.application.Application`. The first thing it does after the JavaFX toolkit is up is hand control to `AgeGate.prompt(...)`, which blocks until the player has answered the consent question. Only then do we build the `SceneRouter` and show the main menu.

```java
public final class ClientLauncher extends Application {
    @Override public void start(Stage stage) {
        AgeGate.prompt(stage);                       // persists answer to prefs
        SceneRouter router = new SceneRouter(stage); // lazy scene factory
        router.go(Route.MAIN_MENU);
        stage.setTitle("BomberMen-X");
        stage.show();
    }
}
```

`AgeGate` writes the answer into `java.util.prefs.Preferences` under the node `bomberman-x/age-gate`, so subsequent launches skip the prompt unless the user has cleared their preferences. The gate is a hard block, not a dismissible toast — refusing exits the process.

---

## 2. Scene routing — `SceneRouter`

`SceneRouter` is a small registry of factories keyed by an enum `Route { MAIN_MENU, LOBBY, RANKINGS, ARENA }`. Scenes are **lazily** constructed. We never preload the arena before the player has entered a lobby, because the arena pulls in the renderer, particle pool, and audio buffers.

```java
public final class SceneRouter {
    private final Map<Route, Supplier<Parent>> factories = new EnumMap<>(Route.class);
    private final Stage stage;

    public SceneRouter(Stage stage) {
        this.stage = stage;
        factories.put(Route.MAIN_MENU, MainMenuView::new);
        factories.put(Route.LOBBY,     LobbyView::new);
        factories.put(Route.RANKINGS,  RankingsView::new);
        factories.put(Route.ARENA,     ArenaView::new);
    }

    public void go(Route route) {
        Parent root = factories.get(route).get();
        Scene scene = new Scene(root);
        scene.getStylesheets().add(getClass().getResource("/css/tron.css").toExternalForm());
        stage.setScene(scene);
        SceneShowHooks.fire(route, scene); // wakes GamepadPoller, audio bus, etc.
    }
}
```

The `SceneShowHooks.fire(...)` call is the seam where scene-show side effects live (gamepad rescan, audio focus, HUD reset). Keeping it in one place means `SceneRouter` itself stays declarative.

---

## 3. Main menu — `MainMenuView`

`MainMenuView` is a `VBox` with two text fields and three buttons:

- **DISPLAY NAME** — `TextField`, 1–16 chars, validated on focus loss.
- **SERVER URL** — `TextField`, defaults to `wss://bombermen-x.run.app/ws`, accepts `ws://` for LAN.
- Buttons: **JOIN LOBBY**, **RANKINGS**, **QUIT**.

CSS classes from `tron.css` drive the neon look: `.tron-field`, `.tron-button`, `.tron-button--primary`. Focus rings are cyan (`#3aedff`), error state flips the border to magenta (`#ff3ad9`). The DISPLAY NAME field announces its constraints via a `Label` directly below it, not just a tooltip, so keyboard-only players don't have to hover anything.

---

## 4. Lobby — `LobbyView`

`LobbyView` subscribes to the wire message `LOBBY_STATE`, which streams the current roster and the countdown integer (seconds remaining until match start). Renders as a two-column layout: roster table on the left, mode-vote and countdown card on the right.

The countdown is a `Label` styled `.tron-countdown` with a 1.2 s glow-pulse animation defined in CSS. We deliberately drive the value from server messages — not a local timer — so reconnecting clients see the truth. If the player is idle in the lobby and a `LOBBY_STATE` shows the match has already started, we route directly into `ArenaView`.

---

## 5. Arena — `ArenaView` + `HudOverlay`

`ArenaView` is a `StackPane` whose two layers are:

1. A `Canvas` driven by `ArenaRenderer`.
2. A `HudOverlay` (transparent `Pane`) layered on top: kill feed top-right, score bar top-left, ability icons bottom-centre.

The HUD is **not** drawn on the canvas. Keeping it as real nodes means CSS, focus, and accessibility tooling continue to work, and the renderer doesn't have to know about text layout.

```java
public final class ArenaView extends StackPane {
    private final Canvas canvas = new Canvas(1280, 720);
    private final HudOverlay hud = new HudOverlay();
    private final ArenaRenderer renderer;

    public ArenaView() {
        this.renderer = new ArenaRenderer(canvas.getGraphicsContext2D());
        getChildren().addAll(canvas, hud);
        renderer.start();
    }
}
```

---

## 6. Renderer — `ArenaRenderer`, `ParticleSystem`, `CameraShake`, `PostFx`

`ArenaRenderer` owns a single `AnimationTimer` targeting 60 FPS. Each tick it clears the canvas and draws in a fixed order: **tiles → bombs → explosions → players → HUD-anchored canvas effects**. The order matters: bombs sit on tiles, explosions sit on bombs, players sit on top so the player can always read their character.

```java
private final AnimationTimer loop = new AnimationTimer() {
    @Override public void handle(long now) {
        gc.clearRect(0, 0, W, H);
        drawTiles(gc);
        drawBombs(gc, now);
        drawExplosions(gc, now);
        drawPlayers(gc);
        particles.tickAndDraw(gc, now);
        shake.apply(gc, now);
        postFx.apply(gc); // scanlines + chromatic aberration
    }
};
```

- `ParticleSystem` is a pre-allocated ring buffer of `~512` particles with a TTL of 600 ms; sparks come from bomb fuses, glow from pickups.
- `CameraShake` adds a 6 px amplitude with 200 ms decay on explosion events.
- `PostFx` overlays scanlines at 0.25 opacity and a chromatic aberration of 1 px on the magenta channel — small enough to read as "Tron", subtle enough to not exhaust the eye.

---

## 7. Audio — `AudioBus` + `SpatialAudio`

`AudioBus` is the master mixer: one gain stage, ducking when the menu opens. `SpatialAudio` attenuates by 2D distance from the local player and pans left/right based on relative X. Bomb thumps are routed through a low-pass-flavoured buffer; pickup pings sit high. Defaults at first launch are intentionally conservative — 60% master — so we don't blow out players on headphones.

---

## 8. Input — `GamepadPoller` + `HapticsService`

`GamepadPoller` wraps JInput 2.0.10. It is **not** polled every frame: it rescans on scene-show via `SceneShowHooks`, then samples at 120 Hz on a dedicated daemon thread. This avoids the JInput cold-start stutter inside the render loop. Buttons are mapped Xbox-style: A bombs, B menus, left stick moves. PS X maps to A.

`HapticsService` listens for the server-driven `HAPTIC` message and triggers rumble — short pulse on hit, long pulse on death, double pulse on round end. Keeping rumble server-driven keeps it honest: only real events buzz.

```java
public final class HapticsService {
    public void onHaptic(HapticMessage msg) {
        gamepad.rumble(msg.intensity(), msg.durationMs());
    }
}
```

---

## How to add a new scene

1. Create a new `View` class in `bomb.client.scene` extending `Parent` (usually `VBox` / `StackPane`).
2. Add a route constant: `Route.SETTINGS`.
3. Register the factory in `SceneRouter`:
   ```java
   factories.put(Route.SETTINGS, SettingsView::new);
   ```
4. Style with classes from `tron.css`. If you need a new class, add it to `tron.css` rather than inlining.
5. If the scene needs gamepad input or audio focus, hook into `SceneShowHooks` — do not poll JInput from your view code.
6. Navigate to it from the main menu: `router.go(Route.SETTINGS);`.

That's the whole client in one pass. Read this file first, then open `ArenaRenderer` — that's where the visible character of the game lives.
