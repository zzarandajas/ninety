import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreFocusForm } from './CoreFocusForm';

vi.mock('../../lib/vtoApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/vtoApi')>('../../lib/vtoApi');
  return { ...actual, vtoApi: { update: vi.fn() } };
});

const baseDoc = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: [],
  coreFocusPurpose: 'Ayudar a pymes a ejecutar',
  coreFocusNiche: 'Consultoría EOS',
  tenYearTarget: 'Ser referentes en 2036',
  marketingStrategy: {},
  threeYearPicture: {},
  oneYearPlan: {},
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

describe('CoreFocusForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the existing values', () => {
    render(<CoreFocusForm document={baseDoc} onSaved={vi.fn()} />);
    expect(screen.getByDisplayValue('Ayudar a pymes a ejecutar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Consultoría EOS')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ser referentes en 2036')).toBeInTheDocument();
  });

  it('saves the three fields on submit', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    const onSaved = vi.fn();
    vi.mocked(vtoApi.update).mockResolvedValue({ ...baseDoc, coreFocusNiche: 'Consultoría EOS para pymes' });

    render(<CoreFocusForm document={baseDoc} onSaved={onSaved} />);
    const nicheInput = screen.getByDisplayValue('Consultoría EOS');
    await userEvent.clear(nicheInput);
    await userEvent.type(nicheInput, 'Consultoría EOS para pymes');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(vtoApi.update).toHaveBeenCalledWith({
      coreFocusPurpose: 'Ayudar a pymes a ejecutar',
      coreFocusNiche: 'Consultoría EOS para pymes',
      tenYearTarget: 'Ser referentes en 2036',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    vi.mocked(vtoApi.update).mockRejectedValue(new Error('Request failed'));

    render(<CoreFocusForm document={baseDoc} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
