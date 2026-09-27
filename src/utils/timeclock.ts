export interface Entry {
  type: 'i' | 'o';
  datetime: string;
  account?: string;
}

export interface SessionData {
  inIdx: number;
  outIdx: number | null;
  account: string;
  startDt: Date;
  endDt: Date | null;
  ms: number | null;
  date: string;
  /** A clock-in with no clock-out that isn't the latest entry (bad import or old edit). */
  broken?: boolean;
}

export interface DayData {
  date: string;
  totalMs: number;
  sessions: SessionData[];
}

export function formatTC(date: string | Date): string {
  const d = new Date(date);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function parseTimeclockFile(content: string): Entry[] {
  const entries: Entry[] = [];
  for (const line of content.trim().split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const p = t.split(/\s+/);
    if (p[0] === 'i' && p.length >= 4) {
      const dt = new Date(`${p[1].replace(/\//g, '-')}T${p[2]}`);
      if (!isNaN(dt.getTime())) entries.push({ type: 'i', datetime: dt.toISOString(), account: p.slice(3).join(' ') });
    } else if (p[0] === 'o' && p.length >= 3) {
      const dt = new Date(`${p[1].replace(/\//g, '-')}T${p[2]}`);
      if (!isNaN(dt.getTime())) entries.push({ type: 'o', datetime: dt.toISOString() });
    }
  }
  return entries;
}

export function exportTimeclock(entries: Entry[]): string {
  return entries.map(e =>
    e.type === 'i' ? `i ${formatTC(e.datetime)} ${e.account}` : `o ${formatTC(e.datetime)}`
  ).join('\n') + '\n';
}

// Spreadsheets run a cell starting with = + - @ (or tab/CR) as a formula;
// a leading apostrophe makes it plain text. Only for free-text fields.
function csvText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// One row per session, local time. Open sessions have blank End/Hours.
export function exportCsv(sessions: SessionData[]): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = (d: Date) => `${d.toLocaleDateString('en-CA')} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const rows = [['Date', 'Project', 'Start', 'End', 'Hours']];
  for (const s of sessions) {
    rows.push([
      s.date,
      csvText(s.account ?? ''),
      stamp(s.startDt),
      s.endDt ? stamp(s.endDt) : '',
      s.ms !== null ? (s.ms / 3600000).toFixed(2) : '',
    ]);
  }
  return rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0h 00m';
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function calcSessions(entries: Entry[]): SessionData[] {
  const sessions: SessionData[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.type !== 'i') continue;
    const next = entries[i + 1];
    const startDt = new Date(e.datetime);
    if (!next || next.type !== 'o') {
      // Only the very last entry can be a running session; an earlier
      // unpaired clock-in is missing its clock-out.
      sessions.push({ inIdx: i, outIdx: null, account: e.account as string, startDt, endDt: null, ms: null, date: startDt.toLocaleDateString('en-CA'),
        ...(next ? { broken: true } : {}) });
    } else {
      const endDt = new Date(next.datetime);
      sessions.push({ inIdx: i, outIdx: i + 1, account: e.account as string, startDt, endDt, ms: endDt.getTime() - startDt.getTime(), date: startDt.toLocaleDateString('en-CA') });
    }
  }
  return sessions;
}

export interface SessionInput {
  account: string;
  start: Date;
  /** null keeps the session open (only valid as the latest session). */
  end: Date | null;
}

/**
 * Add a session, or move/replace an existing one (`replace` gives its entry
 * indices), keeping `entries` in chronological in/out pairs so calcSessions
 * still pairs them. Refuses a session that overlaps another one, runs
 * backwards, or starts in the future.
 */
export function placeSession(
  entries: Entry[],
  s: SessionInput,
  replace?: { inIdx: number; outIdx: number | null },
  now: Date = new Date()
): { entries: Entry[] } | { error: string } {
  const startMs = s.start.getTime();
  const endMs = s.end?.getTime() ?? null;
  if (isNaN(startMs) || (endMs !== null && isNaN(endMs))) return { error: 'Enter a valid date and time.' };
  if (!s.account) return { error: 'Pick a project.' };
  if (endMs !== null && endMs <= startMs) return { error: 'End must be after start.' };
  if (startMs > now.getTime() || (endMs ?? 0) > now.getTime()) return { error: "Times can't be in the future." };

  const rest = replace
    ? entries.filter((_, i) => i !== replace.inIdx && i !== replace.outIdx)
    : [...entries];

  for (const o of calcSessions(rest)) {
    const oStart = o.startDt.getTime();
    // A broken session has no known end, so only its clock-in is a fixed
    // point: a new session may end at it but not contain it (the log would
    // stop being chronological).
    if (o.broken) {
      if (startMs <= oStart && (endMs ?? Infinity) > oStart) {
        const day = o.startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { error: `Contains ${o.account}'s clock-in with no clock-out (${day}, ${fmtTime(o.startDt)}). Fix that one first.` };
      }
      continue;
    }
    const oEnd = o.endDt?.getTime() ?? Infinity;
    const end = endMs ?? Infinity;
    if (startMs < oEnd && end > oStart) {
      const day = o.startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { error: `Overlaps ${o.account} (${day}, ${fmtTime(o.startDt)}–${o.endDt ? fmtTime(o.endDt) : 'now'}).` };
    }
  }

  const inEntry: Entry = { type: 'i', datetime: s.start.toISOString(), account: s.account };
  if (endMs === null) return { entries: [...rest, inEntry] };

  // Insert before the first entry after our start; on a tie an 'i' sorts
  // after us (a session may end exactly when the next one starts).
  const startIso = inEntry.datetime;
  let pos = rest.findIndex(e => e.datetime > startIso || (e.datetime === startIso && e.type === 'i'));
  if (pos === -1) pos = rest.length;
  const next = [...rest];
  next.splice(pos, 0, inEntry, { type: 'o', datetime: s.end!.toISOString() });
  return { entries: next };
}

