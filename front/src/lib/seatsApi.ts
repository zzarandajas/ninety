import { apiFetch } from './apiClient';

export interface SeatOccupant {
  id: string;
  role: string;
  seatId: string | null;
  getsIt: boolean | null;
  wantsIt: boolean | null;
  hasCapacity: boolean | null;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
}

export interface Seat {
  id: string;
  tenantId: string;
  name: string;
  parentSeatId: string | null;
  rolesAndResponsibilities: string[];
  occupants: SeatOccupant[];
}

export interface SeatPayload {
  name: string;
  parentSeatId?: string | null;
  rolesAndResponsibilities?: string[];
}

export const seatsApi = {
  list: () => apiFetch<Seat[]>('/seats'),

  create: (payload: SeatPayload) => apiFetch<Seat>('/seats', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<SeatPayload>) =>
    apiFetch<Seat>(`/seats/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/seats/${id}`, { method: 'DELETE' }),

  /** Resetea el organigrama a su estado inicial (Visionario + Integrador) */
  reset: () => apiFetch<Seat[]>('/seats/reset', { method: 'POST' }),
};
