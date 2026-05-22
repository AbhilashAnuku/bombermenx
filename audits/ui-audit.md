# UI / UX Audit — bomb-client

Auditor: Simranjot Kaur (SK), UI/UX Director, BomberMen-X
Module under review: `bomb-client` (JavaFX 21)
Stylesheet: `src/main/resources/css/tron.css`
Scenes reviewed: `MainMenuView`, `LobbyView`, `RankingsView`, `ArenaView`, `HudOverlay`, `AgeGate`

---

## Methodology

This audit is a structured heuristic walkthrough rather than a moderated usability test. I worked through every scene the client can route to via `SceneRouter`, with three lenses layered on top of each other:

1. **Nielsen-style heuristics.** Visibility of system status, error prevention, recognition over recall, consistency, user control. I noted any time the UI made me guess what the system was doing.
2. **WCAG 2.1 AA contrast.** I sampled every active foreground/background pair in `tron.css` and computed contrast ratios. The Tron palette is high-luminance on near-black, which is generous, but a few of our amber-on-cyan accents come perilously close to failing.
3. **Motion and photosensitivity.** I checked every animated element: scanlines, glow pulse on the lobby countdown, camera shake on explosions, particle TTL. I tracked any element that flashes faster than ~3 Hz, full-screen or otherwise.

Test conditions: 1920×1080 monitor, 100% scale, default OS theme, mouse + keyboard, then again with an Xbox-style controller. I also navigated every menu keyboard-only (Tab / Shift+Tab / Enter / Esc) to verify focus order.

Severity scale:
- **High** — blocks a player, fails an accessibility standard, or risks harm (photosensitive, hearing).
- **Med** — friction that a typical player will notice and resent within their first session.
- **Low** — polish; would not stop a release, but cheap to fix.

---

## Findings

### U-1 — DISPLAY NAME field lacks input hint
**Severity:** Med
**Where:** `MainMenuView` (display-name `TextField`)
**Problem:** Today the field accepts up to 16 characters but tells the player nothing. If they type `~~~xX_Sn1per_Xx~~~`, they only learn the constraint after the lobby rejects them.
**Fix:** Render a sibling `Label` styled `.tron-hint` directly under the field with copy "1 to 16 characters. Letters, numbers, dashes." Validate on focus loss and flip the border to magenta (`#ff3ad9`) with a `Label` error message — not a tooltip, since tooltips are invisible to keyboard-only users.

### U-2 — Scanline intensity is not user-controllable
**Severity:** High (photosensitivity)
**Where:** `PostFx` overlay applied by `ArenaRenderer`
**Problem:** The scanline layer is currently a fixed 0.25 opacity. For most players this reads as atmospheric. For a player with vestibular or photosensitive sensitivity, an always-on scrolling overlay during a fast game is unkind, and there is no way to turn it off.
**Fix:** Add a Settings scene with three options: **Off / Subtle (0.15) / Full (0.25)**, persisted in `Preferences`. `PostFx` reads the value on scene-show. Default should remain Subtle for new installs. Long-term: respect an OS "reduce motion" hint if we can read one from JavaFX.

### U-3 — Kill feed dwell time and contrast
**Severity:** Med
**Where:** `HudOverlay` (kill feed, top-right)
**Problem:** Entries currently animate in and out fast enough that a player engaged in the centre of the arena misses them, especially the third entry in a chain. Additionally, killer names in white-on-cyan are 2.9:1 — below WCAG AA non-text contrast.
**Fix:** Hold each entry on screen for **3.5 s minimum** before fade. Render killer/victim names in the team accent colour over a `rgba(8,9,13,0.6)` chip rather than directly on the cyan background, lifting contrast above 4.5:1.

### U-4 — No gamepad-fallback hint when controller is missing
**Severity:** Med
**Where:** `MainMenuView`, `LobbyView`, scene-show callback in `SceneShowHooks`
**Problem:** `GamepadPoller` runs a rescan on every scene-show. If it finds no device, we silently fall back to keyboard. A player who plugged in a controller after launch never finds out it isn't recognised.
**Fix:** Surface a small dismissible chip in the top-right of the menu: **"No controller detected — keyboard active. Press F5 to rescan."** Bind F5 to `GamepadPoller.rescan()`. Show in cyan on the panel grey (`#11141c`) — 7.2:1 contrast, comfortably AA.

