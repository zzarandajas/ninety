import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../repositories/L10MeetingRepository.js', () => ({ L10MeetingRepository: vi.fn() }));
vi.mock('../repositories/L10AgendaItemLogRepository.js', () => ({ L10AgendaItemLogRepository: vi.fn() }));
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));

import { buildApp } from '../app.js';
import { L10MeetingRepository } from '../repositories/L10MeetingRepository.js';
import { L10AgendaItemLogRepository } from '../repositories/L10AgendaItemLogRepository.js';

const mockMeeting = {
  id: 'meeting-1',
  tenantId: 'tenant-a',
  meetingDate: '2026-08-03T00:00:00.000Z',
  facilitatorUserId: 'user-1',
  status: 'scheduled',
  segueNotes: null,
  headlines: null,
  concludeNotes: null,
  overallRating: null,
};

const mockLog = {
  id: 'log-1',
  tenantId: 'tenant-a',
  meetingId: 'meeting-1',
  itemType: 'rock_review',
  referenceId: 'rock-1',
  notes: 'Sigue on track',
};

describe('routes/l10', () => {
  let app: FastifyInstance;
  let meetingRepoMock: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let logRepoMock: {
    findAllForMeeting: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    meetingRepoMock = {
      findAll: vi.fn().mockResolvedValue([mockMeeting]),
      findById: vi.fn().mockResolvedValue(mockMeeting),
      create: vi.fn().mockResolvedValue(mockMeeting),
      update: vi.fn().mockResolvedValue(mockMeeting),
      delete: vi.fn().mockResolvedValue(true),
    };
    logRepoMock = {
      findAllForMeeting: vi.fn().mockResolvedValue([mockLog]),
      create: vi.fn().mockResolvedValue(mockLog),
    };
    vi.mocked(L10MeetingRepository).mockImplementation(() => meetingRepoMock as never);
    vi.mocked(L10AgendaItemLogRepository).mockImplementation(() => logRepoMock as never);
    app = await buildApp();
  });

  it('GET /l10 lists meetings for the tenant', async () => {
    const res = await app.inject({ method: 'GET', url: '/l10' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockMeeting]);
  });

  it('GET /l10?status=completed passes the filter through', async () => {
    await app.inject({ method: 'GET', url: '/l10?status=completed' });
    expect(meetingRepoMock.findAll).toHaveBeenCalledWith({ status: 'completed' });
  });

  it('POST /l10 creates a meeting and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/l10',
      payload: { meetingDate: '2026-08-03', facilitatorUserId: 'user-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(meetingRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ facilitatorUserId: 'user-1' }),
      'user-1'
    );
  });

  it('GET /l10/:id returns the meeting', async () => {
    const res = await app.inject({ method: 'GET', url: '/l10/meeting-1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(mockMeeting);
  });

  it('GET /l10/:id returns 404 when not found', async () => {
    meetingRepoMock.findById.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/l10/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /l10/:id updates notes and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/l10/meeting-1', payload: { segueNotes: 'Todo bien' } });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith('meeting-1', { segueNotes: 'Todo bien' }, 'user-1');
  });

  it('PATCH /l10/:id returns 404 when the repo returns null', async () => {
    meetingRepoMock.update.mockResolvedValue(null);
    const res = await app.inject({ method: 'PATCH', url: '/l10/missing', payload: { segueNotes: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /l10/:id returns 204 on success', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/l10/meeting-1' });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /l10/:id returns 404 when nothing was deleted', async () => {
    meetingRepoMock.delete.mockResolvedValue(false);
    const res = await app.inject({ method: 'DELETE', url: '/l10/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /l10/:id/close sets status=completed and passes rating+notes to update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/l10/meeting-1/close',
      payload: { overallRating: 8, concludeNotes: 'Buena reunión' },
    });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith(
      'meeting-1',
      { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' },
      'user-1'
    );
  });

  it('POST /l10/:id/close rejects a rating outside 1-10 with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/l10/meeting-1/close', payload: { overallRating: 11 } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /l10/:id/close returns 404 when the meeting does not exist', async () => {
    meetingRepoMock.update.mockResolvedValue(null);
    const res = await app.inject({ method: 'POST', url: '/l10/missing/close', payload: { overallRating: 8 } });
    expect(res.statusCode).toBe(404);
  });

  it('GET /l10/:id/agenda-items lists logs for the meeting', async () => {
    const res = await app.inject({ method: 'GET', url: '/l10/meeting-1/agenda-items' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockLog]);
  });

  it('GET /l10/:id/agenda-items returns 404 when the meeting does not exist', async () => {
    meetingRepoMock.findById.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/l10/missing/agenda-items' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /l10/:id/agenda-items creates a log and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/l10/meeting-1/agenda-items',
      payload: { itemType: 'rock_review', referenceId: 'rock-1', notes: 'Sigue on track' },
    });
    expect(res.statusCode).toBe(201);
    expect(logRepoMock.create).toHaveBeenCalledWith('meeting-1', {
      itemType: 'rock_review',
      referenceId: 'rock-1',
      notes: 'Sigue on track',
    });
  });

  it('POST /l10/:id/agenda-items returns 404 when the meeting does not exist', async () => {
    meetingRepoMock.findById.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST',
      url: '/l10/missing/agenda-items',
      payload: { itemType: 'issue', referenceId: 'issue-1' },
    });
    expect(res.statusCode).toBe(404);
    expect(logRepoMock.create).not.toHaveBeenCalled();
  });
});
