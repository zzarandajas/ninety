import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { impersonateApi, type ImpersonatableUser } from '../lib/impersonateApi';
import { useAuthStore } from '../store/authStore';
import { GodModeSelector } from './GodModeSelector';

vi.mock('../lib/impersonateApi', () => ({
  impersonateApi: {
    listUsers: vi.fn(),
    impersonate: vi.fn(),
  },
}));

const users: ImpersonatableUser[] = [
  {
    id: 'user-2',
    fullName: 'Ana Sales',
    email: 'ana@tasvalor.com',
    avatarUrl: null,
    memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', role: 'member' }],
  },
  {
    id: 'user-3',
    fullName: 'Luis Owner',
    email: 'luis@tasvalor.com',
    avatarUrl: null,
    memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', role: 'owner' }],
  },
];

describe('GodModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      token: 'owner-token',
      user: {
        id: 'user-1',
        email: 'pablo@tasvalor.com',
        fullName: 'Pablo',
        mustChangePassword: false,
        avatarUrl: null,
      },
      memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
  });

  it('lists users and impersonates the selected one', async () => {
    vi.mocked(impersonateApi.listUsers).mockResolvedValue(users);
    vi.mocked(impersonateApi.impersonate).mockResolvedValue({
      token: 'imp-token',
      user: {
        id: 'user-2',
        email: 'ana@tasvalor.com',
        fullName: 'Ana Sales',
        mustChangePassword: false,
        avatarUrl: null,
      },
      memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'member' }],
    });

    render(<GodModeSelector />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByText('Ana Sales'));

    await waitFor(() => expect(impersonateApi.impersonate).toHaveBeenCalledWith('user-2'));
    await waitFor(() => expect(useAuthStore.getState().token).toBe('imp-token'));
    expect(useAuthStore.getState().user?.fullName).toBe('Ana Sales');
  });

  it('renders nothing when the user list fails to load', async () => {
    vi.mocked(impersonateApi.listUsers).mockRejectedValue(new Error('boom'));

    const { container } = render(<GodModeSelector />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
