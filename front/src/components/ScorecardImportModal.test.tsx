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

const members = [
  { userId: 'u1', fullName: 'Ana', email: 'ana@tasvalor.com', avatarUrl: null, role: 'owner' as const },
  { userId: 'u2', fullName: 'Luis', email: 'luis@tasvalor.com', avatarUrl: null, role: 'member' as const },
];

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
    vi.mocked(scorecardApi.importEntries).mockResolvedValue({ upserted: 1, skipped: [] });
    const onImported = vi.fn();
    const onClose = vi.fn();
    render(<ScorecardImportModal open mode="entries" metrics={[metric]} onClose={onClose} onImported={onImported} />);

    const importButton = screen.getByRole('button', { name: /importar$/i });
    expect(importButton).toBeDisabled();

    await uploadFile(csvFile('codigo;periodo;valor\nVENTAS;2026-09-21;5'));
    expect(await screen.findByText('valores.csv')).toBeInTheDocument();
    await userEvent.click(importButton);

    await waitFor(() => expect(scorecardApi.importEntries).toHaveBeenCalledWith('codigo;periodo;valor\nVENTAS;2026-09-21;5'));
    expect(onImported).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open listing skipped unknown codes (with rows) after a partial import', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.importEntries).mockResolvedValue({
      upserted: 3,
      skipped: [
        { code: 'ERP_OTRO', rows: [4, 7] },
        { code: 'NO_SEGUIDA', rows: [9] },
      ],
    });
    const onImported = vi.fn();
    const onClose = vi.fn();
    render(<ScorecardImportModal open mode="entries" metrics={[metric]} onClose={onClose} onImported={onImported} />);

    await uploadFile(csvFile('codigo;periodo;valor'));
    await userEvent.click(screen.getByRole('button', { name: /importar$/i }));

    expect(await screen.findByText(/3 valores importados\. se han ignorado 2 códigos desconocidos/i)).toBeInTheDocument();
    expect(screen.getByText('ERP_OTRO')).toBeInTheDocument();
    expect(screen.getByText('filas 4, 7')).toBeInTheDocument();
    expect(screen.getByText('fila 9')).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not refresh the grid when every row was skipped', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.importEntries).mockResolvedValue({ upserted: 0, skipped: [{ code: 'X', rows: [2] }] });
    const onImported = vi.fn();
    render(<ScorecardImportModal open mode="entries" metrics={[metric]} onClose={vi.fn()} onImported={onImported} />);

    await uploadFile(csvFile('codigo;periodo;valor'));
    await userEvent.click(screen.getByRole('button', { name: /importar$/i }));

    expect(await screen.findByText(/no se ha importado ningún valor/i)).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
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
    render(
      <ScorecardImportModal
        open
        mode="metrics"
        metrics={[]}
        members={members}
        defaultOwnerUserId="u1"
        onClose={vi.fn()}
        onImported={onImported}
      />
    );

    await uploadFile(csvFile('codigo;nombre'));
    await userEvent.click(screen.getByRole('button', { name: /importar$/i }));

    expect(await screen.findByText(/no se ha importado nada: 1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/no es miembro activo/)).toBeInTheDocument();
    expect(screen.getByText('Responsable')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('asks for the owner in metrics mode: pre-selects the current user and sends the chosen one', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.importMetrics).mockResolvedValue({ created: 2 });
    render(
      <ScorecardImportModal
        open
        mode="metrics"
        metrics={[]}
        members={members}
        defaultOwnerUserId="u1"
        onClose={vi.fn()}
        onImported={vi.fn()}
      />
    );

    expect(screen.getByText(/a qué responsable se asignan/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: /responsable de las métricas/i }));
    await userEvent.click(await screen.findByText('Luis'));
    await uploadFile(csvFile('codigo;nombre;objetivo;comparacion;frecuencia\nA;B;1;>=;semanal'));
    await userEvent.click(screen.getByRole('button', { name: /importar$/i }));

    await waitFor(() => expect(scorecardApi.importMetrics).toHaveBeenCalledWith(expect.any(String), 'u2'));
  });

  it('keeps Importar disabled in metrics mode until an owner is chosen', async () => {
    render(
      <ScorecardImportModal open mode="metrics" metrics={[]} members={members} onClose={vi.fn()} onImported={vi.fn()} />
    );

    await uploadFile(csvFile('codigo;nombre'));
    expect(screen.getByRole('button', { name: /importar$/i })).toBeDisabled();
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
