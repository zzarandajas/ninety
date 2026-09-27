import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from './csv.js';

describe('detectDelimiter', () => {
  it('prefers ; (Excel ES) and falls back to , when the header uses commas', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('solo')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('parses ; separated rows, trims cells and strips the UTF-8 BOM', () => {
    const rows = parseCsv('﻿codigo; valor \nVENTAS;1,5\n');
    expect(rows).toEqual([
      { line: 1, cells: ['codigo', 'valor'] },
      { line: 2, cells: ['VENTAS', '1,5'] },
    ]);
  });

  it('keeps a decimal comma inside quotes when the delimiter is ,', () => {
    const rows = parseCsv('codigo,valor\r\nVENTAS,"1,5"\r\n');
    expect(rows[1].cells).toEqual(['VENTAS', '1,5']);
  });

  it('handles escaped quotes and newlines inside quoted fields, tracking the start line', () => {
    const rows = parseCsv('a;b\n"x ""y""";"linea1\nlinea2"\nz;w');
    expect(rows[1]).toEqual({ line: 2, cells: ['x "y"', 'linea1\nlinea2'] });
    expect(rows[2]).toEqual({ line: 4, cells: ['z', 'w'] });
  });

  it('drops blank lines (including ;;; rows) but keeps line numbers of the rest', () => {
    const rows = parseCsv('a;b\n\n;;\n1;2');
    expect(rows).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 4, cells: ['1', '2'] },
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
