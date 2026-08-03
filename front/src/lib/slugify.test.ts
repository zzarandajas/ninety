import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('converts plain string to lowercase with hyphens', () => {
    expect(slugify('Tas Valor')).toBe('tas-valor');
  });

  it('removes accents and special characters', () => {
    expect(slugify('Organización & Compañía S.A.')).toBe('organizacion-compania-sa');
  });

  it('handles multiple spaces and hyphens cleanly', () => {
    expect(slugify('  Cionet --- Spain   ')).toBe('cionet-spain');
  });
});
