import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { TenantSwitcher } from './TenantSwitcher';

const baseUser = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'A',
  mustChangePassword: false,
  avatarUrl: null,
};

describe('TenantSwitcher', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('renders nothing when the user belongs to a single tenant', () => {
    useAuthStore.getState().login({
      token: 't',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });

    const { container } = render(<TenantSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a dropdown with both tenant names when the user belongs to 2+ tenants', () => {
    useAuthStore.getState().login({
      token: 't',
      user: baseUser,
      memberships: [
        { tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
        { tenantId: 't2', tenantName: 'Cionet', tenantSlug: 'cionet', role: 'owner' },
      ],
    });

    render(<TenantSwitcher />);
    expect(screen.getByText('Tasvalor')).toBeInTheDocument();
  });
});
