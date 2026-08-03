import { prisma } from '../lib/prisma.js';
import type { TenantRole } from '@prisma/client';

export interface TenantMember {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: TenantRole;
}

export class TenantMemberRepository {
  constructor(private tenantId: string) {}

  async findAll(): Promise<TenantMember[]> {
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId: this.tenantId, isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });

    return memberships.map((membership) => ({
      userId: membership.user.id,
      fullName: membership.user.fullName,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    }));
  }

  async findByUserId(userId: string): Promise<TenantMember | null> {
    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId: this.tenantId, userId, isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });

    if (!membership) return null;

    return {
      userId: membership.user.id,
      fullName: membership.user.fullName,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    };
  }
}
