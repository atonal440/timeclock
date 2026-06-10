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
      sessions.push({ inIdx: i, outIdx: null, account: e.account as string, startDt, endDt: null, ms: null, date: startDt.toLocaleDateString('en-CA') });
    } else {
      const endDt = new Date(next.datetime);
      sessions.push({ inIdx: i, outIdx: i + 1, account: e.account as string, startDt, endDt, ms: endDt.getTime() - startDt.getTime(), date: startDt.toLocaleDateString('en-CA') });
    }
  }
  return sessions;
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

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(dt: Date | string): string {
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
