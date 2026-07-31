import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreValuesForm } from './CoreValuesForm';

vi.mock('../../lib/vtoApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/vtoApi')>('../../lib/vtoApi');
  return { ...actual, vtoApi: { update: vi.fn() } };
});

const baseDoc = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: ['Honestidad'],
  coreFocusPurpose: null,
  coreFocusNiche: null,
  tenYearTarget: null,
  marketingStrategy: {},
  threeYearPicture: {},
  oneYearPlan: {},
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

describe('CoreValuesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the existing core values as tags', () => {
    render(<CoreValuesForm document={baseDoc} onSaved={vi.fn()} />);
    expect(screen.getByText('Honestidad')).toBeInTheDocument();
  });

  it('saves the updated list of values on submit', async () => {
    const { vtoApi } = await import('../../lib/vtoApi');
    const onSaved = vi.fn();
    vi.mocked(vtoApi.update).mockResolvedValue({ ...baseDoc, coreValues: ['Honestidad', 'Excelencia'] });

    render(<CoreValuesForm document={baseDoc} onSaved={onSaved} />);
    await userEvent.type(screen.getByRole('combobox'), 'Excelencia{enter}');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(vtoApi.update).toHaveBeenCalledWith({ coreValues: ['Honestidad', 'Excelencia'] });
    expect(onSaved).toHaveBeenCalledWith({ ...baseDoc, coreValues: ['Honestidad', 'Excelencia'] });
  });
});
