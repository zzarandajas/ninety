import type { Todo, TodoStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface TodoFilters {
  status?: TodoStatus;
  ownerUserId?: string;
  quarter?: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  dueDate?: Date;
  originatingMeetingId?: string;
}

export type UpdateTodoInput = Partial<{
  title: string;
  description: string | null;
  ownerUserId: string;
  quarter: string;
  dueDate: Date | null;
  status: TodoStatus;
}>;

export class TodoRepository {
  constructor(private tenantId: string) {}

  findAll(filters: TodoFilters = {}): Promise<Todo[]> {
    return prisma.todo.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  findById(id: string): Promise<Todo | null> {
    return prisma.todo.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  create(data: CreateTodoInput, createdByUserId: string): Promise<Todo> {
    return prisma.todo.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateTodoInput, updatedByUserId: string): Promise<Todo | null> {
    const result = await prisma.todo.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.todo.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
