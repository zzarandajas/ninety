import { Prisma, type MetricComparison, type MetricFrequency, type ScorecardMetric } from '@prisma/client';
import { HttpError } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';

export type ScorecardMetricView = Omit<ScorecardMetric, 'goalValue'> & { goalValue: number };

export interface ScorecardMetricFilters {
  isActive?: boolean;
}

export interface CreateMetricInput {
  code?: string | null;
  name: string;
  description?: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

export type UpdateMetricInput = Partial<Omit<CreateMetricInput, 'description'>> & { description?: string | null };

function toView(metric: ScorecardMetric): ScorecardMetricView {
  return { ...metric, goalValue: metric.goalValue.toNumber() };
}

/** `@@unique([tenantId, code])` violated → 409 instead of a generic 500. */
function rethrowDuplicateCode(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HttpError(409, 'Ya existe una métrica con ese código');
  }
  throw error;
}

export class ScorecardMetricRepository {
  constructor(private tenantId: string) {}

  async findAll(filters: ScorecardMetricFilters = {}): Promise<ScorecardMetricView[]> {
    const metrics = await prisma.scorecardMetric.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return metrics.map(toView);
  }

  async findById(id: string): Promise<ScorecardMetricView | null> {
    const metric = await prisma.scorecardMetric.findFirst({ where: { id, tenantId: this.tenantId } });
    return metric && toView(metric);
  }

  async create(data: CreateMetricInput, createdByUserId: string): Promise<ScorecardMetricView> {
    const metric = await prisma.scorecardMetric
      .create({
        data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
      })
      .catch(rethrowDuplicateCode);
    return toView(metric);
  }

  /** Bulk import: all rows are created in one transaction, or none are. */
  async createMany(rows: CreateMetricInput[], createdByUserId: string): Promise<ScorecardMetricView[]> {
    const metrics = await prisma
      .$transaction(
        rows.map((data) =>
          prisma.scorecardMetric.create({
            data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
          })
        )
      )
      .catch(rethrowDuplicateCode);
    return metrics.map(toView);
  }

  async update(id: string, data: UpdateMetricInput, updatedByUserId: string): Promise<ScorecardMetricView | null> {
    const result = await prisma.scorecardMetric
      .updateMany({
        where: { id, tenantId: this.tenantId },
        data: { ...data, updatedByUserId },
      })
      .catch(rethrowDuplicateCode);
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.scorecardMetric.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
