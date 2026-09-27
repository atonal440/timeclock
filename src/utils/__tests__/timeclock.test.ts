import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { exportTimeclock, exportCsv, calcSessions, parseTimeclock, type Entry } from '../timeclock';

describe('exportTimeclock', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('handles an empty array', () => {
    expect(exportTimeclock([])).toBe('\n');
  });

  it('formats an "i" (clock-in) entry with an account correctly', () => {
    const date1 = new Date(2024, 0, 1, 9, 0, 0);
    const entries: Entry[] = [
      { type: 'i', datetime: date1.toISOString(), account: 'Client:Project' }
    ];

    const res = exportTimeclock(entries);
    expect(res).toBe('i 2024/01/01 09:00 Client:Project\n');
  });

  it('formats an "o" (clock-out) entry correctly', () => {
    const entries: Entry[] = [
      { type: 'i', datetime: new Date(2024, 0, 1, 9, 0, 0).toISOString(), account: 'A' },
      { type: 'o', datetime: new Date(2024, 0, 1, 12, 30, 0).toISOString() }
    ];

    const res = exportTimeclock(entries);
    expect(res.split('\n')[1]).toBe('o 2024/01/01 12:30');
  });

  it('comments out a clock-out with no clock-in, which hledger rejects', () => {
    const entries: Entry[] = [
      { type: 'o', datetime: new Date(2024, 0, 1, 12, 30, 0).toISOString() }
    ];
    expect(exportTimeclock(entries)).toBe('; o 2024/01/01 12:30  (no clock-in)\n');
  });

  it('comments out a clock-in missing its clock-out but keeps the running one', () => {
    const at = (h: number) => new Date(2024, 0, 1, h, 0, 0).toISOString();
    const entries: Entry[] = [
      { type: 'i', datetime: at(9), account: 'Stray' },
      { type: 'i', datetime: at(10), account: 'A' },
      { type: 'o', datetime: at(11) },
      { type: 'i', datetime: at(12), account: 'Running' },
    ];
    expect(exportTimeclock(entries).split('\n')).toEqual([
      '; i 2024/01/01 09:00 Stray  (no clock-out; fix it in TimeClock)',
      'i 2024/01/01 10:00 A',
      'o 2024/01/01 11:00',
      'i 2024/01/01 12:00 Running',
      '',
    ]);
  });

  it('handles a typical sequence of clock-in and clock-out entries', () => {
    const d1 = new Date(2024, 0, 1, 9, 0, 0);
    const d2 = new Date(2024, 0, 1, 12, 30, 0);
    const d3 = new Date(2024, 0, 1, 13, 0, 0);
    const d4 = new Date(2024, 0, 1, 17, 0, 0);

    const entries: Entry[] = [
      { type: 'i', datetime: d1.toISOString(), account: 'Work:Internal' },
      { type: 'o', datetime: d2.toISOString() },
      { type: 'i', datetime: d3.toISOString(), account: 'Work:Client' },
      { type: 'o', datetime: d4.toISOString() }
    ];

    const res = exportTimeclock(entries);
    const expected = [
      'i 2024/01/01 09:00 Work:Internal',
      'o 2024/01/01 12:30',
      'i 2024/01/01 13:00 Work:Client',
      'o 2024/01/01 17:00'
    ].join('\n');

    expect(res).toBe(expected + '\n');
  });

  it('formats an "i" entry correctly even if account is missing (edge case)', () => {
    const d1 = new Date(2024, 11, 31, 23, 59, 0);
    const entries: Entry[] = [
      { type: 'i', datetime: d1.toISOString() }
    ];

    const res = exportTimeclock(entries);
    expect(res).toBe('i 2024/12/31 23:59 undefined\n');
  });
});

