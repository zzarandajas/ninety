import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { TenantMemberRepository } from '../repositories/TenantMemberRepository.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'tenants');

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  bgColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  timezone: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

async function ensureTenantAdmin(userId: string, tenantId: string) {
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!membership || !membership.isActive || !['owner', 'admin'].includes(membership.role)) {
    throw new HttpError(403, 'Requires admin or owner role in this company');
  }
}

export default async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/members', { preHandler: requireTenant(app) }, async (request) => {
    const repo = new TenantMemberRepository(request.tenantId as string);
    return repo.findAll();
  });

  app.get('/settings', { preHandler: requireTenant(app) }, async (request, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId as string },
    });
    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }
    return tenant;
  });

  app.patch('/settings', { preHandler: requireTenant(app) }, async (request, reply) => {
    await ensureTenantAdmin(request.user.userId, request.tenantId as string);
    const body = updateSettingsSchema.parse(request.body);

    const updated = await prisma.tenant.update({
      where: { id: request.tenantId as string },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.bgColor !== undefined ? { bgColor: body.bgColor } : {}),
        ...(body.accentColor !== undefined ? { accentColor: body.accentColor } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.fiscalYearStartMonth !== undefined ? { fiscalYearStartMonth: body.fiscalYearStartMonth } : {}),
      },
    });

    return reply.send(updated);
  });

  app.post('/logo', { preHandler: requireTenant(app) }, async (request, reply) => {
    await ensureTenantAdmin(request.user.userId, request.tenantId as string);

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG, WEBP or SVG' });
    }

    const buffer = await file.toBuffer();
    const filename = `${request.tenantId as string}-logo.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const logoUrl = `/uploads/tenants/${filename}`;
    await prisma.tenant.update({
      where: { id: request.tenantId as string },
      data: { logoUrl },
    });

    return reply.send({ logoUrl });
  });

  app.post('/isotype', { preHandler: requireTenant(app) }, async (request, reply) => {
    await ensureTenantAdmin(request.user.userId, request.tenantId as string);

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG, WEBP or SVG' });
    }

    const buffer = await file.toBuffer();
    const filename = `${request.tenantId as string}-isotype.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const isotypeUrl = `/uploads/tenants/${filename}`;
    await prisma.tenant.update({
      where: { id: request.tenantId as string },
      data: { isotypeUrl },
    });

    return reply.send({ isotypeUrl });
  });
}
