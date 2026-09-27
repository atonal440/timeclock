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

export interface ParsedTimeclock {
  entries: Entry[];
  /** Human-readable reasons for lines or sessions that couldn't be imported. */
  skipped: string[];
}

const ENTRY_LINE = /^([io])\s+(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:[+-]\d{4})?(?:\s+(.*))?$/;

/**
 * Read an hledger timeclock file. Follows hledger 1.50's rules: comment
 * lines (`#`, `;`, `*`) and `b`/`h`/`O` lines are ignored; a clock-in's
 * description (after 2+ spaces) and any `;` comment are dropped; a
 * clock-out naming an account closes that session, otherwise the most
 * recent open one. TimeClock tracks one session at a time, so sessions
 * that overlap an earlier one are skipped (and listed in `skipped`); a
 * session never clocked out is kept as an open clock-in.
 */
export function parseTimeclock(content: string): ParsedTimeclock {
  const skipped: string[] = [];
  type Open = { account: string; start: Date; line: number };
  const open: Open[] = []; // most recent last
  const sessions: { account: string; start: Date; end: Date | null }[] = [];

  content.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim();
    const where = `line ${n + 1}`;
    if (!line || /^([#;*]|[bhO]\s)/.test(line)) return;
    const m = line.match(ENTRY_LINE);
    if (!m) { skipped.push(`${where}: not a timeclock entry`); return; }
    const [, code, y, mo, d, hh, mm, ss, rest = ''] = m;
    // Out-of-range parts would silently roll over (09:99 → 10:39).
    if (+hh > 23 || +mm > 59 || +(ss ?? 0) > 59) { skipped.push(`${where}: invalid time`); return; }
    const day = new Date(+y, +mo - 1, +d);
    if (day.getMonth() !== +mo - 1 || day.getDate() !== +d) { skipped.push(`${where}: invalid date`); return; }
    // A +-ZZZZ offset is ignored, as hledger does: times are local.
    const dt = new Date(+y, +mo - 1, +d, +hh, +mm, +(ss ?? 0));
    const text = rest.split(';')[0];
    if (code === 'i') {
      const account = text.split(/\s{2,}|\t/)[0].trim();
      if (!account) { skipped.push(`${where}: clock-in without an account`); return; }
      if (open.some(o => o.account === account)) {
        skipped.push(`${where}: ${account} is already clocked in`);
        return;
      }
      open.push({ account, start: dt, line: n + 1 });
    } else {
      const named = text.trim();
      const k = named ? open.findLastIndex(o => o.account === named) : open.length - 1;
      if (k === -1) { skipped.push(`${where}: clock-out with no matching clock-in`); return; }
      // Check before closing it, so a later valid clock-out can still match.
      if (dt < open[k].start) { skipped.push(`${where}: clock-out before its clock-in (line ${open[k].line})`); return; }
      const [o] = open.splice(k, 1);
      sessions.push({ account: o.account, start: o.start, end: dt });
    }
  });
  for (const o of open) sessions.push({ account: o.account, start: o.start, end: null });

  // Keep sessions that don't overlap one already kept. An unclosed session
  // is just a point (its clock-in), so it only conflicts if it falls inside
  // a kept session.
  sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
  const entries: Entry[] = [];
  let busyUntil = -Infinity;
  for (const s of sessions) {
    const start = s.start.getTime();
    if (start < busyUntil) {
      skipped.push(`${s.account} at ${fmtStamp(s.start)}: overlaps another session`);
      continue;
    }
    entries.push({ type: 'i', datetime: s.start.toISOString(), account: s.account });
    if (s.end) {
      entries.push({ type: 'o', datetime: s.end.toISOString() });
      busyUntil = s.end.getTime();
    }
  }
  return { entries, skipped };
}

export function parseTimeclockFile(content: string): Entry[] {
  return parseTimeclock(content).entries;
}

function fmtStamp(d: Date): string {
  return `${d.toLocaleDateString('en-CA')} ${fmtTime(d)}`;
}

/**
 * hledger timeclock text. A clock-in with no clock-out after it (other than
 * the running one) or a clock-out with no clock-in is written as a comment:
 * hledger would otherwise count the stray clock-in as running until now, or
 * reject the file.
 */
export function exportTimeclock(entries: Entry[]): string {
  return entries.map((e, k) => {
    const prev = entries[k - 1], next = entries[k + 1];
    if (e.type === 'i') {
      const line = `i ${formatTC(e.datetime)} ${e.account}`;
      return next && next.type !== 'o' ? `; ${line}  (no clock-out; fix it in TimeClock)` : line;
    }
    const line = `o ${formatTC(e.datetime)}`;
    return prev?.type === 'i' ? line : `; ${line}  (no clock-in)`;
  }).join('\n') + '\n';
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

  // A clock-out with no clock-in means nothing (the Log ignores it, hledger
  // rejects it); one inside the new session would pair with our clock-in
  // later on, so drop it.
  const startIso = inEntry.datetime, endIso = s.end!.toISOString();
  const kept = rest.filter((e, k) =>
    !(e.type === 'o' && rest[k - 1]?.type !== 'i' && e.datetime > startIso && e.datetime < endIso));

  // Insert before the first entry after our start; on a tie an 'i' sorts
  // after us (a session may end exactly when the next one starts).
  let pos = kept.findIndex(e => e.datetime > startIso || (e.datetime === startIso && e.type === 'i'));
  if (pos === -1) pos = kept.length;
  kept.splice(pos, 0, inEntry, { type: 'o', datetime: endIso });
  return { entries: kept };
}

interface Block {
  kind: 'session' | 'open' | 'stray';
  start: number;
  end: number;
  entries: Entry[];
}

/** Split a log into sessions (i+o), open clock-ins, and stray clock-outs. */
function toBlocks(list: Entry[]): Block[] {
  const blocks: Block[] = [];
  for (let k = 0; k < list.length; k++) {
    const e = list[k], t = Date.parse(e.datetime), next = list[k + 1];
    if (e.type === 'i' && next?.type === 'o') {
      blocks.push({ kind: 'session', start: t, end: Date.parse(next.datetime), entries: [e, next] });
      k++;
    } else {
      blocks.push({ kind: e.type === 'i' ? 'open' : 'stray', start: t, end: t, entries: [e] });
    }
  }
  // The latest entry being a clock-in means it's running: it spans until now.
  const last = blocks.at(-1);
  if (last?.kind === 'open' && list.at(-1) === last.entries[0]) {
    blocks[blocks.length - 1] = { ...last, kind: 'session', end: Infinity };
  }
  return blocks;
}

function clashes(a: Block, b: Block): boolean {
  if (a.kind === 'stray' || b.kind === 'stray') return false;
  if (a.start === b.start) return true;
  if (a.kind === 'session' && b.kind === 'session') return a.start < b.end && a.end > b.start;
  const [point, other] = a.kind === 'open' ? [a, b] : [b, a];
  return other.kind === 'session' && point.start > other.start && point.start < other.end;
}

/**
 * Merge another log (an import or a Gist backup) into this one, a session
 * at a time so pairs never interleave. Incoming sessions already present
 * (same clock-in time) are skipped as duplicates; ones that overlap an
 * existing session are skipped and counted in `skipped`. Stray clock-outs
 * in the incoming log are dropped, as are local ones an added session
 * covers. With nothing to add, `prev` is returned unchanged.
 */
export function mergeLog(prev: Entry[], incoming: Entry[]): { entries: Entry[]; added: number; skipped: number } {
  const local = toBlocks(prev);
  const have = new Set(prev.map(e => e.datetime + e.type));
  const accepted: Block[] = [];
  let skipped = 0;
  for (const b of toBlocks(incoming)) {
    if (b.kind === 'stray' || have.has(b.entries[0].datetime + 'i')) continue;
    if (local.some(o => clashes(b, o)) || accepted.some(o => clashes(b, o))) { skipped++; continue; }
    accepted.push(b);
  }
  if (!accepted.length) return { entries: prev, added: 0, skipped };

  const covered = (t: number) => accepted.some(a => a.kind === 'session' && t > a.start && t < a.end);
  const entries = [...local.filter(b => !(b.kind === 'stray' && covered(b.start))), ...accepted]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .flatMap(b => b.entries);
  return { entries, added: accepted.length, skipped };
}

export function mergeEntries(prev: Entry[], incoming: Entry[]): Entry[] {
  return mergeLog(prev, incoming).entries;
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
