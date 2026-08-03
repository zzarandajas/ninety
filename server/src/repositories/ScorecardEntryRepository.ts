import type { ScorecardEntry } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type ScorecardEntryView = Omit<ScorecardEntry, 'actualValue'> & { actualValue: number };

function toView(entry: ScorecardEntry): ScorecardEntryView {
  return { ...entry, actualValue: entry.actualValue.toNumber() };
}

export class ScorecardEntryRepository {
  constructor(private tenantId: string) {}

  async findAllSince(periodStart: Date): Promise<ScorecardEntryView[]> {
    const entries = await prisma.scorecardEntry.findMany({
      where: { tenantId: this.tenantId, periodStart: { gte: periodStart } },
    });
    return entries.map(toView);
  }

  async upsert(
    metricId: string,
    periodStart: Date,
    actualValue: number,
    enteredByUserId: string
  ): Promise<ScorecardEntryView> {
    const entry = await prisma.scorecardEntry.upsert({
      where: { metricId_periodStart: { metricId, periodStart } },
      create: { tenantId: this.tenantId, metricId, periodStart, actualValue, enteredByUserId },
      update: { actualValue, enteredByUserId },
    });
    return toView(entry);
  }
}
