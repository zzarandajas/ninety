import type { VTODocument } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface MarketingStrategyJson {
  targetMarket?: string;
  threeUniques?: string[];
  provenProcess?: string;
  guarantee?: string;
}

export interface ThreeYearPictureJson {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  lookLikeStatements?: string[];
}

export interface OneYearPlanJson {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  goals?: string[];
  companyRockIds?: string[];
}

export interface UpsertVTOInput {
  coreValues?: string[];
  coreFocusPurpose?: string | null;
  coreFocusNiche?: string | null;
  tenYearTarget?: string | null;
  marketingStrategy?: MarketingStrategyJson;
  threeYearPicture?: ThreeYearPictureJson;
  oneYearPlan?: OneYearPlanJson;
}

export class VTORepository {
  constructor(private tenantId: string) {}

  findOrCreate(): Promise<VTODocument> {
    return prisma.vTODocument.upsert({
      where: { tenantId: this.tenantId },
      update: {},
      create: {
        tenantId: this.tenantId,
        coreValues: [],
        marketingStrategy: {},
        threeYearPicture: {},
        oneYearPlan: {},
      },
    });
  }

  update(data: UpsertVTOInput, updatedByUserId: string): Promise<VTODocument> {
    return prisma.vTODocument.upsert({
      where: { tenantId: this.tenantId },
      update: { ...data, updatedByUserId },
      create: { tenantId: this.tenantId, ...data, updatedByUserId },
    });
  }
}
