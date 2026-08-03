import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VTOPage } from './VTOPage';
import { useAuthStore } from '../store/authStore';

vi.mock('../lib/vtoApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/vtoApi')>('../lib/vtoApi');
  return { ...actual, vtoApi: { get: vi.fn(), update: vi.fn() } };
});
vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn() } };
});

const document = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: ['Honestidad'],
  coreFocusPurpose: null,
  coreFocusNiche: null,
  tenYearTarget: null,
  marketingStrategy: {},
  threeYearPicture: {},
  oneYearPlan: { companyRockIds: [] },
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedByUserId: null,
};

const rocks = [
  { id: 'rock-1', title: 'Lanzar módulo de Scorecard', quarter: '2026-Q3', isCompanyRock: true, milestones: [] } as never,
  { id: 'rock-2', title: 'Rock individual', quarter: '2026-Q3', isCompanyRock: false, milestones: [] } as never,
];

describe('VTOPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { vtoApi } = await import('../lib/vtoApi');
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(vtoApi.get).mockResolvedValue(document);
    vi.mocked(rocksApi.list).mockResolvedValue(rocks);
  });

  it('loads the document and shows the Core Values tab by default', async () => {
    render(<VTOPage />);

    await waitFor(() => expect(screen.getByText('Honestidad')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Core Values' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Marketing Strategy' })).toBeInTheDocument();
  });

  it('only offers company rocks (isCompanyRock: true) in the 1-Year Plan tab', async () => {
    render(<VTOPage />);
    await waitFor(() => expect(screen.getByText('Honestidad')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: '1-Year Plan' }));
    const comboboxes = screen.getAllByRole('combobox');
    await userEvent.click(comboboxes[comboboxes.length - 1]);

    expect(await screen.findByText('Lanzar módulo de Scorecard (2026-Q3)')).toBeInTheDocument();
    expect(screen.queryByText(/Rock individual/)).not.toBeInTheDocument();
  });

  it('switches to the print view and shows the read-only render', async () => {
    render(<VTOPage />);
    await waitFor(() => expect(screen.getByText('Honestidad')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /imprimir/i }));

    expect(screen.getByRole('heading', { name: 'Core Values' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Core Values' })).not.toBeInTheDocument();
  });

  it('reloads the document when the active tenant changes', async () => {
    const { vtoApi } = await import('../lib/vtoApi');
    render(<VTOPage />);
    await waitFor(() => expect(screen.getByText('Honestidad')).toBeInTheDocument());
    expect(vtoApi.get).toHaveBeenCalledTimes(1);

    vi.mocked(vtoApi.get).mockResolvedValue({ ...document, coreValues: ['Valor de Cionet'] });
    act(() => {
      useAuthStore.setState({ activeTenantId: 'tenant-2' });
    });

    await waitFor(() => expect(vtoApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Valor de Cionet')).toBeInTheDocument());
    expect(screen.queryByText('Honestidad')).not.toBeInTheDocument();
  });

  it('does not discard unsaved edits in another tab when a different section is saved', async () => {
    const { vtoApi } = await import('../lib/vtoApi');
    vi.mocked(vtoApi.update).mockResolvedValue({ ...document, coreValues: ['Honestidad', 'Excelencia'] });

    render(<VTOPage />);
    await waitFor(() => expect(screen.getByText('Honestidad')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: 'Core Focus' }));
    await userEvent.type(screen.getByLabelText(/objetivo a 10 años/i), 'BORRADOR SIN GUARDAR');

    await userEvent.click(screen.getByRole('tab', { name: 'Core Values' }));
    await userEvent.type(screen.getByRole('combobox'), 'Excelencia{enter}');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(vtoApi.update).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('tab', { name: 'Core Focus' }));
    expect(screen.getByLabelText(/objetivo a 10 años/i)).toHaveValue('BORRADOR SIN GUARDAR');
  });
});
