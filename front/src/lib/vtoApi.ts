import { apiFetch } from './apiClient';

export interface MarketingStrategy {
  targetMarket?: string;
  threeUniques?: string[];
  provenProcess?: string;
  guarantee?: string;
}

export interface ThreeYearPicture {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  lookLikeStatements?: string[];
}

export interface OneYearPlan {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  goals?: string[];
  companyRockIds?: string[];
}

export interface VTODocument {
  id: string;
  tenantId: string;
  coreValues: string[];
  coreFocusPurpose: string | null;
  coreFocusNiche: string | null;
  tenYearTarget: string | null;
  marketingStrategy: MarketingStrategy;
  threeYearPicture: ThreeYearPicture;
  oneYearPlan: OneYearPlan;
  updatedAt: string;
  updatedByUserId: string | null;
}

export type UpdateVTOPayload = Partial<{
  coreValues: string[];
  coreFocusPurpose: string | null;
  coreFocusNiche: string | null;
  tenYearTarget: string | null;
  marketingStrategy: MarketingStrategy;
  threeYearPicture: ThreeYearPicture;
  oneYearPlan: OneYearPlan;
}>;

export const vtoApi = {
  get: () => apiFetch<VTODocument>('/vto'),

  update: (payload: UpdateVTOPayload) =>
    apiFetch<VTODocument>('/vto', { method: 'PUT', body: JSON.stringify(payload) }),
};
