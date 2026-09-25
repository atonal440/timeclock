import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { exportTimeclock, exportCsv, calcSessions, type Entry } from '../timeclock';

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
    const date1 = new Date(2024, 0, 1, 12, 30, 0);
    const entries: Entry[] = [
      { type: 'o', datetime: date1.toISOString() }
    ];

    const res = exportTimeclock(entries);
    expect(res).toBe('o 2024/01/01 12:30\n');
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
