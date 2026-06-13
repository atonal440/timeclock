// ── Day-of-week theme system ────────────────────────────────────────────────
// Each "concept" is a button/card *treatment* (shape, shadow, effects) that is
// shared by a paired light + dark color scheme. That gives 7 concepts × 2
// schemes = 14 themes. In 'daily' mode the concept follows the weekday and the
// light/dark scheme follows the OS preference, so the pairing does the work.
//
// data-theme values written to <html> are `${concept.id}-${scheme}`, e.g.
// "aurora-dark", matching the blocks in index.css.

export type Scheme = 'light' | 'dark';

export interface Concept {
  /** weekday name, for display */
  day: string;
  /** treatment id; combines with a scheme to form the data-theme value */
  id: string;
  /** human-friendly name */
  name: string;
}

// Index lines up with Date.getDay() (0 = Sunday … 6 = Saturday).
export const DAY_CONCEPTS: Concept[] = [
  { day: 'Sunday',    id: 'clay',   name: 'Soft Clay' },
  { day: 'Monday',    id: 'indigo', name: 'Indigo Pro' },
  { day: 'Tuesday',   id: 'aurora', name: 'Aurora Glass' },
  { day: 'Wednesday', id: 'sunset', name: 'Sunset Warmth' },
  { day: 'Thursday',  id: 'crt',    name: 'CRT Terminal' },
  { day: 'Friday',    id: 'brutal', name: 'Neo-Brutalist' },
  { day: 'Saturday',  id: 'lime',   name: 'Lime Terminal' },
];

/** The concept for a given date (defaults to today). */
export function conceptFor(date = new Date()): Concept {
  return DAY_CONCEPTS[date.getDay()];
}

/** Build the data-theme value for a concept + scheme. */
export function themeId(conceptId: string, scheme: Scheme): string {
  return `${conceptId}-${scheme}`;
}
