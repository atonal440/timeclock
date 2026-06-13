# Theme design — working notes & backlog

## Deferred ideas
- **Animated green gradient on active buttons** (other themes): animate a
  flowing green gradient across the active/clocked-in buttons. Revisit when we
  get to those themes. (Indigo uses a glow pulse instead — see below.)

## Done
- **Indigo · dark** — brighter active-job highlight (glowing edge ring on the
  running-session card + current project row, solid periwinkle NOW pill,
  brighter accent). Running-session card now has a slow glow **pulse**
  (`@keyframes indigoPulse`, 2.6s), disabled under `prefers-reduced-motion`.
