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

## Done
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
