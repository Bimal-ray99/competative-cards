import { describe, it, expect } from 'vitest';
import { calculateStreak, normalizeToDates, toUtcDateString } from '../../src/services/streak.js';

const DAY = 86_400_000;
const d = (iso) => new Date(iso).getTime();

describe('toUtcDateString', () => {
  it('converts seconds-epoch to YYYY-MM-DD', () => {
    expect(toUtcDateString(1_700_000_000)).toBe('2023-11-14');
  });
  it('converts ms-epoch', () => {
    expect(toUtcDateString(1_700_000_000_000)).toBe('2023-11-14');
  });
  it('converts Date objects', () => {
    expect(toUtcDateString(new Date('2024-05-01T12:00:00Z'))).toBe('2024-05-01');
  });
  it('returns null for invalid input', () => {
    expect(toUtcDateString('not-a-date')).toBeNull();
    expect(toUtcDateString(null)).toBeNull();
    expect(toUtcDateString(undefined)).toBeNull();
  });
});

describe('normalizeToDates', () => {
  it('deduplicates multiple submissions same day', () => {
    const t = d('2024-06-01T12:00:00Z');
    const list = [t, t + 1000, t + 60_000];
    expect(normalizeToDates(list)).toEqual(['2024-06-01']);
  });
  it('sorts chronologically', () => {
    const list = [d('2024-06-05T00:00:00Z'), d('2024-06-01T00:00:00Z')];
    expect(normalizeToDates(list)).toEqual(['2024-06-01', '2024-06-05']);
  });
  it('ignores invalid entries', () => {
    expect(normalizeToDates(['bogus', null, undefined])).toEqual([]);
  });
});

describe('calculateStreak', () => {
  it('empty input returns zeroes', () => {
    expect(calculateStreak([], { now: d('2024-07-01T00:00:00Z') })).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
      totalActiveDays: 0,
      limited: false,
    });
  });

  it('counts a consecutive run as both current and longest when ending today', () => {
    const now = d('2024-07-10T12:00:00Z');
    const ts = [now - 2 * DAY, now - 1 * DAY, now];
    const r = calculateStreak(ts, { now });
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.totalActiveDays).toBe(3);
  });

  it('current streak includes yesterday as still active', () => {
    const now = d('2024-07-10T00:00:00Z');
    const ts = [now - 2 * DAY, now - 1 * DAY];
    expect(calculateStreak(ts, { now }).current).toBe(2);
  });

  it('current streak is zero when last activity > yesterday', () => {
    const now = d('2024-07-10T00:00:00Z');
    const ts = [now - 5 * DAY, now - 4 * DAY, now - 3 * DAY];
    const r = calculateStreak(ts, { now });
    expect(r.current).toBe(0);
    expect(r.longest).toBe(3);
  });

  it('finds longest run with gaps', () => {
    const now = d('2024-07-10T00:00:00Z');
    const ts = [
      // run of 2
      now - 20 * DAY,
      now - 19 * DAY,
      // run of 5 (longest)
      now - 10 * DAY,
      now - 9 * DAY,
      now - 8 * DAY,
      now - 7 * DAY,
      now - 6 * DAY,
      // run of 1 ending today
      now,
    ];
    const r = calculateStreak(ts, { now });
    expect(r.longest).toBe(5);
    expect(r.current).toBe(1);
    expect(r.totalActiveDays).toBe(8);
  });

  it('duplicate same-day submissions do not inflate streak', () => {
    const now = d('2024-07-10T00:00:00Z');
    const t = now - 1 * DAY;
    const ts = [t, t + 100, t + 1000];
    expect(calculateStreak(ts, { now }).longest).toBe(1);
  });

  it('handles timezone boundaries by using UTC', () => {
    const now = d('2024-07-10T23:59:59Z');
    const ts = [d('2024-07-09T00:00:01Z'), d('2024-07-10T23:00:00Z')];
    expect(calculateStreak(ts, { now }).current).toBe(2);
  });

  it('propagates limited flag', () => {
    const now = d('2024-07-10T00:00:00Z');
    expect(calculateStreak([now], { now, limited: true }).limited).toBe(true);
  });
});
