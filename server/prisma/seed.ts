import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — set it in your .env before seeding`);
  }
  return value;
}

async function main() {
  console.log('Seeding database...');
  const ownerPassword = requireEnv('SEED_OWNER_PASSWORD');
  console.log('Using owner password from env');

  const tasvalor = await prisma.tenant.upsert({
    where: { slug: 'tasvalor' },
    update: {},
    create: { name: 'Tasvalor', slug: 'tasvalor', bgColor: '#eef7f2', accentColor: '#16983c' },
  });

  const cionet = await prisma.tenant.upsert({
    where: { slug: 'cionet' },
    update: {},
    create: { name: 'Cionet', slug: 'cionet', bgColor: '#f0f4f9', accentColor: '#1890ff' },
  });

  const ownerPasswordHash = await hashPassword(ownerPassword);
  const owner = await prisma.user.upsert({
    where: { email: 'correopro@gmail.com' },
    update: {},
    create: {
      email: 'correopro@gmail.com',
      passwordHash: ownerPasswordHash,
      fullName: 'Pablo',
      mustChangePassword: true,
    },
  });

  for (const tenant of [tasvalor, cionet]) {
    // 'owner' role in TenantMembership is this project's only notion of
    // "administrator" — there is no separate global-admin flag on User.
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
      update: {},
      create: { userId: owner.id, tenantId: tenant.id, role: 'owner' },
    });

    // VTODocument is idempotent (upsert keyed on tenantId) and always runs
    await prisma.vTODocument.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        coreValues: ['Honestidad', 'Excelencia', 'Trabajo en equipo'],
        coreFocusPurpose: 'Ayudar a organizaciones a ejecutar su estrategia con disciplina',
        coreFocusNiche: 'Consultoría EOS para pymes',
        tenYearTarget: 'Ser referentes de EOS en el mercado hispanohablante',
        marketingStrategy: {},
        threeYearPicture: {},
        oneYearPlan: {},
      },
    });

    // Periodos (quarters) idempotentes, como en Ninety. Se crean siempre.
    await prisma.quarter.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label: '2026-Q3' } },
      update: {},
      create: {
        tenantId: tenant.id,
        label: '2026-Q3',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-09-30'),
        theme: 'Ejecutar con foco',
      },
    });

    await prisma.quarter.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label: '2026-Q4' } },
      update: {},
      create: {
        tenantId: tenant.id,
        label: '2026-Q4',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-12-31'),
        isOpen: false,
      },
    });

    // Idempotency guard: skip seeding demo data if this tenant has already been seeded
    const alreadySeeded = await prisma.rock.findFirst({
      where: { tenantId: tenant.id },
    });
    if (alreadySeeded) {
      continue;
    }

    const seat = await prisma.seat.create({
      data: {
        tenantId: tenant.id,
        name: 'CEO/Integrator',
        rolesAndResponsibilities: ['Visión', 'Rentabilidad', 'Liderazgo del equipo'],
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });

    await prisma.seat.createMany({
      data: [
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Ventas',
          rolesAndResponsibilities: ['Pipeline', 'Cierre de clientes nuevos'],
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Operaciones',
          rolesAndResponsibilities: ['Entrega de proyectos', 'Satisfacción de cliente'],
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    await prisma.rock.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Lanzar módulo de Scorecard',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: true,
          status: 'on_track',
          dueDate: new Date('2026-09-30'),
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          title: 'Cerrar 3 nuevos clientes',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: false,
          status: 'off_track',
          dueDate: new Date('2026-09-30'),
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    const metric = await prisma.scorecardMetric.create({
      data: {
        tenantId: tenant.id,
        name: 'Nº leads cualificados/semana',
        ownerUserId: owner.id,
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });

    await prisma.scorecardEntry.createMany({
      data: [
        {
          tenantId: tenant.id,
          metricId: metric.id,
          periodStart: new Date('2026-07-13'),
          actualValue: 12,
          enteredByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          metricId: metric.id,
          periodStart: new Date('2026-07-20'),
          actualValue: 8,
          enteredByUserId: owner.id,
        },
      ],
    });

    await prisma.issue.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Proceso de onboarding de clientes no está documentado',
          raisedByUserId: owner.id,
          status: 'open',
          priority: 'high',
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          title: 'Revisar coste de hosting mensual',
          raisedByUserId: owner.id,
          status: 'discussing',
          priority: 'medium',
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    await prisma.l10Meeting.create({
      data: {
        tenantId: tenant.id,
        meetingDate: new Date('2026-07-27'),
        facilitatorUserId: owner.id,
        status: 'completed',
        segueNotes: 'Buen ambiente, sin novedades personales relevantes.',
        headlines: 'Cliente nuevo firmado esta semana.',
        overallRating: 8,
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });

    await prisma.tenantMembership.updateMany({
      where: { userId: owner.id, tenantId: tenant.id },
      data: { seatId: seat.id },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
