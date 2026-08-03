import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { TenantMembershipRepository } from '../repositories/TenantMembershipRepository.js';
import { SeatRepository } from '../repositories/SeatRepository.js';
import { inviteUser } from '../services/inviteUser.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'tenants');

function sanitizeSlug(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-');
}

const createTenantSchema = z.object({
  name: z.string().min(1, 'El nombre de la empresa es obligatorio'),
  slug: z.string().optional(),
  timezone: z.string().default('Europe/Madrid'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  bgColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
});

const patchTenantSchema = z.object({
  name: z.string().min(1).optional(),
  bgColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  timezone: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

const patchMembershipSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  seatId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const tenantIdParamsSchema = z.object({ tenantId: z.string().uuid() });
const membershipIdParamsSchema = z.object({ id: z.string().uuid() });

interface AdminAccessInfo {
  isOwner: boolean;
  tenantIds: string[]; // Tenants where user is owner or admin
}

/**
 * Checks if user has admin/owner role in any tenant.
 * Returns info about which tenants they can manage.
 * - Owner: can manage all tenants
 * - Admin: can only manage tenants where they are admin/owner
 */
async function getAdminAccess(userId: string): Promise<AdminAccessInfo> {
  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId,
      isActive: true,
      role: { in: ['owner', 'admin'] },
    },
    select: { tenantId: true, role: true },
  });

  if (memberships.length === 0) {
    throw new HttpError(403, 'Requires admin or owner role in at least one company');
  }

  const isOwner = memberships.some((m) => m.role === 'owner');
  const tenantIds = memberships.map((m) => m.tenantId);

  return { isOwner, tenantIds };
}

/**
 * Ensure user has access to a specific tenant
 */
