import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { VTORepository } from '../repositories/VTORepository.js';

const marketingStrategySchema = z.object({
  targetMarket: z.string().optional(),
  threeUniques: z.array(z.string()).optional(),
  provenProcess: z.string().optional(),
  guarantee: z.string().optional(),
});

const threeYearPictureSchema = z.object({
  futureDate: z.string().optional(),
  revenue: z.string().optional(),
  profit: z.string().optional(),
  measurables: z.array(z.string()).optional(),
  lookLikeStatements: z.array(z.string()).optional(),
});

const oneYearPlanSchema = z.object({
  futureDate: z.string().optional(),
  revenue: z.string().optional(),
  profit: z.string().optional(),
  measurables: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  companyRockIds: z.array(z.string()).optional(),
});

const updateVTOSchema = z.object({
  coreValues: z.array(z.string()).optional(),
  coreFocusPurpose: z.string().nullable().optional(),
  coreFocusNiche: z.string().nullable().optional(),
  tenYearTarget: z.string().nullable().optional(),
  marketingStrategy: marketingStrategySchema.optional(),
  threeYearPicture: threeYearPictureSchema.optional(),
  oneYearPlan: oneYearPlanSchema.optional(),
});

export default async function vtoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const repo = new VTORepository(request.tenantId as string);
    return repo.findOrCreate();
  });

  app.put('/', { preHandler: requireTenant(app) }, async (request) => {
    const body = updateVTOSchema.parse(request.body);
    const repo = new VTORepository(request.tenantId as string);
    return repo.update(body, request.user.userId);
  });
}
