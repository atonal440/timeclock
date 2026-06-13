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
- **Indigo · dark** — brighter active-job highlight (glowing edge ring on the
  running-session card + current project row, solid periwinkle NOW pill,
  brighter accent). Running-session card breathes its **glow**
  (`@keyframes indigoPulse`, 2.6s).
- **Indigo · light** — running-session card breathes its **edge stroke**
  (1px ↔ 3.5px, `@keyframes indigoStroke`, 2.6s) since glow reads poorly on
  light. Both pulses disabled under `prefers-reduced-motion`.
