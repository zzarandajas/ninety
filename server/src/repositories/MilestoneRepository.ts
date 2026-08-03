import type { Milestone } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateMilestoneInput {
  description: string;
  dueDate: Date;
}

export interface UpdateMilestoneInput {
  description?: string;
  dueDate?: Date;
  completedAt?: Date | null;
}

export class MilestoneRepository {
  constructor(private tenantId: string) {}

  findAllForRock(rockId: string): Promise<Milestone[]> {
    return prisma.milestone.findMany({
      where: { rockId, tenantId: this.tenantId },
      orderBy: { dueDate: 'asc' },
    });
  }

  create(rockId: string, data: CreateMilestoneInput): Promise<Milestone> {
    return prisma.milestone.create({ data: { ...data, rockId, tenantId: this.tenantId } });
  }

  async update(id: string, data: UpdateMilestoneInput): Promise<Milestone | null> {
    const result = await prisma.milestone.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return prisma.milestone.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.milestone.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
