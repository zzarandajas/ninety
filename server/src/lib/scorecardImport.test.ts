import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_ROWS,
  parseComparison,
  parseDecimal,
  parseFrequency,
  parsePeriod,
  validateEntryImport,
  validateMetricImport,
  type MetricImportContext,
} from './scorecardImport.js';

describe('parseDecimal', () => {
  it.each([
    ['10', 10],
    ['-3', -3],
    ['1234.5', 1234.5],
    ['1234,5', 1234.5],
    ['1.234,5', 1234.5],
    [' 1 234,5 ', 1234.5],
  ])('parses %j as %d', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected);
  });

  it.each(['', 'abc', '1,2,3', '1.2.3', '10€'])('rejects %j', (raw) => {
    expect(parseDecimal(raw)).toBeNull();
  });
});

describe('parseComparison / parseFrequency', () => {
  it('accepts symbols, English keys and Spanish words', () => {
    expect(parseComparison('>=')).toBe('gte');
    expect(parseComparison('≤')).toBe('lte');
    expect(parseComparison('EQ')).toBe('eq');
    expect(parseComparison('>')).toBeNull();
    expect(parseFrequency('Semanal')).toBe('weekly');
    expect(parseFrequency('monthly')).toBe('monthly');
    expect(parseFrequency('diaria')).toBeNull();
  });
});

describe('parsePeriod', () => {
  it('normalizes any day of a week to that Monday (UTC) for weekly metrics', () => {
    // 2026-09-27 is a Sunday → Monday 2026-09-21
    expect(parsePeriod('2026-09-27', 'weekly')?.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(parsePeriod('23/09/2026', 'weekly')?.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(parsePeriod('2026-09-21', 'weekly')?.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('rejects month-only periods and impossible dates for weekly metrics', () => {
    expect(parsePeriod('2026-09', 'weekly')).toBeNull();
    expect(parsePeriod('2026-02-30', 'weekly')).toBeNull();
    expect(parsePeriod('semana 39', 'weekly')).toBeNull();
  });

  it('normalizes monthly periods to day 1', () => {
    expect(parsePeriod('2026-09', 'monthly')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parsePeriod('9/2026', 'monthly')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parsePeriod('2026-09-17', 'monthly')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parsePeriod('2026-13', 'monthly')).toBeNull();
  });
});

const HEADER = 'codigo;nombre;descripcion;responsable_email;objetivo;comparacion;frecuencia;unidad';

function metricCtx(overrides: Partial<MetricImportContext> = {}): MetricImportContext {
  return {
    memberIdByEmail: new Map([['ana@tasvalor.com', 'user-ana']]),
    existingCodes: new Set(['YA_EXISTE']),
    ...overrides,
  };
}

describe('validateMetricImport', () => {
  it('returns typed rows for a valid file (lowercase code, accented header, default unit)', () => {
    const csv = [
      'Código;Nombre;Descripción;Responsable_Email;Objetivo;Comparación;Frecuencia;Unidad',
      'ventas_sem;Ventas semanales;Del ERP;ANA@tasvalor.com;10.000,5;>=;semanal;€',
      'CHURN;Bajas;;ana@tasvalor.com;3;<=;mensual;',
    ].join('\n');

    const result = validateMetricImport(csv, metricCtx());

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          code: 'VENTAS_SEM',
          name: 'Ventas semanales',
          description: 'Del ERP',
          ownerUserId: 'user-ana',
          goalValue: 10000.5,
          comparison: 'gte',
          frequency: 'weekly',
          unit: '€',
        },
        {
          code: 'CHURN',
          name: 'Bajas',
          ownerUserId: 'user-ana',
          goalValue: 3,
          comparison: 'lte',
          frequency: 'monthly',
          unit: '#',
        },
      ],
    });
  });

  it('collects every error with its file line instead of stopping at the first', () => {
    const csv = [
      HEADER,
      'YA_EXISTE;Nombre;;ana@tasvalor.com;1;>=;semanal;#',
      'NUEVA;;;intruso@cionet.com;diez;>;diaria;#',
      'DUP;A;;ana@tasvalor.com;1;=;semanal;#',
      'dup;B;;ana@tasvalor.com;1;=;semanal;#',
      'MAL CODIGO;C;;ana@tasvalor.com;1;=;semanal;#',
    ].join('\n');

    const result = validateMetricImport(csv, metricCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'codigo'],
      [3, 'nombre'],
      [3, 'responsable_email'],
      [3, 'objetivo'],
      [3, 'comparacion'],
      [3, 'frecuencia'],
      [5, 'codigo'],
      [6, 'codigo'],
    ]);
    expect(result.errors[6].message).toContain('fila 4');
  });

  it('rejects files with missing required columns', () => {
    const result = validateMetricImport('codigo;nombre\nA;B', metricCtx());
    expect(result).toEqual({
      ok: false,
      errors: [{ row: 1, message: expect.stringContaining('objetivo') }],
    });
    if (!result.ok) expect(result.errors[0].message).not.toContain('responsable_email');
  });

  it('assigns the default owner to rows without email; a filled email still wins for its row', () => {
    const csv = [
      'codigo;nombre;objetivo;comparacion;frecuencia',
      'A;Sin columna email;1;>=;semanal',
    ].join('\n');
    const withEmailColumn = [HEADER, 'B;Vacío;;;1;>=;semanal;#', 'C;Con email;;ana@tasvalor.com;1;>=;semanal;#'].join('\n');
    const ctx = metricCtx({ defaultOwnerUserId: 'user-default' });

    const noColumn = validateMetricImport(csv, ctx);
    const mixed = validateMetricImport(withEmailColumn, ctx);

    expect(noColumn.ok && noColumn.rows[0].ownerUserId).toBe('user-default');
    expect(mixed.ok && mixed.rows.map((row) => row.ownerUserId)).toEqual(['user-default', 'user-ana']);
  });

  it('reports rows without email when no default owner was chosen', () => {
    const result = validateMetricImport([HEADER, 'B;Vacío;;;1;>=;semanal;#'].join('\n'), metricCtx());
    expect(result).toEqual({
      ok: false,
      errors: [{ row: 2, field: 'responsable_email', message: expect.stringContaining('Sin responsable') }],
    });
  });

  it('rejects empty files and header-only files', () => {
    expect(validateMetricImport('', metricCtx())).toMatchObject({ ok: false, errors: [{ message: 'El fichero está vacío' }] });
    expect(validateMetricImport(HEADER, metricCtx())).toMatchObject({
      ok: false,
      errors: [{ message: 'El fichero no tiene filas de datos' }],
    });
  });

  it(`rejects more than ${MAX_IMPORT_ROWS} data rows`, () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `C${i};N;;ana@tasvalor.com;1;>=;semanal;#`);
    const result = validateMetricImport([HEADER, ...rows].join('\n'), metricCtx());
    expect(result).toMatchObject({ ok: false, errors: [{ row: 1, message: expect.stringContaining('Máximo') }] });
  });
});

