import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantBrandingForm } from './TenantBrandingForm';

vi.mock('../lib/tenantApi', () => ({
  tenantApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    uploadLogo: vi.fn(),
    uploadIsotype: vi.fn(),
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      activeTenantId: 'tenant-1',
      updateActiveTenantBranding: vi.fn(),
    })
  ),
}));

const mockSettings = {
  id: 'tenant-1',
  name: 'Tasvalor',
  slug: 'tasvalor',
  timezone: 'Europe/Madrid',
  fiscalYearStartMonth: 1,
  logoUrl: '/uploads/tenants/tenant-1-logo.png',
  isotypeUrl: null,
  bgColor: '#eef7f2',
  accentColor: '#16983c',
};

describe('TenantBrandingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tenant settings and updates colors and name', async () => {
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(tenantApi.getSettings).mockResolvedValue(mockSettings);
    vi.mocked(tenantApi.updateSettings).mockResolvedValue({
      ...mockSettings,
      name: 'Tasvalor New',
      bgColor: '#ffffff',
      accentColor: '#1890ff',
    });

    render(<TenantBrandingForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tasvalor')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Tasvalor');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Tasvalor New');

    const saveButton = screen.getByRole('button', { name: /guardar configuración/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(tenantApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tasvalor New',
        })
      );
    });
  });
});
