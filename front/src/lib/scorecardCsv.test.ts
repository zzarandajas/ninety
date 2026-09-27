import { describe, expect, it } from 'vitest';
import type { ScorecardMetric } from './scorecardApi';
import { buildEntriesTemplate, buildMetricsTemplate, toCsv } from './scorecardCsv';

function lines(csv: string): string[] {
  return csv.replace(/^﻿/, '').trimEnd().split('\r\n');
}

const baseMetric: ScorecardMetric = {
  id: 'm1',
  tenantId: 't1',
  code: 'VENTAS',
  name: 'Ventas',
  description: null,
  ownerUserId: 'u1',
  goalValue: 10,
  comparison: 'gte',
  frequency: 'weekly',
  unit: '€',
  isActive: true,
};

describe('toCsv', () => {
  it('starts with a UTF-8 BOM, uses ; and quotes cells containing separators or quotes', () => {
    const csv = toCsv([['a', 'b;c', 'd "e"']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines(csv)).toEqual(['a;"b;c";"d ""e"""']);
  });
});

describe('buildMetricsTemplate', () => {
  it('has the header the server expects and leaves responsable_email blank (owner is picked on upload)', () => {
    const rows = lines(buildMetricsTemplate());
    expect(rows[0]).toBe('codigo;nombre;descripcion;responsable_email;objetivo;comparacion;frecuencia;unidad');
    expect(rows).toHaveLength(3);
    expect(rows[1].split(';')[3]).toBe('');
  });
});

describe('buildEntriesTemplate', () => {
  // Thursday 2026-09-24 → Monday 2026-09-21
  const today = new Date('2026-09-24T10:00:00Z');

  it('pre-fills one row per active metric with code, using the current week or month', () => {
    const metrics: ScorecardMetric[] = [
      baseMetric,
      { ...baseMetric, id: 'm2', code: 'CHURN', frequency: 'monthly' },
      { ...baseMetric, id: 'm3', code: null },
      { ...baseMetric, id: 'm4', code: 'OLD', isActive: false },
    ];

    expect(lines(buildEntriesTemplate(metrics, today))).toEqual([
      'codigo;periodo;valor',
      'VENTAS;2026-09-21;',
      'CHURN;2026-09;',
    ]);
  });

  it('falls back to example rows when no metric has a code', () => {
    const rows = lines(buildEntriesTemplate([{ ...baseMetric, code: null }], today));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^VENTAS_SEM;2026-09-21;/);
  });
});
