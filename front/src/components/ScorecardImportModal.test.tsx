import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/apiClient';
import type { ScorecardMetric } from '../lib/scorecardApi';
import { ScorecardImportModal } from './ScorecardImportModal';

vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return { ...actual, scorecardApi: { importMetrics: vi.fn(), importEntries: vi.fn() } };
});

vi.mock('../lib/scorecardCsv', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardCsv')>('../lib/scorecardCsv');
  return { ...actual, downloadCsv: vi.fn() };
});

const metric: ScorecardMetric = {
  id: 'm1',
  tenantId: 't1',
  code: 'VENTAS',
  name: 'Ventas',
  description: null,
  ownerUserId: 'u1',
  goalValue: 10,
  comparison: 'gte',
  frequency: 'weekly',
  unit: '€',
  isActive: true,
};

function csvFile(content: string) {
  return new File([content], 'valores.csv', { type: 'text/csv' });
}

async function uploadFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, file);
}

describe('ScorecardImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the entries template pre-filled with metric codes', async () => {
    const { downloadCsv } = await import('../lib/scorecardCsv');
    render(<ScorecardImportModal open mode="entries" metrics={[metric]} onClose={vi.fn()} onImported={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /descargar plantilla/i }));

    expect(downloadCsv).toHaveBeenCalledWith('plantilla-valores-scorecard.csv', expect.stringContaining('VENTAS;'));
  });

  it('keeps Importar disabled until a file is chosen, then sends its text and calls onImported', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.importEntries).mockResolvedValue({ upserted: 1 });
    const onImported = vi.fn();
    render(<ScorecardImportModal open mode="entries" metrics={[metric]} onClose={vi.fn()} onImported={onImported} />);

    const importButton = screen.getByRole('button', { name: /importar$/i });
    expect(importButton).toBeDisabled();

    await uploadFile(csvFile('codigo;periodo;valor\nVENTAS;2026-09-21;5'));
    expect(await screen.findByText('valores.csv')).toBeInTheDocument();
    await userEvent.click(importButton);

    await waitFor(() => expect(scorecardApi.importEntries).toHaveBeenCalledWith('codigo;periodo;valor\nVENTAS;2026-09-21;5'));
    expect(onImported).toHaveBeenCalled();
  });

  it('shows per-row errors returned by the server and does not call onImported', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.importMetrics).mockRejectedValue(
      new ApiError(400, 'El fichero tiene errores', {
        error: 'El fichero tiene errores',
        errors: [{ row: 3, field: 'responsable_email', message: '"x@y.com" no es miembro activo de esta organización' }],
      })
    );
    const onImported = vi.fn();
    render(<ScorecardImportModal open mode="metrics" metrics={[]} onClose={vi.fn()} onImported={onImported} />);

    await uploadFile(csvFile('codigo;nombre'));
    await userEvent.click(screen.getByRole('button', { name: /importar$/i }));

    expect(await screen.findByText(/no se ha importado nada: 1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/no es miembro activo/)).toBeInTheDocument();
    expect(screen.getByText('Responsable')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('warns how many active metrics have no code in entries mode', () => {
    render(
      <ScorecardImportModal
        open
        mode="entries"
        metrics={[metric, { ...metric, id: 'm2', code: null }]}
        onClose={vi.fn()}
        onImported={vi.fn()}
      />
    );

    expect(screen.getByText('1 métrica activa no tiene código')).toBeInTheDocument();
  });
});
