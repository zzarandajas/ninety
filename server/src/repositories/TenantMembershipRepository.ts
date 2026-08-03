import type { TenantRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

export class TenantMembershipRepository {
  constructor(private tenantId: string) {}

  findAll() {
    return prisma.tenantMembership.findMany({
      where: { tenantId: this.tenantId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        seat: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { user: { fullName: 'asc' } }],
    });
  }

  findByUserId(userId: string) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId: this.tenantId } },
    });
  }

  findOne(membershipId: string) {
    return prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId: this.tenantId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        seat: { select: { id: true, name: true } },
      },
    });
  }

  private async findOrThrow(membershipId: string) {
    const membership = await prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId: this.tenantId },
    });
    if (!membership) throw new HttpError(404, 'Membership not found');
    return membership;
  }

  /**
   * Crea la membership de un usuario en este tenant. Si ya existía (inactiva,
   * de un paso anterior por el tenant), la reactiva en vez de duplicar fila —
   * el `@@unique([userId, tenantId])` del schema no permite dos filas para el
   * mismo par de todos modos.
   */
  async create(userId: string, role: TenantRole) {
    const existing = await this.findByUserId(userId);
    if (existing?.isActive) {
      throw new HttpError(409, 'User already belongs to this tenant');
    }
    if (existing) {
      return prisma.tenantMembership.update({
        where: { id: existing.id },
        data: { isActive: true, role },
      });
    }

    return prisma.tenantMembership.create({
      data: { userId, tenantId: this.tenantId, role },
    });
  }

  async assignSeat(membershipId: string, seatId: string | null) {
    const membership = await this.findOrThrow(membershipId);

    if (seatId) {
      const seat = await prisma.seat.findFirst({ where: { id: seatId, tenantId: this.tenantId } });
      if (!seat) throw new HttpError(404, 'Seat not found');

      const occupiedBy = await prisma.tenantMembership.findFirst({
        where: { seatId, tenantId: this.tenantId, isActive: true, id: { not: membershipId } },
      });
      if (occupiedBy) throw new HttpError(409, 'Seat is already occupied');
    }

    return prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { seatId },
    });
  }

  async updateRole(membershipId: string, role: TenantRole) {
    await this.findOrThrow(membershipId);
    return prisma.tenantMembership.update({ where: { id: membershipId }, data: { role } });
  }

  /**
   * Desactivar libera el seat automáticamente (queda disponible para otra
   * persona); reactivar no reasigna seat, un admin lo hace a mano.
   */
  async setActive(membershipId: string, isActive: boolean) {
    await this.findOrThrow(membershipId);
    return prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { isActive, ...(isActive ? {} : { seatId: null }) },
    });
  }
}
