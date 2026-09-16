import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { L10Meeting } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    l10Meeting: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma.js';
import { L10MeetingRepository } from './L10MeetingRepository.js';

const TENANT_A = 'tenant-a';

function makeMeeting(overrides: Partial<L10Meeting> = {}): L10Meeting {
  return {
    id: 'meeting-1',
    tenantId: TENANT_A,
    meetingDate: new Date('2026-08-03T00:00:00.000Z'),
    facilitatorUserId: 'user-1',
    quarter: '2026-Q3',
    status: 'scheduled',
    segueNotes: null,
    headlines: null,
    concludeNotes: null,
    overallRating: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    timerStartedAt: null,
    timerAccumulatedSeconds: 0,
    timerIsPaused: false,
    currentSectionId: null,
    currentSectionStartedAt: null,
    sectionSeconds: {},
    ...overrides,
  };
}

describe('L10MeetingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('scopes to tenantId and orders by meetingDate descending', async () => {
      vi.mocked(prisma.l10Meeting.findMany).mockResolvedValue([makeMeeting()]);
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.findAll();

      expect(prisma.l10Meeting.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        orderBy: { meetingDate: 'desc' },
      });
    });

    it('adds a status filter when provided', async () => {
      vi.mocked(prisma.l10Meeting.findMany).mockResolvedValue([]);
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.findAll({ status: 'completed' });

      expect(prisma.l10Meeting.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, status: 'completed' },
        orderBy: { meetingDate: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes to tenantId', async () => {
      vi.mocked(prisma.l10Meeting.findFirst).mockResolvedValue(makeMeeting());
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.findById('meeting-1');

      expect(prisma.l10Meeting.findFirst).toHaveBeenCalledWith({ where: { id: 'meeting-1', tenantId: TENANT_A } });
    });
  });

  describe('create', () => {
    it('injects tenantId and defaults status to scheduled', async () => {
      vi.mocked(prisma.l10Meeting.create).mockResolvedValue(makeMeeting());
      const repo = new L10MeetingRepository(TENANT_A);
      const meetingDate = new Date('2026-08-03T00:00:00.000Z');

      await repo.create({ meetingDate, facilitatorUserId: 'user-1', quarter: '2026-Q3' }, 'user-1');

      expect(prisma.l10Meeting.create).toHaveBeenCalledWith({
        data: {
          meetingDate,
          facilitatorUserId: 'user-1',
          quarter: '2026-Q3',
          tenantId: TENANT_A,
          status: 'scheduled',
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 0 });
      const repo = new L10MeetingRepository(TENANT_A);

      expect(await repo.update('missing', { segueNotes: 'x' }, 'user-1')).toBeNull();
    });

    it('updates the matching row scoped to tenantId, including close-style fields', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.l10Meeting.findFirst).mockResolvedValue(makeMeeting({ status: 'completed', overallRating: 8 }));
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.update(
        'meeting-1',
        { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' },
        'user-1'
      );

      expect(prisma.l10Meeting.updateMany).toHaveBeenCalledWith({
        where: { id: 'meeting-1', tenantId: TENANT_A },
        data: { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión', updatedByUserId: 'user-1' },
      });
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted, scoped to tenantId', async () => {
      vi.mocked(prisma.l10Meeting.deleteMany).mockResolvedValue({ count: 1 });
      const repo = new L10MeetingRepository(TENANT_A);

      expect(await repo.delete('meeting-1')).toBe(true);
      expect(prisma.l10Meeting.deleteMany).toHaveBeenCalledWith({ where: { id: 'meeting-1', tenantId: TENANT_A } });
    });

    it('returns false when nothing matched', async () => {
      vi.mocked(prisma.l10Meeting.deleteMany).mockResolvedValue({ count: 0 });
      const repo = new L10MeetingRepository(TENANT_A);

      expect(await repo.delete('missing')).toBe(false);
    });
  });
});
