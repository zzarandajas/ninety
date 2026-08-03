import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { L10AgendaItemLog } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    l10AgendaItemLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma.js';
import { L10AgendaItemLogRepository } from './L10AgendaItemLogRepository.js';

const TENANT_A = 'tenant-a';

function makeLog(overrides: Partial<L10AgendaItemLog> = {}): L10AgendaItemLog {
  return {
    id: 'log-1',
    tenantId: TENANT_A,
    meetingId: 'meeting-1',
    itemType: 'rock_review',
    referenceId: 'rock-1',
    notes: null,
    ...overrides,
  };
}

describe('L10AgendaItemLogRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAllForMeeting', () => {
    it('scopes to tenantId and the given meetingId', async () => {
      vi.mocked(prisma.l10AgendaItemLog.findMany).mockResolvedValue([makeLog()]);
      const repo = new L10AgendaItemLogRepository(TENANT_A);

      await repo.findAllForMeeting('meeting-1');

      expect(prisma.l10AgendaItemLog.findMany).toHaveBeenCalledWith({
        where: { meetingId: 'meeting-1', tenantId: TENANT_A },
      });
    });
  });

  describe('create', () => {
    it('injects tenantId and meetingId', async () => {
      vi.mocked(prisma.l10AgendaItemLog.create).mockResolvedValue(makeLog());
      const repo = new L10AgendaItemLogRepository(TENANT_A);

      await repo.create('meeting-1', { itemType: 'issue', referenceId: 'issue-1', notes: 'Se discutió' });

      expect(prisma.l10AgendaItemLog.create).toHaveBeenCalledWith({
        data: {
          itemType: 'issue',
          referenceId: 'issue-1',
          notes: 'Se discutió',
          meetingId: 'meeting-1',
          tenantId: TENANT_A,
        },
      });
    });
  });
});
