import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreeYearPictureForm } from './ThreeYearPictureForm';

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
  threeYearPicture: { futureDate: '31/12/2029', revenue: '3M', profit: '600K', measurables: ['20 empleados'], lookLikeStatements: ['Oficina propia'] },
  oneYearPlan: {},
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

describe('ThreeYearPictureForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the existing revenue target', () => {
    render(<ThreeYearPictureForm document={baseDoc} onSaved={vi.fn()} />);
    expect(screen.getByDisplayValue('3M')).toBeInTheDocument();
  });

  it('saves the threeYearPicture object on submit', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    const onSaved = vi.fn();
    vi.mocked(vtoApi.update).mockResolvedValue(baseDoc);

    render(<ThreeYearPictureForm document={baseDoc} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(vtoApi.update).toHaveBeenCalledWith({
      threeYearPicture: {
        futureDate: '31/12/2029',
        revenue: '3M',
        profit: '600K',
        measurables: ['20 empleados'],
        lookLikeStatements: ['Oficina propia'],
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    vi.mocked(vtoApi.update).mockRejectedValue(new Error('Request failed'));

    render(<ThreeYearPictureForm document={baseDoc} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
