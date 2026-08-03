import type { Quarter } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateQuarterInput {
  label: string;
  startDate: Date;
  endDate: Date;
  theme?: string | null;
}

export type UpdateQuarterInput = {
  theme?: string | null;
  startDate?: Date;
  endDate?: Date;
  isOpen?: boolean;
};

export interface QuarterWithCounts extends Quarter {
  rockCount: number;
  openRockCount: number;
}

export class QuarterRepository {
  constructor(private tenantId: string) {}

  async findAll(): Promise<QuarterWithCounts[]> {
    const quarters = await prisma.quarter.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { startDate: 'desc' },
    });

    const counts = await prisma.rock.groupBy({
      by: ['quarter', 'status'],
      where: { tenantId: this.tenantId },
      _count: { _all: true },
    });

    const byLabel = new Map<string, { total: number; open: number }>();
    for (const row of counts) {
      const entry = byLabel.get(row.quarter) ?? { total: 0, open: 0 };
      entry.total += row._count._all;
      if (row.status !== 'done') entry.open += row._count._all;
      byLabel.set(row.quarter, entry);
    }

    return quarters.map((quarter) => ({
      ...quarter,
      rockCount: byLabel.get(quarter.label)?.total ?? 0,
      openRockCount: byLabel.get(quarter.label)?.open ?? 0,
    }));
  }

  findById(id: string): Promise<Quarter | null> {
    return prisma.quarter.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  findByLabel(label: string): Promise<Quarter | null> {
    return prisma.quarter.findFirst({ where: { tenantId: this.tenantId, label } });
  }

  /**
   * Crea un periodo nuevo. Si `rolloverFromLabel` viene dado, mueve los rocks
   * sin completar (`status != done`) de ese periodo al nuevo, dentro de la
   * misma transacción.
   */
  async create(
    data: CreateQuarterInput,
    rolloverFromLabel?: string
  ): Promise<{ quarter: Quarter; movedRockCount: number }> {
    return prisma.$transaction(async (tx) => {
      const quarter = await tx.quarter.create({
        data: { ...data, tenantId: this.tenantId },
      });

      let movedRockCount = 0;
      if (rolloverFromLabel) {
        const result = await tx.rock.updateMany({
          where: {
            tenantId: this.tenantId,
            quarter: rolloverFromLabel,
            status: { not: 'done' },
          },
          data: { quarter: data.label },
        });
        movedRockCount = result.count;
      }

      return { quarter, movedRockCount };
    });
  }

  async update(id: string, data: UpdateQuarterInput): Promise<Quarter | null> {
    const result = await prisma.quarter.updateMany({
      where: { id, tenantId: this.tenantId },
      data,
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }
}
