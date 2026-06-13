// Day-of-week theme rotation. getDay() → 0=Sunday .. 6=Saturday, so the
// array index lines up directly with the JS weekday number.
export interface DayTheme {
  /** weekday name, for display */
  day: string;
  /** value written to <html data-theme="…">, matches a block in index.css */
  id: string;
  /** human-friendly theme name */
  name: string;
}

export const DAY_THEMES: DayTheme[] = [
  { day: 'Sunday',    id: 'clay',   name: 'Soft Clay' },
  { day: 'Monday',    id: 'indigo', name: 'Indigo Pro' },
  { day: 'Tuesday',   id: 'aurora', name: 'Aurora Glass' },
  { day: 'Wednesday', id: 'sunset', name: 'Sunset Warmth' },
  { day: 'Thursday',  id: 'crt',    name: 'CRT Terminal' },
  { day: 'Friday',    id: 'brutal', name: 'Neo-Brutalist' },
  { day: 'Saturday',  id: 'lime',   name: 'Lime Terminal' },
];

/** The day-theme for a given date (defaults to today). */
export function dayThemeFor(date = new Date()): DayTheme {
  return DAY_THEMES[date.getDay()];
}
