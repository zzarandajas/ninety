import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  passwordHash: 'hashed',
  mustChangePassword: false,
  avatarUrl: null,
  createdAt: new Date(),
};

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function multipartPayload(filename: string, mimetype: string, content: string) {
  const boundary = '----plantestboundary';
  return {
    boundary,
    body:
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="avatar"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--\r\n`,
  };
}

// Builds a valid multipart/form-data body with a single plain field (no `filename=`,
// no file Content-Type) — busboy treats this as a field part, not a file part, so
// `request.file()` finds zero file-type parts and resolves to `undefined`.
function multipartNoFilePayload(fieldName: string, value: string) {
  const boundary = '----plantestboundary';
  return {
    boundary,
    body:
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"\r\n\r\n` +
      `${value}\r\n` +
      `--${boundary}--\r\n`,
  };
}

describe('avatar upload', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never);
  });

  it('requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url: '/auth/me/avatar' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a user with mustChangePassword with 403 and writes nothing', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const fsPromises = await import('node:fs/promises');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartPayload('avatar.png', 'image/png', 'fake-png-bytes');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(403);
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects an unsupported mimetype with 400', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartPayload('avatar.gif', 'image/gif', 'fake-bytes');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a request with no file part with 400', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartNoFilePayload('note', 'not-a-file');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a file exceeding the 2MB size limit with 413', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const oversizedContent = 'a'.repeat(3 * 1024 * 1024);
    const { boundary, body } = multipartPayload('avatar.png', 'image/png', oversizedContent);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(413);
    await app.close();
  });

  it('stores a PNG file and updates the user avatarUrl', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const fsPromises = await import('node:fs/promises');
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartPayload('avatar.png', 'image/png', 'fake-png-bytes');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ avatarUrl: '/uploads/avatars/user-1.png' });
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('user-1.png'),
      expect.any(Buffer)
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: '/uploads/avatars/user-1.png' },
    });
    await app.close();
  });
});