/**
 * Union of two entry lists, skipping duplicates (same datetime + type), in
 * time order. Each list keeps its own order for equal times (so a valid log
 * is never rearranged); between the two lists, a clock-out goes before a
 * clock-in at the same time, so a session ending exactly when one from the
 * other list starts stays paired.
 */
export function mergeEntries(prev: Entry[], incoming: Entry[]): Entry[] {
  const byTime = (list: Entry[]) => [...list].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const existing = new Set(prev.map(e => e.datetime + e.type));
  const a = byTime(prev);
  const b = byTime(incoming).filter(e => !existing.has(e.datetime + e.type));
  // At a tie, a clock-out that closes an earlier clock-in comes first, then
  // clock-ins, then the clock-out of a zero-length session.
  const rank = (list: Entry[], k: number) => list[k].type === 'i' ? 1
    : k > 0 && list[k - 1].type === 'i' && list[k - 1].datetime === list[k].datetime ? 2 : 0;
  const out: Entry[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const c = a[i].datetime.localeCompare(b[j].datetime) || rank(a, i) - rank(b, j);
    out.push(c <= 0 ? a[i++] : b[j++]);
  }
  return out.concat(a.slice(i), b.slice(j));
}

/** `YYYY-MM-DD` shifted by whole calendar days (DST-safe). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA');
}

/** Whole calendar days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

/** A local Date from `YYYY-MM-DD` + `HH:MM` form values. */
export function localDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function groupByDay(sessions: SessionData[]): DayData[] {
  const days: Record<string, DayData> = {};
  for (const s of sessions) {
    if (!days[s.date]) days[s.date] = { date: s.date, totalMs: 0, sessions: [] };
    days[s.date].sessions.push(s);
    if (s.ms) days[s.date].totalMs += s.ms;
  }
  return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
}

/** "just now", "5 min ago", "3 h ago", "12 days ago". */
export function fmtAgo(from: Date | string, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(from).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(dt: Date | string): string {
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
