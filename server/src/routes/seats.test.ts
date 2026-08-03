import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwtPlugin from '../plugins/jwt.js';
import seatsRoutes from '../routes/seats.js'; // Correct path to seats routes
import { type PrismaClient } from '@prisma/client';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

// Define the global mock Prisma object with vi.fn() for all methods
const mockPrisma = {
  tenant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  tenantMembership: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  vTODocument: {
    create: vi.fn(),
  },
  seat: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

// Mock the actual Prisma client module to return our global mock object
vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Helper function to build a minimal Fastify app for tests
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    disableRequestLogging: true,
    logger: false,
  });

  // Mock Fastify's authenticate decorator
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorate('authenticate', vi.fn(async (request) => {
    request.user = { userId: 'user-1', role: 'owner', tenantId: 't-1' }; // Default test user
  }));

  await app.register(jwtPlugin);
  await app.register(seatsRoutes); // Register seats routes directly

  // Decorate app with mockPrisma (ensuring it's correctly typed for Fastify)
  app.decorate('prisma', mockPrisma as unknown as PrismaClient);

  return app;
}

describe('seats routes', () => {
  beforeEach(() => {
    // Clear and reset all mocks before each test
    vi.clearAllMocks();

    // Reset all individual mock functions for each test
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

    // Default mock for membershipFor (can be overridden in specific tests)
    vi.mocked(mockPrisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tasvalor',
      role: 'owner',
      seatId: null,
      isActive: true,
    } as never);
  });

  async function membershipFor(role: 'owner' | 'admin' | 'member') {
    vi.mocked(mockPrisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tasvalor',
      role,
      seatId: null,
      isActive: true,
    } as never);
  }

  it('GET /seats works for a plain member (read-only)', async () => {
    await membershipFor('member');
    vi.mocked(mockPrisma.seat.findMany).mockResolvedValue([{ id: 'seat-1', name: 'CEO' }] as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/seats',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: 'seat-1', name: 'CEO' }]);
    await app.close();
  });

  it('POST /seats is rejected with 403 for a plain member', async () => {
    await membershipFor('member');

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/seats',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { name: 'Ventas' },
    });

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.seat.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /seats succeeds for an admin and scopes the row to the active tenant', async () => {
    await membershipFor('admin');
    vi.mocked(mockPrisma.seat.create).mockResolvedValue({ id: 'seat-2', name: 'Ventas', tenantId: 'tasvalor' } as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/seats',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { name: 'Ventas' },
    });

    expect(response.statusCode).toBe(201);
    expect(mockPrisma.seat.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tasvalor' }) })
    );
    await app.close();
  });

  it('PATCH /seats/:id updates the seat and returns 200', async () => {
    await membershipFor('admin');
    vi.mocked(mockPrisma.seat.findFirst).mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    vi.mocked(mockPrisma.seat.update).mockResolvedValue({ id: 'seat-1', name: 'Renombrado' } as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'PATCH',
      url: '/seats/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { name: 'Renombrado' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 'seat-1', name: 'Renombrado' });
    await app.close();
  });

  it('DELETE /seats/:id returns 204 on success', async () => {
    await membershipFor('owner');
    mockPrisma.seat.findFirst.mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    mockPrisma.seat.count.mockResolvedValue(0 as never);
    mockPrisma.tenantMembership.count.mockResolvedValue(0 as never);
    mockPrisma.seat.delete.mockResolvedValue({} as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'DELETE',
      url: '/seats/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('DELETE /seats/:id surfaces the 409 conflict from the repository when the seat has children', async () => {
    await membershipFor('owner');
    mockPrisma.seat.findFirst.mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    mockPrisma.seat.count.mockResolvedValue(1 as never);

    const app = await buildTestApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'DELETE',
      url: '/seats/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(409);
    expect(mockPrisma.seat.delete).not.toHaveBeenCalled();
    await app.close();
  });
});
