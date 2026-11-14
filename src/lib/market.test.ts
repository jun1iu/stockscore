import { describe, expect, it } from 'vitest';
import { closingMinute, session } from './market';

describe('New York trading hours', () => {
  it('is open on an ordinary weekday and counts down to the bell', () => {
    // Tuesday 10 November 2026, 10:00 in New York (UTC-5).
    expect(session(new Date('2026-11-10T15:00:00Z'))).toEqual({ open: true, time: '10:00:00', next: 'Closing bell in 6h 00m' });
    expect(session(new Date('2026-11-10T14:00:00Z'))).toMatchObject({ open: false, next: 'Opening bell in 30m' });
    expect(session(new Date('2026-11-10T21:00:00Z'))).toMatchObject({ open: false, next: 'Opens Wed 9:30' });
  });

  it('follows daylight saving time', () => {
    // Wednesday 8 July 2026, 15:59 in New York (UTC-4).
    expect(session(new Date('2026-07-08T19:59:00Z'))).toMatchObject({ open: true, time: '15:59:00', next: 'Closing bell in 1m' });
  });

  it('is closed at weekends and skips to the next trading day', () => {
    expect(session(new Date('2026-11-14T17:00:00Z'))).toMatchObject({ open: false, next: 'Opens Mon 9:30' });
  });

  it('knows the holidays', () => {
    expect(closingMinute(2026, 1, 19)).toBeNull(); // Martin Luther King Jr. Day
    expect(closingMinute(2026, 4, 3)).toBeNull(); // Good Friday
    expect(closingMinute(2026, 5, 25)).toBeNull(); // Memorial Day
    expect(closingMinute(2026, 7, 3)).toBeNull(); // Independence Day falls on a Saturday
    expect(closingMinute(2026, 11, 26)).toBeNull(); // Thanksgiving
    expect(closingMinute(2027, 12, 24)).toBeNull(); // Christmas falls on a Saturday
    // Wednesday before Thanksgiving, after the close: Thursday is skipped.
    expect(session(new Date('2026-11-25T22:00:00Z'))).toMatchObject({ open: false, next: 'Opens Fri 9:30' });
  });

  it('does not move New Year’s Day back into the old year', () => {
    expect(closingMinute(2027, 12, 31)).toBe(16 * 60); // 1 January 2028 is a Saturday
    expect(closingMinute(2027, 1, 1)).toBeNull();
  });

  it('closes at 13:00 on half days', () => {
    expect(closingMinute(2026, 11, 27)).toBe(13 * 60);
    expect(closingMinute(2026, 12, 24)).toBe(13 * 60);
    expect(closingMinute(2025, 7, 3)).toBe(13 * 60);
    expect(session(new Date('2026-11-27T18:01:00Z')).open).toBe(false);
  });
});
