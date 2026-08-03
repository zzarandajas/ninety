import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PrismaClient } from '@prisma/client';
import { buildTestApp } from '../test/helpers/buildTestApp.js';
import { mockPrisma } from '../test/mocks/globalMocks.js';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

describe('admin routes', { timeout: 15000 }, () => {
  beforeEach(() => {
    // Clear and reset all mocks before each test
    vi.clearAllMocks();

    // Reset all individual mock functions for each test (important for consistent test results)
    for (const key in mockPrisma.tenant) {
      (mockPrisma.tenant[key as keyof typeof mockPrisma.tenant] as ReturnType<typeof vi.fn>).mockReset();
    }
    for (const key in mockPrisma.user) {
      (mockPrisma.user[key as keyof typeof mockPrisma.user] as ReturnType<typeof vi.fn>).mockReset();
    }
    for (const key in mockPrisma.tenantMembership) {
      (mockPrisma.tenantMembership[key as keyof typeof mockPrisma.tenantMembership] as ReturnType<typeof vi.fn>).mockReset();
    }
    for (const key in mockPrisma.vTODocument) {
      (mockPrisma.vTODocument[key as keyof typeof mockPrisma.vTODocument] as ReturnType<typeof vi.fn>).mockReset();
    }
    for (const key in mockPrisma.seat) {
      (mockPrisma.seat[key as keyof typeof mockPrisma.seat] as ReturnType<typeof vi.fn>).mockReset();
    }

    // Re-set default mock implementations here (can be overridden in specific tests)
    vi.mocked(mockPrisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-admin',
      userId: 'user-1',
      role: 'owner',
      isActive: true,
    } as never);

    vi.mocked(mockPrisma.seat.create).mockImplementation((input) => {
      if (input.data.name === 'Visionario') {
        return { id: 'mock-visionary-seat-id', ...input.data };
      }
      return { id: 'mock-integrator-seat-id', ...input.data };
    });
  });

  it('GET /admin/tenants returns all tenants for an admin user', async () => {
    vi.mocked(mockPrisma.tenant.findMany).mockResolvedValue([
      { id: 't-1', name: 'Tasvalor', slug: 'tasvalor', _count: { memberships: 5 } },
    ] as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].name).toBe('Tasvalor');
    await app.close();
  });

  it('POST /admin/tenants creates a tenant and assigns creator as owner', async () => {
    vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue(null);
    vi.mocked(mockPrisma.tenant.create).mockResolvedValue({
      id: 't-new',
      name: 'Nueva Empresa',
      slug: 'nueva-empresa',
      timezone: 'Europe/Madrid',
      fiscalYearStartMonth: 1,
      bgColor: null,
      accentColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(mockPrisma.vTODocument.create).mockResolvedValue({ id: 'vto-1', tenantId: 't-new' } as never);
    vi.mocked(mockPrisma.tenantMembership.create).mockResolvedValue({ id: 'mem-new', tenantId: 't-new', userId: 'user-1', role: 'owner' } as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Nueva Empresa', slug: 'nueva-empresa' },
    });

    expect(response.statusCode).toBe(201);
    expect(mockPrisma.vTODocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: 't-new' } })
    );
    expect(mockPrisma.tenantMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: 't-new', userId: 'user-1', role: 'owner' } })
    );
    expect(mockPrisma.seat.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.seat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 't-new',
          name: 'Visionario',
          parentSeatId: null,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      })
    );
    expect(mockPrisma.seat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 't-new',
          name: 'Integrador',
          parentSeatId: 'mock-visionary-seat-id',
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      })
    );
    await app.close();
  });

  it('POST /admin/tenants returns 409 when slug already exists', async () => {
    vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue({
      id: 't-existing',
      name: 'Empresa Existente',
      slug: 'nueva-empresa',
    } as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Nueva Empresa', slug: 'nueva-empresa' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'El identificador (slug) de empresa ya está en uso' });
    await app.close();
  });

  it('GET /admin/users returns platform users with memberships', async () => {
    vi.mocked(mockPrisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
      { id: 'user-1', fullName: 'Pablo', email: 'pablo@example.com', memberships: [] },
    ] as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].email).toBe('pablo@example.com');
    await app.close();
  });
  
  it('PATCH /memberships/:id prevents deactivating the last active membership', async () => {
    vi.mocked(mockPrisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'admin-mem',
      userId: 'admin-user',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(mockPrisma.tenantMembership.findUnique).mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', userId: 'user-1' } as never);
    vi.mocked(mockPrisma.tenantMembership.count).mockResolvedValue(0); // No other active memberships

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'admin-user' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/memberships/11111111-1111-4111-8111-111111111111',
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('No se puede desactivar la membresía de la última empresa del usuario.');
    await app.close();
  });

  it('PATCH /memberships/:id prevents removing the last owner of a tenant', async () => {
    vi.mocked(mockPrisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'admin-mem',
      userId: 'admin-user',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(mockPrisma.tenantMembership.findUnique).mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', tenantId: 't-1', role: 'owner' } as never);
    vi.mocked(mockPrisma.tenantMembership.count).mockResolvedValue(0); // No other owners

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'admin-user' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/memberships/11111111-1111-4111-8111-111111111111',
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'admin' }, // Demoting owner
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('No se puede eliminar o degradar al último propietario. Asigne otro propietario primero.');
    await app.close();
  });
});