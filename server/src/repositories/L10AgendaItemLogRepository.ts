import type { AgendaItemType, L10AgendaItemLog } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateAgendaItemLogInput {
  itemType: AgendaItemType;
  referenceId: string;
  notes?: string;
}

export class L10AgendaItemLogRepository {
  constructor(private tenantId: string) {}

  findAllForMeeting(meetingId: string): Promise<L10AgendaItemLog[]> {
    return prisma.l10AgendaItemLog.findMany({ where: { meetingId, tenantId: this.tenantId } });
  }

  create(meetingId: string, data: CreateAgendaItemLogInput): Promise<L10AgendaItemLog> {
    return prisma.l10AgendaItemLog.create({ data: { ...data, meetingId, tenantId: this.tenantId } });
  }
}
