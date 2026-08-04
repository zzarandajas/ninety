import type { Issue, IssuePriority, IssueStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface IssueFilters {
  status?: IssueStatus;
  quarter?: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
  quarter: string;
}

export type UpdateIssueInput = Partial<Omit<CreateIssueInput, 'description'>> & {
  description?: string | null;
  status?: IssueStatus;
  resolutionNotes?: string | null;
};

export class IssueRepository {
  constructor(private tenantId: string) {}

  findAll(filters: IssueFilters = {}): Promise<Issue[]> {
    return prisma.issue.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findById(id: string): Promise<Issue | null> {
    return prisma.issue.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  async create(data: CreateIssueInput, createdByUserId: string): Promise<Issue> {
    const last = await prisma.issue.aggregate({
      where: { tenantId: this.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    return prisma.issue.create({
      data: { ...data, tenantId: this.tenantId, sortOrder, createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateIssueInput, updatedByUserId: string): Promise<Issue | null> {
    const patch: Prisma.IssueUncheckedUpdateManyInput = { ...data, updatedByUserId };
    if (data.status !== undefined) {
      const current = await this.findById(id);
      if (!current) return null;
      if (data.status !== current.status) {
        patch.resolvedAt = data.status === 'solved' || data.status === 'dropped' ? new Date() : null;
      }
    }
    const result = await prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: patch });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.issue.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }

  async reorder(orderedIds: string[]): Promise<Issue[]> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: { sortOrder: index } })
      )
    );
    return this.findAll();
  }
}
