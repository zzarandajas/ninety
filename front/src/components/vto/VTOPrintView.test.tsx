import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VTOPrintView } from './VTOPrintView';

const document = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: ['Honestidad', 'Excelencia'],
  coreFocusPurpose: 'Ayudar a pymes a ejecutar',
  coreFocusNiche: 'Consultoría EOS',
  tenYearTarget: 'Ser referentes en 2036',
  marketingStrategy: { targetMarket: 'Pymes', threeUniques: ['Rapidez'], provenProcess: 'Proceso X', guarantee: 'Garantía Y' },
  threeYearPicture: { futureDate: '31/12/2029', revenue: '3M', profit: '600K', measurables: ['20 empleados'], lookLikeStatements: ['Oficina propia'] },
  oneYearPlan: { futureDate: '31/12/2026', revenue: '1.2M', profit: '200K', measurables: ['8 empleados'], goals: ['Lanzar V/TO'], companyRockIds: ['rock-1'] },
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

const companyRocks = [
  { id: 'rock-1', title: 'Lanzar módulo de Scorecard', quarter: '2026-Q3', isCompanyRock: true } as never,
  { id: 'rock-2', title: 'No vinculado', quarter: '2026-Q3', isCompanyRock: true } as never,
];

describe('VTOPrintView', () => {
  it('renders every section read-only, without form controls', () => {
    render(<VTOPrintView document={document} companyRocks={companyRocks} />);

    expect(screen.getByText('Honestidad')).toBeInTheDocument();
    expect(screen.getByText('Ayudar a pymes a ejecutar')).toBeInTheDocument();
    expect(screen.getByText('Ser referentes en 2036')).toBeInTheDocument();
    expect(screen.getByText('Rapidez')).toBeInTheDocument();
    expect(screen.getByText(/3M/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('resolves only the linked company rocks by id, ignoring the rest', () => {
    render(<VTOPrintView document={document} companyRocks={companyRocks} />);

    expect(screen.getByText(/Lanzar módulo de Scorecard/)).toBeInTheDocument();
    expect(screen.queryByText(/No vinculado/)).not.toBeInTheDocument();
  });
});
