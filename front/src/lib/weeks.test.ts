import { describe, expect, it } from 'vitest';
import { lastNMondays, mondayOf } from './weeks';

describe('mondayOf', () => {
  it('returns the same date when given a Monday', () => {
    // 2026-07-13 is a Monday
    const result = mondayOf(new Date('2026-07-13T15:30:00.000Z'));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(6);
    expect(result.getUTCDate()).toBe(13);
  });

  it('rolls a Thursday back to that week\'s Monday', () => {
    const result = mondayOf(new Date('2026-07-16T00:00:00.000Z'));
    expect(result.getUTCDate()).toBe(13);
  });

  it('rolls a Sunday back to that week\'s Monday (not the next one)', () => {
    const result = mondayOf(new Date('2026-07-19T00:00:00.000Z'));
    expect(result.getUTCDate()).toBe(13);
  });
});

describe('lastNMondays', () => {
  it('returns n Mondays in ascending order, ending with the current week\'s Monday', () => {
    const result = lastNMondays(3, new Date('2026-07-16T00:00:00.000Z'));
    expect(result).toHaveLength(3);
    expect(result[0].getUTCDate()).toBe(29); // June 29, 2026
    expect(result[1].getUTCDate()).toBe(6); // July 6, 2026
    expect(result[2].getUTCDate()).toBe(13); // July 13, 2026 (current week)
  });
});
