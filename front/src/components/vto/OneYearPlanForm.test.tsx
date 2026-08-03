import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OneYearPlanForm } from './OneYearPlanForm';

vi.mock('../../lib/vtoApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/vtoApi')>('../../lib/vtoApi');
  return { ...actual, vtoApi: { update: vi.fn() } };
});

const baseDoc = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: [],
  coreFocusPurpose: null,
  coreFocusNiche: null,
  tenYearTarget: null,
  marketingStrategy: {},
  threeYearPicture: {},
  oneYearPlan: { futureDate: '31/12/2026', revenue: '1.2M', profit: '200K', measurables: ['8 empleados'], goals: ['Lanzar V/TO'], companyRockIds: ['rock-1'] },
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

const companyRocks = [
  { id: 'rock-1', title: 'Lanzar módulo de Scorecard', quarter: '2026-Q3', isCompanyRock: true } as never,
  { id: 'rock-2', title: 'Cerrar ronda de inversión', quarter: '2026-Q3', isCompanyRock: true } as never,
];

describe('OneYearPlanForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the linked company rock as a selected option', () => {
    render(<OneYearPlanForm document={baseDoc} companyRocks={companyRocks} onSaved={vi.fn()} />);
    expect(screen.getByText('Lanzar módulo de Scorecard (2026-Q3)')).toBeInTheDocument();
  });

  it('saves the oneYearPlan object, including the selected rock ids, on submit', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    const onSaved = vi.fn();
    vi.mocked(vtoApi.update).mockResolvedValue(baseDoc);

    render(<OneYearPlanForm document={baseDoc} companyRocks={companyRocks} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(vtoApi.update).toHaveBeenCalledWith({
      oneYearPlan: {
        futureDate: '31/12/2026',
        revenue: '1.2M',
        profit: '200K',
        measurables: ['8 empleados'],
        goals: ['Lanzar V/TO'],
        companyRockIds: ['rock-1'],
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    vi.mocked(vtoApi.update).mockRejectedValue(new Error('Request failed'));

    render(<OneYearPlanForm document={baseDoc} companyRocks={companyRocks} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
