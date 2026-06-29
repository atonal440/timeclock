# Theme design — working notes & backlog

## Principles
- **One live indicator per screen.** Only the **session card**
  (`.status-bar.active`) carries motion + glow. The current task button
  (`.project-btn.current`) is marked statically (brighter fill + 1px ring +
  NOW badge) — distinct but quiet, so it doesn't compete with the card.

## Deferred ideas
- **Animated green gradient on active buttons** (other themes): animate a
  flowing green gradient across the active/clocked-in buttons. Revisit when we
  get to those themes. (Indigo uses a glow pulse instead — see below.)
- **Drift on the active task row** (`.project-btn.current`), someday: extend the
  session-card drift down into the NOW row as a "this one's live" list cue.
  Working prototype in `capture-taskdrift.mjs` (aurora, scoped via
  `overflow:hidden` + `inset:-80%`, reusing `auroraShimmer`/`--shimmer`). Would
  put motion on two surfaces — only do it if we relax the one-indicator rule,
  likely as a *subtler* cue than the session card.

## Done
- **Sunset Warmth** — active card has a **golden-hour glow**: a warm sun-glow
  (`--sun-core`/`--sun-mid`) pooled low in the card on `.status-bar.active::before`,
  swelling + drifting sideways via `sunsetGlow` 10s alternate. Conceptual sibling
  to aurora (sun at the horizon vs. lights in the sky). Reduced-motion safe.
- **Aurora Glass** — active card has a slow **aurora shimmer**: a drifting
  teal/violet (dark) or teal/sky (light) gradient on `.status-bar.active::before`
  (clipped via `overflow:hidden`), `auroraShimmer` 11s alternate. Colors via
  `--shimmer-a/--shimmer-b`; disabled under `prefers-reduced-motion`.
- **Soft Clay · dark** — active session card was disappearing (no border,
  invisible highlight, surface≈bg). Added an **inset accent ring**
  (`inset 0 0 0 1.5px var(--inset-edge)`, `--inset-edge:var(--lime-dim)`) to
  define the edge while keeping the recess; bumped `--neu-l` .05→.07 so the
  recess actually reads. `clay-light` uses a soft ring too
  (`--inset-edge:rgba(124,92,255,.55)`), softened by the bright highlight wash.
  The recessed feel comes from the inset shadow *pair* (dark top-left / light
  bottom-right = inverse of raised); the ring only supplies a crisp perimeter.
  Active card breathes via **`clayBreathe`** (2.8s): recess presses deeper
  (6→13px) while the ring thickens+brightens (1.5px dim → 3px `--lime`), one
  scheme-agnostic motion; disabled under `prefers-reduced-motion`.
- **Indigo · dark** — brighter active-job highlight (glowing edge ring on the
  running-session card + current project row, solid periwinkle NOW pill,
  brighter accent). Running-session card breathes its **glow**
  (`@keyframes indigoPulse`, 2.6s).
- **Indigo · light** — running-session card breathes its **edge stroke**
  (1px ↔ 3.5px, `@keyframes indigoStroke`, 2.6s) since glow reads poorly on
  light. Both pulses disabled under `prefers-reduced-motion`.