describe('exportCsv', () => {
  const at = (h: number, m = 0, day = 1) => new Date(2024, 0, day, h, m).toISOString();

  it('writes only a header when there are no sessions', () => {
    expect(exportCsv([])).toBe('Date,Project,Start,End,Hours\r\n');
  });

  it('writes one row per session with decimal hours', () => {
    const entries: Entry[] = [
      { type: 'i', datetime: at(9), account: 'Work:Internal' },
      { type: 'o', datetime: at(12, 30) },
      { type: 'i', datetime: at(13), account: 'Work:Client' },
      { type: 'o', datetime: at(13, 20) },
    ];
    expect(exportCsv(calcSessions(entries)).split('\r\n')).toEqual([
      'Date,Project,Start,End,Hours',
      '2024-01-01,Work:Internal,2024-01-01 09:00,2024-01-01 12:30,3.50',
      '2024-01-01,Work:Client,2024-01-01 13:00,2024-01-01 13:20,0.33',
      '',
    ]);
  });

  it('dates a session crossing midnight by its start and keeps the full end stamp', () => {
    const entries: Entry[] = [
      { type: 'i', datetime: at(23, 0, 1), account: 'Late' },
      { type: 'o', datetime: at(1, 0, 2) },
    ];
    expect(exportCsv(calcSessions(entries))).toContain('2024-01-01,Late,2024-01-01 23:00,2024-01-02 01:00,2.00');
  });

  it('leaves End and Hours blank for a running session', () => {
    const entries: Entry[] = [{ type: 'i', datetime: at(9), account: 'Open' }];
    expect(exportCsv(calcSessions(entries))).toContain('2024-01-01,Open,2024-01-01 09:00,,\r\n');
  });

  it('quotes fields containing commas or quotes', () => {
    const entries: Entry[] = [
      { type: 'i', datetime: at(9), account: 'Acme, Inc:The "Big" One' },
      { type: 'o', datetime: at(10) },
    ];
    expect(exportCsv(calcSessions(entries))).toContain('2024-01-01,"Acme, Inc:The ""Big"" One",');
  });

  it('keeps project names that look like formulas from being evaluated', () => {
    const rows = ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)'].map(account =>
      exportCsv(calcSessions([
        { type: 'i', datetime: at(9), account },
        { type: 'o', datetime: at(10) },
      ])).split('\r\n')[1].split(',')[1]
    );
    expect(rows).toEqual(['"\'=HYPERLINK(""x"")"', "'+1", "'-2", "'@SUM(A1)"]);
  });
});

describe('parseTimeclock', () => {
  const at = (d: number, h: number, m = 0, s = 0) => new Date(2015, 2, d, h, m, s).toISOString();

  it('reads plain entries in either date style, with or without seconds', () => {
    const { entries, skipped } = parseTimeclock('i 2015/03/30 09:00 A:B\no 2015-03-30 10:15:30\n');
    expect(entries).toEqual([
      { type: 'i', datetime: at(30, 9), account: 'A:B' },
      { type: 'o', datetime: at(30, 10, 15, 30) },
    ]);
    expect(skipped).toEqual([]);
  });

  it('drops descriptions, comments, comment lines and b/h/O lines', () => {
    const { entries, skipped } = parseTimeclock([
      '# comment', '; comment', '* comment', 'b 2015/03/30 08:00 ignored', '',
      'i 2015/03/30 09:00:00 some account  optional description ; tags:',
      'o 2015/03/30 09:20:00 ; done',
      'O 2015/03/30 10:00 ignored',
    ].join('\n'));
    expect(entries).toEqual([
      { type: 'i', datetime: at(30, 9), account: 'some account' },
      { type: 'o', datetime: at(30, 9, 20) },
    ]);
    expect(skipped).toEqual([]);
  });

  it('pairs named clock-outs and skips the overlapping session', () => {
    // hledger's own example: another:account 12-15 with some account 13-14 inside it.
    const { entries, skipped } = parseTimeclock([
      'i 2015/04/02 12:00:00 another:account  ; concurrent',
      'i 2015/04/02 13:00:00 some account',
      'o 2015/04/02 14:00:00',
      'o 2015/04/02 15:00:00 another:account',
    ].join('\n'));
    const sessions = calcSessions(entries);
    expect(sessions.map(s => [s.account, s.ms])).toEqual([['another:account', 3 * 3600000]]);
    expect(skipped).toEqual([expect.stringContaining('some account')]);
  });

  it('keeps an unclosed clock-in as open and reports junk lines', () => {
    const { entries, skipped } = parseTimeclock('i 2015/03/30 09:00 A\no 2015/03/30 10:00\ni 2015/03/31 09:00 B\nhello\no 2015/03/31 08:00 Nope\n');
    expect(calcSessions(entries).map(s => [s.account, s.endDt === null])).toEqual([['A', false], ['B', true]]);
    expect(skipped).toEqual(['line 4: not a timeclock entry', 'line 5: clock-out with no matching clock-in']);
  });

  it('round-trips an export, ignoring commented-out strays', () => {
    const log: Entry[] = [
      { type: 'i', datetime: at(30, 8), account: 'Stray' },
      { type: 'i', datetime: at(30, 9), account: 'A' },
      { type: 'o', datetime: at(30, 10) },
    ];
    expect(parseTimeclock(exportTimeclock(log)).entries).toEqual(log.slice(1));
  });
});
