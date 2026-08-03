import { describe, expect, it } from 'vitest';
import { computeOrgChartLayout } from './orgChartLayout';
import type { Seat } from './seatsApi';

function seat(id: string, parentSeatId: string | null): Seat {
  return { id, tenantId: 'tasvalor', name: id, parentSeatId, rolesAndResponsibilities: [], occupants: [] };
}

describe('computeOrgChartLayout', () => {
  it('places every seat exactly once', () => {
    const seats = [seat('ceo', null), seat('sales', 'ceo'), seat('ops', 'ceo')];
    const positions = computeOrgChartLayout(seats);

    expect(positions).toHaveLength(3);
    expect(new Set(positions.map((p) => p.seat.id))).toEqual(new Set(['ceo', 'sales', 'ops']));
  });

  it('gives children a strictly greater y than their parent', () => {
    const seats = [seat('ceo', null), seat('sales', 'ceo')];
    const positions = computeOrgChartLayout(seats);

    const ceo = positions.find((p) => p.seat.id === 'ceo')!;
    const sales = positions.find((p) => p.seat.id === 'sales')!;
    expect(sales.y).toBeGreaterThan(ceo.y);
  });

  it('centers a parent above the midpoint of its children', () => {
    const seats = [seat('ceo', null), seat('a', 'ceo'), seat('b', 'ceo')];
    const positions = computeOrgChartLayout(seats);

    const ceo = positions.find((p) => p.seat.id === 'ceo')!;
    const a = positions.find((p) => p.seat.id === 'a')!;
    const b = positions.find((p) => p.seat.id === 'b')!;
    expect(ceo.x).toBeCloseTo((a.x + b.x) / 2);
  });

  it('treats a seat whose parent is missing from the list as its own root, instead of dropping it', () => {
    const seats = [seat('orphan', 'does-not-exist')];
    const positions = computeOrgChartLayout(seats);

    expect(positions).toHaveLength(1);
    expect(positions[0].seat.id).toBe('orphan');
  });

  it('handles multiple root seats', () => {
    const seats = [seat('root-a', null), seat('root-b', null)];
    const positions = computeOrgChartLayout(seats);

    expect(positions).toHaveLength(2);
    expect(positions.every((p) => p.y === 0)).toBe(true);
  });

  it('handles EOS structure: Visionary -> Integrator -> 3 departments', () => {
    const seats = [
      seat('visionary', null),
      seat('integrator', 'visionary'),
      seat('sales', 'integrator'),
      seat('operations', 'integrator'),
      seat('finance', 'integrator'),
    ];
    const positions = computeOrgChartLayout(seats);

    expect(positions).toHaveLength(5);

    const visionary = positions.find((p) => p.seat.id === 'visionary')!;
    const integrator = positions.find((p) => p.seat.id === 'integrator')!;
    const sales = positions.find((p) => p.seat.id === 'sales')!;
    const operations = positions.find((p) => p.seat.id === 'operations')!;
    const finance = positions.find((p) => p.seat.id === 'finance')!;

    // Visionary at depth 0, Integrator at depth 1, departments at depth 2
    expect(visionary.y).toBe(0);
    expect(integrator.y).toBe(200); // V_GAP
    expect(sales.y).toBe(400);
    expect(operations.y).toBe(400);
    expect(finance.y).toBe(400);

    // Departments should be spread horizontally
    expect(sales.x).toBeLessThan(operations.x);
    expect(operations.x).toBeLessThan(finance.x);

    // Parents centered above children
    expect(integrator.x).toBeCloseTo((sales.x + finance.x) / 2);
    expect(visionary.x).toBe(integrator.x);
  });
});
