import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { exportTimeclock, type Entry } from '../timeclock';

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
