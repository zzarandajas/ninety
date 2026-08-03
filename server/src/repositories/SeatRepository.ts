import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../lib/httpError.js';

export interface SeatInput {
  name: string;
  parentSeatId?: string | null;
  rolesAndResponsibilities?: string[];
}

export class SeatRepository {
  constructor(private tenantId: string, private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.seat.findMany({
      where: { tenantId: this.tenantId },
      include: {
        occupants: {
          where: { isActive: true },
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  private async findOrThrow(id: string) {
    const seat = await this.prisma.seat.findFirst({ where: { id, tenantId: this.tenantId } });
    if (!seat) throw new HttpError(404, 'Seat not found');
    return seat;
  }

  private async assertParentInTenantAndAcyclic(seatId: string | null, parentSeatId: string | null | undefined) {
    if (!parentSeatId) return;

    const parent = await this.prisma.seat.findFirst({ where: { id: parentSeatId, tenantId: this.tenantId } });
    if (!parent) throw new HttpError(404, 'Parent seat not found');

    if (!seatId) return; // creating a new seat: no cycle possible yet

    let current: string | null = parentSeatId;
    while (current) {
      if (current === seatId) {
        throw new HttpError(409, 'Cannot move a seat under one of its own descendants');
      }
      const node: { parentSeatId: string | null } | null = await this.prisma.seat.findFirst({
        where: { id: current, tenantId: this.tenantId },
        select: { parentSeatId: true },
      });
      current = node?.parentSeatId ?? null;
    }
  }

  async create(input: SeatInput, createdByUserId: string) {
    await this.assertParentInTenantAndAcyclic(null, input.parentSeatId);

    return this.prisma.seat.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        parentSeatId: input.parentSeatId ?? null,
        rolesAndResponsibilities: input.rolesAndResponsibilities ?? [],
        createdByUserId,
        updatedByUserId: createdByUserId,
      },
    });
  }

  async update(id: string, input: Partial<SeatInput>, updatedByUserId: string) {
    await this.findOrThrow(id);

    if ('parentSeatId' in input) {
      await this.assertParentInTenantAndAcyclic(id, input.parentSeatId);
    }

    return this.prisma.seat.update({
      where: { id_tenantId: { id, tenantId: this.tenantId } },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...('parentSeatId' in input && { parentSeatId: input.parentSeatId ?? null }),
        ...(input.rolesAndResponsibilities !== undefined && {
          rolesAndResponsibilities: input.rolesAndResponsibilities,
        }),
        updatedByUserId,
      },
    });
  }

  async delete(id: string) {
    await this.findOrThrow(id);

    const childCount = await this.prisma.seat.count({ where: { parentSeatId: id, tenantId: this.tenantId } });
    if (childCount > 0) {
      throw new HttpError(409, 'Reassign or delete child seats before deleting this seat');
    }

    const occupantCount = await this.prisma.tenantMembership.count({
      where: { seatId: id, tenantId: this.tenantId, isActive: true },
    });
    if (occupantCount > 0) {
      throw new HttpError(409, 'Reassign the occupant before deleting this seat');
    }

    await this.prisma.seat.delete({ where: { id_tenantId: { id, tenantId: this.tenantId } } });
  }

  /**
   * Elimina todos los seats del tenant y crea los 5 seats por defecto de EOS:
   * - Visionario (raíz)
   * - Integrador (hijo de Visionario)
   * - Ventas/Marketing, Operaciones, Finanzas (hijos de Integrador)
   */
  async resetToDefault(userId: string) {
    // Desasignar todos los miembros de sus seats y limpiar GWC
    await this.prisma.tenantMembership.updateMany({
      where: { tenantId: this.tenantId, seatId: { not: null } },
      data: { seatId: null, getsIt: null, wantsIt: null, hasCapacity: null },
    });

    // Eliminar todos los seats del tenant
    await this.prisma.seat.deleteMany({ where: { tenantId: this.tenantId } });

    // Crear los seats por defecto de EOS
    const visionarySeat = await this.create(
      {
        name: 'Visionario',
        rolesAndResponsibilities: [
          'Desarrollar y comunicar la visión a largo plazo',
          'Cultivar relaciones clave y alianzas estratégicas',
          'Investigar nuevas oportunidades de mercado',
          'Inspirar y motivar al equipo de liderazgo',
          'Resolver problemas creativamente',
        ],
      },
      userId
    );

    const integratorSeat = await this.create(
      {
        name: 'Integrador',
        parentSeatId: visionarySeat.id,
        rolesAndResponsibilities: [
          'Ejecutar el plan de negocios y la visión',
          'Coordinar y alinear los departamentos',
          'Eliminar obstáculos y resolver conflictos',
          'Gestionar las reuniones de liderazgo (L10)',
          'Asegurar la responsabilidad del equipo',
        ],
      },
      userId
    );

    const salesSeat = await this.create(
      {
        name: 'Ventas/Marketing',
        parentSeatId: integratorSeat.id,
        rolesAndResponsibilities: [
          'Generar demanda y atraer clientes potenciales',
          'Gestionar el proceso de ventas',
          'Desarrollar estrategias de marketing',
          'Cumplir objetivos de ingresos',
          'Mantener relaciones con clientes clave',
        ],
      },
      userId
    );

    const operationsSeat = await this.create(
      {
        name: 'Operaciones',
        parentSeatId: integratorSeat.id,
        rolesAndResponsibilities: [
          'Entregar el producto o servicio',
          'Optimizar procesos y eficiencia',
          'Gestionar la calidad y satisfacción del cliente',
          'Supervisar la cadena de suministro',
          'Escalar la capacidad operativa',
        ],
      },
      userId
    );

    const financeSeat = await this.create(
      {
        name: 'Finanzas',
        parentSeatId: integratorSeat.id,
        rolesAndResponsibilities: [
          'Gestionar el flujo de caja',
          'Preparar informes financieros',
          'Asegurar el cumplimiento fiscal y legal',
          'Desarrollar presupuestos y proyecciones',
          'Controlar costes y rentabilidad',
        ],
      },
      userId
    );

    return [visionarySeat, integratorSeat, salesSeat, operationsSeat, financeSeat];
  }
}
