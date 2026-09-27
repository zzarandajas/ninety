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

  /**
   * Bulk import: upserts every row in one transaction, or none. Callers must have
   * already checked that each `metricId` belongs to this tenant (the import route
   * resolves ids from this tenant's metric codes).
   */
  async upsertMany(
    rows: { metricId: string; periodStart: Date; actualValue: number }[],
    enteredByUserId: string
  ): Promise<number> {
    const entries = await prisma.$transaction(
      rows.map(({ metricId, periodStart, actualValue }) =>
        prisma.scorecardEntry.upsert({
          where: { metricId_periodStart: { metricId, periodStart } },
          create: { tenantId: this.tenantId, metricId, periodStart, actualValue, enteredByUserId },
          update: { actualValue, enteredByUserId },
        })
      )
    );
    return entries.length;
  }
}
