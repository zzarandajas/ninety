import type { Rock, RockStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface RockFilters {
  quarter?: string;
  ownerUserId?: string;
}

export interface CreateRockInput {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: Date;
}

export type UpdateRockInput = Partial<Omit<CreateRockInput, 'description'>> & {
  description?: string | null;
  status?: RockStatus;
};

export class RockRepository {
  constructor(private tenantId: string) {}

  findAll(filters: RockFilters = {}): Promise<Rock[]> {
    return prisma.rock.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      },
      include: { milestones: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<Rock | null> {
    return prisma.rock.findFirst({
      where: { id, tenantId: this.tenantId },
      include: { milestones: true },
    });
  }

  create(data: CreateRockInput, createdByUserId: string): Promise<Rock> {
    return prisma.rock.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
      include: { milestones: true },
    });
  }

  async update(id: string, data: UpdateRockInput, updatedByUserId: string): Promise<Rock | null> {
    const result = await prisma.rock.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.rock.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
