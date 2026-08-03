import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AvatarUploader } from './AvatarUploader';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: false,
  avatarUrl: null,
};

describe('AvatarUploader', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      token: 'jwt-token',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    vi.clearAllMocks();
  });

  it('uploads the selected file as multipart form data and updates the store avatarUrl', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ avatarUrl: '/uploads/avatars/user-1.png' });

    render(<AvatarUploader />);

    const file = new File(['fake-bytes'], 'avatar.png', { type: 'image/png' });
    const input = document.querySelector('input[name="avatar"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await vi.waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe('/uploads/avatars/user-1.png')
    );
    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/me/avatar',
      expect.objectContaining({ method: 'POST' })
    );
    const callArgs = vi.mocked(apiFetch).mock.calls[0][1];
    expect(callArgs?.body).toBeInstanceOf(FormData);
  });
});