describe('validateEntryImport', () => {
  const ctx = {
    metricsByCode: new Map([
      ['VENTAS', { id: 'metric-weekly', frequency: 'weekly' as const }],
      ['CHURN', { id: 'metric-monthly', frequency: 'monthly' as const }],
    ]),
  };

  it('maps codes to metric ids and normalizes periods per metric frequency', () => {
    const csv = 'codigo;periodo;valor\nventas;2026-09-24;1.500,25\nCHURN;2026-08;2';

    expect(validateEntryImport(csv, ctx)).toEqual({
      ok: true,
      rows: [
        { metricId: 'metric-weekly', periodStart: new Date('2026-09-21T00:00:00.000Z'), actualValue: 1500.25 },
        { metricId: 'metric-monthly', periodStart: new Date('2026-08-01T00:00:00.000Z'), actualValue: 2 },
      ],
    });
  });

  it('reports unknown codes, bad values, period/frequency mismatches and duplicates within the file', () => {
    const csv = [
      'codigo;periodo;valor',
      'OTRA;2026-09-21;1',
      'VENTAS;2026-09;x',
      'VENTAS;2026-09-21;1',
      'VENTAS;2026-09-23;2',
      ';2026-09-21;1',
    ].join('\n');

    const result = validateEntryImport(csv, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'codigo'],
      [3, 'valor'],
      [3, 'periodo'],
      [5, 'periodo'],
      [6, 'codigo'],
    ]);
    expect(result.errors[2].message).toContain('semanal');
    expect(result.errors[3].message).toContain('fila 4');
  });
});
