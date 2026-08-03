import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingStrategyForm } from './MarketingStrategyForm';

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
  marketingStrategy: { targetMarket: 'Pymes de 20-200 empleados', threeUniques: ['Rapidez'], provenProcess: '', guarantee: '' },
  threeYearPicture: {},
  oneYearPlan: {},
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

describe('MarketingStrategyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the existing target market', () => {
    render(<MarketingStrategyForm document={baseDoc} onSaved={vi.fn()} />);
    expect(screen.getByDisplayValue('Pymes de 20-200 empleados')).toBeInTheDocument();
  });

  it('saves the marketingStrategy object on submit', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    const onSaved = vi.fn();
    vi.mocked(vtoApi.update).mockResolvedValue(baseDoc);

    render(<MarketingStrategyForm document={baseDoc} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(vtoApi.update).toHaveBeenCalledWith({
      marketingStrategy: {
        targetMarket: 'Pymes de 20-200 empleados',
        threeUniques: ['Rapidez'],
        provenProcess: '',
        guarantee: '',
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    vi.mocked(vtoApi.update).mockRejectedValue(new Error('Request failed'));

    render(<MarketingStrategyForm document={baseDoc} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
