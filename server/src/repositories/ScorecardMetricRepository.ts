import type { MetricComparison, MetricFrequency, ScorecardMetric } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type ScorecardMetricView = Omit<ScorecardMetric, 'goalValue'> & { goalValue: number };

export interface ScorecardMetricFilters {
  isActive?: boolean;
}

export interface CreateMetricInput {
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
    const metric = await prisma.scorecardMetric.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
    });
    return toView(metric);
  }

  async update(id: string, data: UpdateMetricInput, updatedByUserId: string): Promise<ScorecardMetricView | null> {
    const result = await prisma.scorecardMetric.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.scorecardMetric.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
