import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const createMock = vi.fn();
vi.mock('../repositories/TenantMembershipRepository.js', () => ({
  TenantMembershipRepository: vi.fn().mockImplementation(() => ({ create: createMock })),
}));

describe('inviteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new User with a temporary password when the email is unknown', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1',
      email: 'new@tasvalor.com',
      fullName: 'New Person',
    } as never);
    createMock.mockResolvedValue({ id: 'mem-1', role: 'member' });

    const { inviteUser } = await import('./inviteUser.js');
    const result = await inviteUser('tasvalor', { email: 'new@tasvalor.com', fullName: 'New Person', role: 'member' });

    expect(result.temporaryPassword).not.toBeNull();
    expect(result.temporaryPassword!.length).toBeGreaterThanOrEqual(10);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new@tasvalor.com', mustChangePassword: true }),
      })
    );
    expect(createMock).toHaveBeenCalledWith('user-1', 'member');
  });

  it('does not touch the password and reuses the User when the email already exists', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-existing',
      email: 'existing@tasvalor.com',
      fullName: 'Existing Person',
    } as never);
    createMock.mockResolvedValue({ id: 'mem-2', role: 'admin' });

    const { inviteUser } = await import('./inviteUser.js');
    const result = await inviteUser('tasvalor', {
      email: 'existing@tasvalor.com',
      fullName: 'Ignored, user already has a name',
      role: 'admin',
    });

    expect(result.temporaryPassword).toBeNull();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith('user-existing', 'admin');
  });
});