### U-5 — Age gate copy is unclear about persistence
**Severity:** Med (compliance-adjacent)
**Where:** `AgeGate.prompt(...)`
**Problem:** The current prompt asks the player to confirm they are over the age threshold but does not explain that the answer is **saved on this machine**, nor how to revoke it. A shared-PC scenario (siblings) becomes ambiguous.
**Fix:** Two-line copy: line one asks the question, line two reads "Your answer is saved on this computer. To change it, clear the BomberMen-X app preferences." Keep the buttons binary — **Yes, I am** / **No, exit** — and give the destructive button (No) the muted style so it is not the path of least resistance for a curious 11-year-old.

### U-6 — Connect failures fall through silently
**Severity:** High
**Where:** Network bootstrap on **JOIN LOBBY** click in `MainMenuView`
**Problem:** If the server URL is unreachable, the spinner just spins. There is no toast, no error region, and no retry hint. Players assume the game is frozen.
**Fix:** Add a `.tron-toast--error` component anchored bottom-centre. On failure: "Could not reach `{url}`. Check the address or your network." Auto-dismiss after 6 s, but keep the JOIN button in an error state with a "Retry" affordance. Log the underlying exception to the client log file, not to the toast.

### U-7 — Lobby countdown is not discoverable enough
**Severity:** Low
**Where:** `LobbyView`
**Problem:** The countdown number is rendered, but new players have told us they did not realise it was a countdown until it hit 3. The glow-pulse animation is too subtle until the final seconds.
**Fix:** Lead the number with the literal label **"MATCH STARTS IN"** in `.tron-label--small`. Increase the glow-pulse amplitude across the **final 5 seconds only** — adds urgency without exhausting the eye across the full warmup.

### U-8 — Default master volume is hot on first launch
**Severity:** Med (hearing safety)
**Where:** `AudioBus` initialisation
**Problem:** First-launch master volume is effectively 100%. Headphone players reported a flinch on the first bomb. We design for headphones because we ship a `SpatialAudio` layer.
**Fix:** Default master to **60%** on first launch. Persist the user's adjusted value to `Preferences`. Add a tiny "Audio" line on the main menu — current % — so the player knows it is theirs to change.

### U-9 — Keyboard-only navigation through the main menu has a focus trap
**Severity:** High
**Where:** `MainMenuView`
**Problem:** Tab order today goes DISPLAY NAME → SERVER URL → JOIN → RANKINGS → QUIT, but Shift+Tab from DISPLAY NAME does not loop back to QUIT — it leaves focus invisible. A keyboard-only player has no visual indicator of where focus is when it lands on the root `VBox`.
**Fix:** Set `setFocusTraversable(false)` on the root container, ensure every interactive control declares `setFocusTraversable(true)` explicitly, and add a high-contrast focus ring rule to `.tron-button:focused` and `.tron-field:focused` — 2 px solid `#3aedff` outset, no shadow tricks.

---

## Contrast-ratio mini-table — Tron palette

All ratios against the two backgrounds we actually ship: near-black `#08090d` (canvas / scene) and panel `#11141c` (cards / chips). WCAG AA requires **4.5:1** for body text and **3:1** for large text and non-text UI.

| Foreground            | On `#08090d` | On `#11141c` | Verdict (body text) |
|-----------------------|--------------|--------------|---------------------|
| Cyan `#3aedff`        | 13.2 : 1     | 11.4 : 1     | Pass                |
| Magenta `#ff3ad9`     | 7.8  : 1     | 6.7  : 1     | Pass                |
| Amber `#ffb53a`       | 11.6 : 1     | 10.0 : 1     | Pass                |
| Green `#3affb5`       | 14.1 : 1     | 12.2 : 1     | Pass                |
| Line grey `#1f2533`   | 1.4  : 1     | 1.1  : 1     | Decoration only     |
| White `#ffffff`       | 19.1 : 1     | 16.5 : 1     | Pass                |

Cross-pairs to avoid using as text-on-text (kept here so reviewers can see why):

| Foreground / Background | Ratio  | Verdict      |
|-------------------------|--------|--------------|
| Magenta on Cyan         | 1.7:1  | Fail — decoration only |
| Amber on Cyan           | 1.1:1  | Fail — never use as text |
| Green on Cyan           | 1.1:1  | Fail — never use as text |

Action items derived from the table: anywhere we currently render a coloured name directly on a cyan chip (kill feed, team labels), interpose the dark panel colour as a background. The fixes in U-3 already encode this rule.

---

## Summary

Three High findings (U-2 scanlines, U-6 silent connect failures, U-9 keyboard focus trap) should land before any external playtest. The Med findings (U-1, U-3, U-4, U-5, U-8) are all one-afternoon fixes and meaningfully reshape first-session impression. U-7 is genuine polish. None of this requires touching the renderer; almost all of it lives in `tron.css` and the scene classes.
