import { describe, it, expect } from 'vitest';
import { placeSession, mergeEntries, calcSessions, fmtAgo, type Entry } from '../timeclock';
import { parseGistId, backupFiles, parseBackupJson, JOURNAL_FILE, JSON_FILE } from '../gist';

const at = (h: number, m = 0, day = 1) => new Date(2024, 0, day, h, m);
const iso = (h: number, m = 0, day = 1) => at(h, m, day).toISOString();
const NOW = at(23, 0, 5);

// 09:00–10:00 A, 13:00–14:00 B on Jan 1
const base: Entry[] = [
  { type: 'i', datetime: iso(9), account: 'A' },
  { type: 'o', datetime: iso(10) },
  { type: 'i', datetime: iso(13), account: 'B' },
  { type: 'o', datetime: iso(14) },
];

function ok(r: ReturnType<typeof placeSession>): Entry[] {
  if ('error' in r) throw new Error(r.error);
  return r.entries;
}

describe('placeSession', () => {
  it('inserts a session between existing ones, keeping pairs in order', () => {
    const next = ok(placeSession(base, { account: 'C', start: at(11), end: at(12) }, undefined, NOW));
    expect(calcSessions(next).map(s => s.account)).toEqual(['A', 'C', 'B']);
    expect(next.map(e => e.type).join('')).toBe('ioioio');
  });

  it('appends a session after the last one', () => {
    const next = ok(placeSession(base, { account: 'C', start: at(9, 0, 2), end: at(10, 0, 2) }, undefined, NOW));
    expect(calcSessions(next).at(-1)!.account).toBe('C');
  });

  it('allows a session that ends exactly when the next starts', () => {
    const next = ok(placeSession(base, { account: 'C', start: at(12), end: at(13) }, undefined, NOW));
    const sessions = calcSessions(next);
    expect(sessions.map(s => s.account)).toEqual(['A', 'C', 'B']);
    expect(sessions.every(s => s.ms === 3600000)).toBe(true);
  });

  it('rejects overlaps, backwards ranges and future times', () => {
    expect(placeSession(base, { account: 'C', start: at(9, 30), end: at(11) }, undefined, NOW)).toHaveProperty('error');
    expect(placeSession(base, { account: 'C', start: at(8), end: at(15) }, undefined, NOW)).toHaveProperty('error');
    expect(placeSession(base, { account: 'C', start: at(12), end: at(11) }, undefined, NOW)).toHaveProperty('error');
    expect(placeSession(base, { account: 'C', start: at(22, 0, 5), end: at(23, 30, 5) }, undefined, NOW)).toHaveProperty('error');
    expect(placeSession(base, { account: '', start: at(11), end: at(12) }, undefined, NOW)).toHaveProperty('error');
  });

  it('rejects a session inside a running one', () => {
    const running: Entry[] = [...base, { type: 'i', datetime: iso(15), account: 'R' }];
    expect(placeSession(running, { account: 'C', start: at(16), end: at(17) }, undefined, NOW)).toHaveProperty('error');
    const next = ok(placeSession(running, { account: 'C', start: at(11), end: at(12) }, undefined, NOW));
    expect(calcSessions(next).at(-1)).toMatchObject({ account: 'R', endDt: null });
  });

  it('moves an edited session to another day and across midnight', () => {
    const next = ok(placeSession(base, { account: 'A', start: at(22, 0, 3), end: at(1, 0, 4) }, { inIdx: 0, outIdx: 1 }, NOW));
    const sessions = calcSessions(next);
    expect(sessions.map(s => s.account)).toEqual(['B', 'A']);
    expect(sessions[1].ms).toBe(3 * 3600000);
  });

  it('lets an edit overlap its own old times', () => {
    const next = ok(placeSession(base, { account: 'A', start: at(9, 30), end: at(10, 30) }, { inIdx: 0, outIdx: 1 }, NOW));
    expect(calcSessions(next)[0].startDt).toEqual(at(9, 30));
  });

  it('keeps an edited running session open and last', () => {
    const running: Entry[] = [...base, { type: 'i', datetime: iso(15), account: 'R' }];
    const next = ok(placeSession(running, { account: 'R', start: at(14, 30), end: null }, { inIdx: 4, outIdx: null }, NOW));
    expect(next.at(-1)).toEqual({ type: 'i', datetime: iso(14, 30), account: 'R' });
    expect(placeSession(running, { account: 'R', start: at(13, 30), end: null }, { inIdx: 4, outIdx: null }, NOW)).toHaveProperty('error');
  });
});

describe('mergeEntries', () => {
  it('skips duplicates and sorts', () => {
    const extra: Entry[] = [{ type: 'i', datetime: iso(7), account: 'X' }, { type: 'o', datetime: iso(8) }, base[0]];
    const merged = mergeEntries(base, extra);
    expect(merged).toHaveLength(6);
    expect(merged[0].account).toBe('X');
  });
});

describe('fmtAgo', () => {
  it('formats relative times', () => {
    const now = at(12);
    expect(fmtAgo(at(12), now)).toBe('just now');
    expect(fmtAgo(at(11, 55), now)).toBe('5 min ago');
    expect(fmtAgo(at(9), now)).toBe('3 h ago');
    expect(fmtAgo(at(12, 0, 0), now)).toBe('1 day ago');
  });
});

describe('gist helpers', () => {
  it('parses gist IDs from URLs', () => {
    const id = 'aa5a315d61ae9438b18d';
    expect(parseGistId(id)).toBe(id);
    expect(parseGistId(`https://gist.github.com/someone/${id}`)).toBe(id);
    expect(parseGistId(`https://gist.github.com/${id}/`)).toBe(id);
    expect(parseGistId('not a gist')).toBeNull();
    expect(parseGistId('')).toBeNull();
  });

  it('round-trips app state through the backup files', () => {
    const state = { entries: base, projects: ['A', 'B'], hiddenProjects: ['B'] };
    const files = backupFiles(state);
    expect(files[JOURNAL_FILE]).toMatch(/^i 2024\/01\/01 09:00 A\n/);
    expect(parseBackupJson(files[JSON_FILE])).toEqual(state);
  });

  it('drops malformed entries and rejects non-backups', () => {
    const parsed = parseBackupJson(JSON.stringify({ entries: [base[0], { type: 'x' }, { type: 'o', datetime: 'nope' }] }));
    expect(parsed.entries).toEqual([base[0]]);
    expect(parsed.projects).toEqual([]);
    expect(() => parseBackupJson('{}')).toThrow();
  });
});
