import { apiFetch } from './apiClient';

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed';
export type AgendaItemType = 'rock_review' | 'issue' | 'todo';

export interface MeetingRating {
  id: string;
  meetingId: string;
  userId: string;
  rating: number;
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface L10Meeting {
  id: string;
  tenantId: string;
  quarter: string;
  meetingDate: string;
  facilitatorUserId: string;
  status: MeetingStatus;
  segueNotes: string | null;
  headlines: string | null;
  concludeNotes: string | null;
  overallRating: number | null;
  timerStartedAt: string | null;
  timerAccumulatedSeconds: number;
  timerIsPaused: boolean;
  currentSectionId: string | null;
  currentSectionStartedAt: string | null;
  currentSectionAccumulatedSeconds: number;
  ratings?: MeetingRating[];
}

export interface L10AgendaItemLog {
  id: string;
  tenantId: string;
  meetingId: string;
  itemType: AgendaItemType;
  referenceId: string;
  notes: string | null;
}

export interface MeetingFilters {
  status?: MeetingStatus;
  quarter?: string;
}

export interface CreateMeetingPayload {
  meetingDate: string;
  facilitatorUserId: string;
  quarter: string;
}

export type UpdateMeetingPayload = Partial<{
  meetingDate: string;
  facilitatorUserId: string;
  quarter: string;
  status: MeetingStatus;
  segueNotes: string | null;
  headlines: string | null;
  concludeNotes: string | null;
  timerStartedAt: string | null;
  timerAccumulatedSeconds: number;
  timerIsPaused: boolean;
  currentSectionId: string | null;
  currentSectionStartedAt: string | null;
  currentSectionAccumulatedSeconds: number;
}>;

export interface CloseMeetingPayload {
  concludeNotes?: string;
}

export interface RatingPayload {
  rating: number;
  targetUserId?: string; // Opcional, para calificar a otro
}

export interface CreateAgendaItemPayload {
  itemType: AgendaItemType;
  referenceId: string;
  notes?: string;
}

function buildQuery(filters: MeetingFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.quarter) params.set('quarter', filters.quarter);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const l10Api = {
  list: (filters: MeetingFilters = {}) => apiFetch<L10Meeting[]>(`/l10${buildQuery(filters)}`),

  create: (payload: CreateMeetingPayload) => apiFetch<L10Meeting>('/l10', { method: 'POST', body: JSON.stringify(payload) }),

  get: (id: string) => apiFetch<L10Meeting>(`/l10/${id}`),

  update: (id: string, payload: UpdateMeetingPayload) =>
    apiFetch<L10Meeting>(`/l10/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/l10/${id}`, { method: 'DELETE' }),

  close: (id: string, payload: CloseMeetingPayload) =>
    apiFetch<L10Meeting>(`/l10/${id}/close`, { method: 'POST', body: JSON.stringify(payload) }),

  listAgendaItems: (id: string) => apiFetch<L10AgendaItemLog[]>(`/l10/${id}/agenda-items`),

  logAgendaItem: (id: string, payload: CreateAgendaItemPayload) =>
    apiFetch<L10AgendaItemLog>(`/l10/${id}/agenda-items`, { method: 'POST', body: JSON.stringify(payload) }),

  // Ratings individuales
  getRatings: (id: string) => apiFetch<MeetingRating[]>(`/l10/${id}/ratings`),

  submitRating: (id: string, payload: RatingPayload) =>
    apiFetch<MeetingRating>(`/l10/${id}/ratings`, { method: 'POST', body: JSON.stringify(payload) }),
};
