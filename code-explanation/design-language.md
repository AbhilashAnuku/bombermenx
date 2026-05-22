# BomberMen-X Design Language

Author: Simranjot Kaur (SK), UI/UX Director, BomberMen-X
Scope: Visual, motion, and audio direction for `bomb-client` and the browser artefacts under `presentation/`.
Stylesheet of record: `src/main/resources/css/tron.css`.

This is not a mood board. It is the working style guide our small team uses to keep the menu, the lobby, the arena, the HUD, and the browser artefacts visually coherent. If something on screen does not match what is written here, the thing on screen is wrong.

---

## 1. Palette

Tron-inspired, high contrast on near-black. Each colour has a deliberate role. Do not invent new neon shades — extend roles only when this table no longer covers a case.

| Token            | Hex       | Role                                                                 |
|------------------|-----------|----------------------------------------------------------------------|
| `--ink`          | `#08090d` | Page background. Canvas clear colour in `ArenaRenderer`.             |
| `--panel`        | `#11141c` | Cards, chips, modal surfaces, HUD plates.                            |
| `--line`         | `#1f2533` | Grid lines, dividers, table rules. Decoration only — never text.     |
| `--cyan`         | `#3aedff` | Primary action, focus rings, default player team, headings.         |
| `--magenta`      | `#ff3ad9` | Secondary accent, opposing team, error states.                       |
| `--amber`        | `#ffb53a` | Warnings, bombs, fuses, "attention required".                        |
| `--green`        | `#3affb5` | Success, pickups, health-gained events.                              |
| `--text`         | `#ffffff` | Body text on `--ink` and `--panel`.                                  |

Use rules:
- Body copy is white. Coloured text is reserved for status and emphasis.
- The four neons are role-bound. Cyan is not interchangeable with green just because they are both light.
- Magenta and red-orange tones never sit directly on cyan as text — see Don'ts.

---

## 2. Type system

We define three type roles in `tron.css`. The JavaFX side uses CSS classes; the web artefacts in `presentation/` use the same names with a matching font stack.

| Role      | JavaFX class       | Web font stack                                                   | Use                              |
|-----------|--------------------|------------------------------------------------------------------|----------------------------------|
| Display   | `.tron-display`    | `"Orbitron", "Rajdhani", system-ui, sans-serif`                  | Scene titles, slide headings.    |
| Body      | `.tron-body`       | `"Inter", "Segoe UI", system-ui, sans-serif`                     | All readable copy.               |
| Mono      | `.tron-mono`       | `"JetBrains Mono", "Consolas", ui-monospace, monospace`          | Server URL, ping, code, counters.|

Sizes:
- Display: 32–56 px, letter-spacing +1%.
- Body: 16 px default, **14 px floor** (see Accessibility).
- Mono: 14 px default; numbers tabular.

Headings use H1–H3 ranks in the DOM and the slide deck so screen readers and the outline view stay legible.

---

## 3. Spacing scale

A 4-based scale. Pick the smallest step that solves the layout problem; do not freelance.

```
4   |  8   |  12  |  16  |  24  |  32
xs  |  s   |  m   |  l   |  xl  |  xxl
```

Where each step lives:
- `4` — icon padding inside chips, focus-ring offset.
- `8` — gap between a label and its field, vertical rhythm inside a chip.
- `12` — gap between sibling controls in a row.
- `16` — default form row spacing in `MainMenuView`.
- `24` — section spacing between cards in the lobby.
- `32` — outer padding of full scenes.

No step `20`. No step `28`. If a layout looks like it wants one of those, the structure is wrong, not the spacing.

---

## 4. Motion

Motion in this game is information, not decoration. Three rules across the client:

1. **Glow pulse — 1.2 s ease-in-out, infinite alternate.** Used on the lobby countdown number and on the primary CTA in the main menu while it is the only valid action. Anything pulsing on screen should be the most important thing on that scene; if two things pulse, kill one.
2. **Camera shake — 6 px amplitude, 200 ms decay.** Applied by `CameraShake` on explosion events. Never used for cosmetic events. A shake means something blew up; a player learns that contract in their first match.
3. **Particle TTL — 600 ms.** `ParticleSystem` pre-allocates ~512 particles in a ring. Anything that needs to last longer than 600 ms is not a particle — it is a sprite. Sparks fly from bomb fuses; glow puffs from pickups.

Default `AnimationTimer` rate is 60 FPS. We do not run the renderer slower to save battery; we let the JVM downclock its own thread if it has to.

---

## 5. Sound design intent

We ship `AudioBus` + `SpatialAudio` because the game reads better with sound, not because we want a soundtrack. Two intentional bands:

- **Low-frequency thump — bomb detonation.** A short, fat hit centred around 80–120 Hz, ducked through the master bus so it never overwhelms voice or UI. This is the spatialised channel: a bomb behind you sounds behind you.
- **High-frequency ping — pickups and UI confirms.** Centred around 2–4 kHz, very short envelope (<120 ms), un-spatialised, fixed master. UI sounds always pan centre.

We deliberately leave the mid-band quieter so that voice (future feature) has room to sit. First-launch master is **60%**, not 100%, because we know players use headphones.

---

## 6. Accessibility rules

Non-negotiable rules. If a PR breaks one of these, it does not ship.

- **Body text minimum 14 px** in `bomb-client` and across all `presentation/` HTML.
- **4.5:1 contrast** for body text, **3:1 for large text and non-text UI** (focus rings, icon glyphs, chart strokes). The Tron palette passes against `--ink` and `--panel`; see `ui-audit.md` for the contrast table.
- **Reduce-motion toggle planned** in Settings, with three levels: Off (no scanlines, no shake), Reduced (scanlines off, shake at 50%), Full. Default is Full for new installs but the toggle must be reachable from the main menu, not buried.
- **Focus is always visible.** Every interactive control declares `setFocusTraversable(true)` in JavaFX and renders a 2 px cyan ring on `:focused`.
- **Keyboard reaches every action.** Mouse-only flows are bugs.
- **Sound is never the only signal.** A kill is a kill feed entry, a haptic pulse, and a sound — not just a sound.
- **Age gate copy** must say the answer is saved on this computer.

---

## 7. Don'ts

A list we keep on the wall:

- **No full-screen flashes faster than 3 Hz.** This is a photosensitivity rule, not a taste rule.
- **No scanline opacity above 0.4.** At 0.4+ the playfield becomes hard to read for everyone, not just sensitive players. Default sits at 0.25; "Subtle" sits at 0.15.
- **No pure red (`#ff0000`) on pure black.** It vibrates. If you need red, desaturate toward magenta `#ff3ad9` or pull it warmer toward amber `#ffb53a`, and place it on `--panel`, not `--ink`.
- **No coloured text on a coloured chip.** White text on a coloured chip, or coloured text on a `--panel` chip. Never coloured-on-coloured.
- **No drop shadows under text** to fake legibility. Fix the colour pair instead.
- **No more than two motion elements on screen at once,** outside the arena. The arena is its own world; menus are not.
- **No tooltips as the only way to discover a constraint.** Keyboard-only and touch users never see a tooltip. Use a sibling label.
- **No icon-only buttons** in menus. Always pair with a text label. The arena HUD ability icons are the exception, and they have a key glyph next to them.
- **No animation on the rankings table.** People read rankings. Reading and motion do not mix.
- **No autoplay audio** on the first launch of any `presentation/` artefact. Players control when sound starts.

---

If this document and the code disagree, fix the code. If this document and a stakeholder disagree, talk to me — I would rather change the rule once, in writing, than have three slightly different cyans across three scenes.
