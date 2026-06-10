import { test, expect } from '@playwright/test';
import { fmtDuration } from '../src/utils/timeclock';

test('fmtDuration handles negative duration', () => {
  expect(fmtDuration(-1000)).toBe('0h 00m');
  expect(fmtDuration(-1)).toBe('0h 00m');
});

test('fmtDuration handles zero duration', () => {
  expect(fmtDuration(0)).toBe('0h 00m');
});

test('fmtDuration handles positive duration', () => {
  expect(fmtDuration(60000)).toBe('0h 01m');
  expect(fmtDuration(3600000)).toBe('1h 00m');
  expect(fmtDuration(3660000)).toBe('1h 01m');
});