async function ensureTenantAccess(userId: string, tenantId: string) {
  const access = await getAdminAccess(userId);
  if (!access.isOwner && !access.tenantIds.includes(tenantId)) {
    throw new HttpError(403, 'No tienes acceso a esta empresa');
  }
  return access;
}

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  // List tenants (owners see all, admins see only their tenants)
  app.get('/tenants', { preHandler: app.authenticate }, async (request) => {
    const access = await getAdminAccess(request.user.userId);

    const tenants = await prisma.tenant.findMany({
      where: access.isOwner ? undefined : { id: { in: access.tenantIds } },
      include: {
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });
    return tenants;
  });

  // Create a new tenant (only owners can create new tenants)
  app.post('/tenants', { preHandler: app.authenticate }, async (request, reply) => {
    const access = await getAdminAccess(request.user.userId);
    if (!access.isOwner) {
      return reply.code(403).send({ error: 'Solo los propietarios pueden crear nuevas empresas' });
    }
    const body = createTenantSchema.parse(request.body);

    const slugToUse = sanitizeSlug(body.slug || body.name);
    if (!slugToUse) {
      return reply.code(400).send({ error: 'Identificador de empresa (slug) inválido' });
    }

    const existingSlug = await prisma.tenant.findUnique({ where: { slug: slugToUse } });
    if (existingSlug) {
      return reply.code(409).send({ error: 'El identificador (slug) de empresa ya está en uso' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug: slugToUse,
        timezone: body.timezone,
        fiscalYearStartMonth: body.fiscalYearStartMonth,
        ...(body.bgColor ? { bgColor: body.bgColor } : {}),
        ...(body.accentColor ? { accentColor: body.accentColor } : {}),
      },
    });

    // Create default V/TO document for the new tenant
    await prisma.vTODocument.create({
      data: {
        tenantId: tenant.id,
      },
    });

    // Assign current user as owner of the new tenant
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: request.user.userId,
        role: 'owner',
      },
    });

    // Create default EOS seats (Visionary, Integrator, Sales, Operations, Finance)
    const seatRepo = new SeatRepository(tenant.id, prisma);
    await seatRepo.resetToDefault(request.user.userId);

    return reply.code(201).send(tenant);
  });

  // Update a tenant
  app.patch('/tenants/:tenantId', { preHandler: app.authenticate }, async (request, reply) => {
    const { tenantId } = tenantIdParamsSchema.parse(request.params);
    await ensureTenantAccess(request.user.userId, tenantId);
    const body = patchTenantSchema.parse(request.body);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
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

  // Upload logo for a specific tenant by ID
  app.post('/tenants/:tenantId/logo', { preHandler: app.authenticate }, async (request, reply) => {
    const { tenantId } = tenantIdParamsSchema.parse(request.params);
    await ensureTenantAccess(request.user.userId, tenantId);

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG, WEBP or SVG' });
    }

    const buffer = await file.toBuffer();
    const filename = `${tenantId}-logo.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const logoUrl = `/uploads/tenants/${filename}`;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
    });

    return reply.send({ logoUrl });
  });

  // Upload isotype for a specific tenant by ID
  app.post('/tenants/:tenantId/isotype', { preHandler: app.authenticate }, async (request, reply) => {
    const { tenantId } = tenantIdParamsSchema.parse(request.params);
    await ensureTenantAccess(request.user.userId, tenantId);

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG, WEBP or SVG' });
    }

    const buffer = await file.toBuffer();
    const filename = `${tenantId}-isotype.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const isotypeUrl = `/uploads/tenants/${filename}`;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { isotypeUrl },
    });

    return reply.send({ isotypeUrl });
  });

  // List members of a specific tenant
  app.get('/tenants/:tenantId/members', { preHandler: app.authenticate }, async (request) => {
    const { tenantId } = tenantIdParamsSchema.parse(request.params);
    await ensureTenantAccess(request.user.userId, tenantId);
    const repo = new TenantMembershipRepository(tenantId);
    return repo.findAll();
  });

  // Invite / add user to a specific tenant
  app.post('/tenants/:tenantId/members', { preHandler: app.authenticate }, async (request, reply) => {
    const { tenantId } = tenantIdParamsSchema.parse(request.params);
    await ensureTenantAccess(request.user.userId, tenantId);
    const body = inviteMemberSchema.parse(request.body);

    const result = await inviteUser(tenantId, body);
    return reply.code(201).send(result);
  });

  // Update membership role / active status
  app.patch('/memberships/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = membershipIdParamsSchema.parse(request.params);
    const body = patchMembershipSchema.parse(request.body);

    const membership = await prisma.tenantMembership.findUnique({ where: { id } });
    if (!membership) {
      return reply.code(404).send({ error: 'Membership not found' });
    }

    // Verify user has access to this tenant
    await ensureTenantAccess(request.user.userId, membership.tenantId);

    // Business rule: Cannot deactivate the user's last active membership.
    if (body.isActive === false) {
      const otherActiveMemberships = await prisma.tenantMembership.count({
        where: { userId: membership.userId, isActive: true, id: { not: id } },
      });
      if (otherActiveMemberships === 0) {
        throw new HttpError(400, 'No se puede desactivar la membresía de la última empresa del usuario.');
      }
    }

    // Business rule: Cannot remove or demote the last owner of a tenant.
    const isChangingOwnerStatus = (body.isActive === false || (body.role && body.role !== 'owner'));
    if (membership.role === 'owner' && isChangingOwnerStatus) {
      const otherOwners = await prisma.tenantMembership.count({
        where: { tenantId: membership.tenantId, isActive: true, role: 'owner', id: { not: id } },
      });
      if (otherOwners === 0) {
        throw new HttpError(400, 'No se puede eliminar o degradar al último propietario. Asigne otro propietario primero.');
      }
    }

    const repo = new TenantMembershipRepository(membership.tenantId);
    if (body.seatId !== undefined) {
      await repo.assignSeat(id, body.seatId);
    }
    if (body.role !== undefined) {
      await repo.updateRole(id, body.role);
    }
    if (body.isActive !== undefined) {
      await repo.setActive(id, body.isActive);
    }

    const updated = await repo.findOne(id);
    return reply.send(updated);
  });

  // List users (owners see all, admins see only users in their tenants)
  app.get('/users', { preHandler: app.authenticate }, async (request) => {
    const access = await getAdminAccess(request.user.userId);

    const users = await prisma.user.findMany({
      where: access.isOwner
        ? undefined
        : {
            memberships: {
              some: { tenantId: { in: access.tenantIds } },
            },
          },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          where: access.isOwner ? undefined : { tenantId: { in: access.tenantIds } },
          select: {
            id: true,
            tenantId: true,
            role: true,
            isActive: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    return users;
  });
}
