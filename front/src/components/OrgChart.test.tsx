import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrgChart } from './OrgChart';
import type { Seat } from '../lib/seatsApi';

const seats: Seat[] = [
  { id: 'seat-ceo', tenantId: 't1', name: 'CEO', parentSeatId: null, rolesAndResponsibilities: [], occupants: [] },
  {
    id: 'seat-sales',
    tenantId: 't1',
    name: 'Ventas',
    parentSeatId: 'seat-ceo',
    rolesAndResponsibilities: [],
    occupants: [],
  },
];

describe('OrgChart', () => {
  it('renders a node for every seat', () => {
    render(<OrgChart seats={seats} onSelectSeat={vi.fn()} onReparent={vi.fn()} />);

    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getAllByText('Vacante')).toHaveLength(2);
  });

  it('calls onSelectSeat with the clicked seat', () => {
    // Plain fireEvent.click (not userEvent.click): userEvent's pointer choreography
    // fires a mousedown first, which xyflow's node wrapper forwards into d3-drag —
    // d3-drag then reads a real MouseEvent.view, which jsdom's synthesized event
    // doesn't populate, crashing outside of React. A bare 'click' event still
    // triggers xyflow's onNodeClick without going through the drag machinery.
    const onSelectSeat = vi.fn();
    render(<OrgChart seats={seats} onSelectSeat={onSelectSeat} onReparent={vi.fn()} />);

    fireEvent.click(screen.getByTestId('seat-node-seat-sales'));

    expect(onSelectSeat).toHaveBeenCalledWith(seats[1]);
  });
});
