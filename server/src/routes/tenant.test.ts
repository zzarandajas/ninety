import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

function multipartPayload(filename: string, mimetype: string, content: string) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;

  return { boundary, body };
}

describe('tenant routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /tenant/members requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/tenant/members' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /tenant/members requires X-Tenant-Id', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('GET /tenant/members returns 403 without a valid membership', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('GET /tenant/members returns the member list for a valid tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      seatId: null,
      isActive: true,
    } as never);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        user: { id: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com' },
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ userId: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com', role: 'owner' }]);
    await app.close();
  });

  it('GET /tenant/settings returns tenant configuration', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: 'tenant-1',
      name: 'Tasvalor',
      slug: 'tasvalor',
      timezone: 'Europe/Madrid',
      fiscalYearStartMonth: 1,
      logoUrl: '/uploads/tenants/tenant-1-logo.png',
      isotypeUrl: '/uploads/tenants/tenant-1-isotype.png',
      bgColor: '#eef7f2',
      accentColor: '#16983c',
      createdAt: new Date(),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/settings',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Tasvalor');
    expect(response.json().bgColor).toBe('#eef7f2');
    expect(response.json().accentColor).toBe('#16983c');
    await app.close();
  });

  it('PATCH /tenant/settings updates tenant name, bgColor, and accentColor', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({
      id: 'tenant-1',
      name: 'Tasvalor Updated',
      slug: 'tasvalor',
      timezone: 'Europe/Madrid',
      fiscalYearStartMonth: 1,
      logoUrl: null,
      isotypeUrl: null,
      bgColor: '#ffffff',
      accentColor: '#1890ff',
      createdAt: new Date(),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'PATCH',
      url: '/tenant/settings',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
      payload: {
        name: 'Tasvalor Updated',
        bgColor: '#ffffff',
        accentColor: '#1890ff',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Tasvalor Updated');
    expect(response.json().accentColor).toBe('#1890ff');
    await app.close();
  });

  it('POST /tenant/logo uploads a logo image and updates tenant logoUrl', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({
      id: 'tenant-1',
      logoUrl: '/uploads/tenants/tenant-1-logo.png',
    } as never);

    const { boundary, body } = multipartPayload('logo.png', 'image/png', 'fake-png-bytes');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/tenant/logo',
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'tenant-1',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ logoUrl: '/uploads/tenants/tenant-1-logo.png' });
    await app.close();
  });

  it('POST /tenant/isotype uploads an isotype image and updates tenant isotypeUrl', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValue({
      id: 'tenant-1',
      isotypeUrl: '/uploads/tenants/tenant-1-isotype.png',
    } as never);

    const { boundary, body } = multipartPayload('isotype.png', 'image/png', 'fake-png-bytes');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/tenant/isotype',
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'tenant-1',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ isotypeUrl: '/uploads/tenants/tenant-1-isotype.png' });
    await app.close();
  });
});
