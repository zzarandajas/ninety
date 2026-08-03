import { describe, expect, it } from 'vitest';
import { hashPassword, isStrongPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });
});

describe('isStrongPassword', () => {
  it('rejects passwords shorter than 10 characters', () => {
    expect(isStrongPassword('abc123')).toBe(false);
  });

  it('rejects passwords with no digit', () => {
    expect(isStrongPassword('onlylettershere')).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    expect(isStrongPassword('1234567890')).toBe(false);
  });

  it('accepts a password with 10+ chars, a letter, and a digit', () => {
    expect(isStrongPassword('Sup3rSecret')).toBe(true);
  });
});
