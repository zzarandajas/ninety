export type GoalResult = 'met' | 'missed' | 'no-data';

export function evaluateGoal(actual: number | null, goal: number, comparison: 'gte' | 'lte' | 'eq'): GoalResult {
  if (actual === null) return 'no-data';
  if (comparison === 'gte') return actual >= goal ? 'met' : 'missed';
  if (comparison === 'lte') return actual <= goal ? 'met' : 'missed';
  return actual === goal ? 'met' : 'missed';
}
