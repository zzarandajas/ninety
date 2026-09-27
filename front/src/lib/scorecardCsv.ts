import type { ScorecardMetric } from './scorecardApi';
import { mondayOf } from './weeks';

/**
 * CSV templates for the Scorecard bulk imports. `;` separator and a UTF-8 BOM so
 * Excel in Spanish locale opens them with columns split and accents intact. The
 * server (`server/src/lib/scorecardImport.ts`) accepts `;` or `,` on upload.
 */

const BOM = '﻿';
const SEPARATOR = ';';

function csvCell(value: string): string {
  return /[;",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return BOM + rows.map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n') + '\r\n';
}

export const METRIC_TEMPLATE_HEADER = [
  'codigo',
  'nombre',
  'descripcion',
  'responsable_email',
  'objetivo',
  'comparacion',
  'frecuencia',
  'unidad',
];

export const ENTRY_TEMPLATE_HEADER = ['codigo', 'periodo', 'valor'];

export function buildMetricsTemplate(ownerEmail = 'responsable@empresa.com'): string {
  return toCsv([
    METRIC_TEMPLATE_HEADER,
    ['VENTAS_SEM', 'Facturación semanal', 'Importe facturado según ERP', ownerEmail, '25000', '>=', 'semanal', '€'],
    ['INCIDENCIAS_MES', 'Incidencias abiertas', '', ownerEmail, '5', '<=', 'mensual', '#'],
  ]);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pre-filled with one row per active metric that has a code, for the current
 * period (this week's Monday / this month), value left blank for the user to fill.
 * Falls back to example rows when no metric has a code yet.
 */
export function buildEntriesTemplate(metrics: ScorecardMetric[], today: Date = new Date()): string {
  const withCode = metrics.filter((metric) => metric.isActive && metric.code);
  const week = isoDate(mondayOf(today));
  const month = isoDate(today).slice(0, 7);

  const rows = withCode.length
    ? withCode.map((metric) => [metric.code as string, metric.frequency === 'weekly' ? week : month, ''])
    : [
        ['VENTAS_SEM', week, '27500,50'],
        ['INCIDENCIAS_MES', month, '3'],
      ];
  return toCsv([ENTRY_TEMPLATE_HEADER, ...rows]);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
