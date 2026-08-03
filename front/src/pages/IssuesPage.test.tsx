import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { IssuesPage } from './IssuesPage';

vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return {
    ...actual,
    issuesApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    },
  };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const issues = [
  {
    id: 'issue-1',
    tenantId: 'tenant-1',
    title: 'Onboarding lento',
    description: null,
    raisedByUserId: 'user-1',
    status: 'open' as const,
    priority: 'high' as const,
    sortOrder: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    resolvedAt: null,
    resolutionNotes: null,
  },
  {
    id: 'issue-2',
    tenantId: 'tenant-1',
    title: 'Falta doc de API',
    description: null,
    raisedByUserId: 'user-1',
    status: 'discussing' as const,
    priority: 'medium' as const,
    sortOrder: 1,
    createdAt: '2026-07-02T00:00:00.000Z',
    resolvedAt: null,
    resolutionNotes: null,
  },
];

describe('IssuesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { issuesApi } = await import('../lib/issuesApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(issuesApi.list).mockResolvedValue(issues as never);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'owner' as const },
    ]);
  });

  it('lists issues ordered by sortOrder', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    const rows = screen.getAllByRole('row').slice(1); // descarta la fila de cabecera
    expect(rows[0]).toHaveTextContent('Onboarding lento');
    expect(rows[1]).toHaveTextContent('Falta doc de API');
    expect(rows[0]).toHaveTextContent('Pablo'); // owner con nombre (y avatar) en la columna Owner
  });

  it('filters by status', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(1));

    // antd 5.x puts aria-label on both the outer .ant-select wrapper and the
    // inner search input, so getByLabelText matches two elements (see the same
    // workaround documented in RocksBoard.test.tsx). role="combobox" is unique
    // to the input, so target it via getByRole instead. Likewise, "Discussing"
    // also appears in the table's status <Tag> for issue-2, so scope the click
    // to the dropdown option node instead of a plain text query.
    await userEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    const dropdownOption = await waitFor(() => {
      const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'));
      const match = options.find((el) => el.textContent === 'Discussing');
      if (!match) throw new Error('dropdown option not rendered yet');
      return match;
    });
    await userEvent.click(dropdownOption);

    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledWith({ status: 'discussing' }));
  });

  it('opens the modal in edit mode when a title is clicked', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Onboarding lento'));

    expect(await screen.findByText('Editar Issue (IDS)')).toBeInTheDocument();
  });

  it('opens the modal in create mode when "Nuevo issue" is clicked', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /nuevo issue/i }));

    expect(await screen.findByText('Nuevo Issue (IDS)')).toBeInTheDocument();
  });

  it('refetches the list when the modal reports a save', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('Onboarding lento'));
    expect(await screen.findByText('Editar Issue (IDS)')).toBeInTheDocument();

    vi.mocked(issuesApi.update).mockResolvedValue(issues[0] as never);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(2));
  });

  it('hides the drag-to-reorder column when a status filter is active', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    expect(screen.getAllByLabelText('Arrastrar para reordenar')).toHaveLength(2);

    // antd 5.x puts aria-label on both the outer .ant-select wrapper and the
    // inner search input, so getByLabelText matches two elements (see the same
    // workaround documented in RocksBoard.test.tsx and in the "filters by
    // status" test above). role="combobox" is unique to the input, so target
    // it via getByRole instead. Likewise, "Discussing" also appears in the
    // table's status <Tag> for issue-2, so scope the click to the dropdown
    // option node instead of a plain text query.
    await userEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    const dropdownOption = await waitFor(() => {
      const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'));
      const match = options.find((el) => el.textContent === 'Discussing');
      if (!match) throw new Error('dropdown option not rendered yet');
      return match;
    });
    await userEvent.click(dropdownOption);

    await waitFor(() => expect(screen.queryAllByLabelText('Arrastrar para reordenar')).toHaveLength(0));
  });

  it('does not mark the empty-state placeholder row as draggable', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.list).mockResolvedValue([] as never);

    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(1));
    const placeholderRow = document.querySelector('.ant-table-placeholder');
    expect(placeholderRow).not.toBeNull();
    expect(placeholderRow).not.toHaveAttribute('aria-roledescription', 'sortable');
  });

  it('mounts the drag context without crashing', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    // La simulación real de puntero de @dnd-kit no es fiable bajo jsdom — la lógica de
    // reordenación en sí ya está cubierta al 100% por front/src/lib/reorder.test.ts (Task 3,
    // ya revisado y aprobado). Este test solo confirma que el DndContext/SortableContext/fila
    // arrastrable renderizan sin lanzar, que es el único riesgo real de integración que este
    // componente añade.
    expect(screen.getAllByLabelText('Arrastrar para reordenar')).toHaveLength(2);
  });
});
