import type { Seat } from './seatsApi';

export interface SeatPosition {
  seat: Seat;
  x: number;
  y: number;
}

const H_GAP = 260;
const V_GAP = 200;

/**
 * Layout de árbol simple (sin dagre): hojas se colocan de izquierda a
 * derecha en orden de aparición, los padres se centran sobre sus hijos.
 * Soporta varias raíces (parentSeatId null) por si el organigrama queda
 * fragmentado.
 */
export function computeOrgChartLayout(seats: Seat[]): SeatPosition[] {
  const childrenOf = (id: string | null) => seats.filter((seat) => seat.parentSeatId === id);
  const positions: SeatPosition[] = [];
  let nextLeafX = 0;

  function visit(seat: Seat, depth: number): number {
    const children = childrenOf(seat.id);
    let x: number;
    if (children.length === 0) {
      x = nextLeafX * H_GAP;
      nextLeafX += 1;
    } else {
      const childXs = children.map((child) => visit(child, depth + 1));
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }
    positions.push({ seat, x, y: depth * V_GAP });
    return x;
  }

  childrenOf(null).forEach((root) => visit(root, 0));

  // Huérfanos: parentSeatId apunta a un seat que ya no existe en esta lista.
  // No deberían darse (FK), pero si pasara, los tratamos como raíces sueltas
  // en vez de perderlos silenciosamente del organigrama.
  const seenIds = new Set(positions.map((p) => p.seat.id));
  seats
    .filter((seat) => !seenIds.has(seat.id))
    .forEach((seat) => visit(seat, 0));

  return positions;
}
