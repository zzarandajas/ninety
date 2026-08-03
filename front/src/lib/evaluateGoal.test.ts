import { describe, expect, it } from 'vitest';
import { evaluateGoal } from './evaluateGoal';

describe('evaluateGoal', () => {
  it('returns no-data when actual is null', () => {
    expect(evaluateGoal(null, 10, 'gte')).toBe('no-data');
  });

  it('gte: met when actual >= goal, missed otherwise', () => {
    expect(evaluateGoal(12, 10, 'gte')).toBe('met');
    expect(evaluateGoal(10, 10, 'gte')).toBe('met');
    expect(evaluateGoal(8, 10, 'gte')).toBe('missed');
  });

  it('lte: met when actual <= goal, missed otherwise', () => {
    expect(evaluateGoal(8, 10, 'lte')).toBe('met');
    expect(evaluateGoal(10, 10, 'lte')).toBe('met');
    expect(evaluateGoal(12, 10, 'lte')).toBe('missed');
  });

  it('eq: met only when actual === goal', () => {
    expect(evaluateGoal(10, 10, 'eq')).toBe('met');
    expect(evaluateGoal(9, 10, 'eq')).toBe('missed');
  });
});
