import type { MetricComparison, MetricFrequency } from '@prisma/client';
import { parseCsv, type CsvRow } from './csv.js';

/**
 * Pure (DB-free) validation for the Scorecard CSV imports. The route resolves the
 * tenant context (members, existing metric codes) through repositories and passes
 * it in; these functions only parse and check. All-or-nothing: callers must not
 * write anything unless `ok` is true.
 */

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_ERRORS = 200;
export const METRIC_CODE_PATTERN = /^[A-Z0-9_-]{1,40}$/;

export const METRIC_IMPORT_COLUMNS = [
  'codigo',
  'nombre',
  'descripcion',
  'responsable_email',
  'objetivo',
  'comparacion',
  'frecuencia',
  'unidad',
] as const;
const METRIC_REQUIRED_COLUMNS = ['codigo', 'nombre', 'objetivo', 'comparacion', 'frecuencia'];

export const ENTRY_IMPORT_COLUMNS = ['codigo', 'periodo', 'valor'] as const;

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export type ImportResult<T> = { ok: true; rows: T[] } | { ok: false; errors: ImportError[] };

export interface MetricImportRow {
  code: string;
  name: string;
  description?: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
}

export interface EntryImportRow {
  metricId: string;
  periodStart: Date;
  actualValue: number;
}

export interface MetricImportContext {
  /** lower-cased email → userId, active members of the tenant only */
  memberIdByEmail: Map<string, string>;
  /** upper-cased codes already used in the tenant */
  existingCodes: Set<string>;
  /** Owner chosen in the upload dialog; used for rows whose `responsable_email` is blank. */
  defaultOwnerUserId?: string;
}

export interface EntryImportContext {
  /** upper-cased code → metric */
  metricsByCode: Map<string, { id: string; frequency: MetricFrequency }>;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Accepts `1234.5`, `1234,5`, `1.234,5` and `-3`. Thousands separators only with a decimal comma. */
export function parseDecimal(raw: string): number | null {
  let value = raw.replace(/[\s ]/g, '');
  if (value.includes(',')) {
    if ((value.match(/,/g) ?? []).length > 1) return null;
    value = value.replace(/\./g, '').replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

export function parseComparison(raw: string): MetricComparison | null {
  const value = raw.trim().toLowerCase();
  if (['>=', '≥', 'gte'].includes(value)) return 'gte';
  if (['<=', '≤', 'lte'].includes(value)) return 'lte';
  if (['=', '==', 'eq'].includes(value)) return 'eq';
  return null;
}

export function parseFrequency(raw: string): MetricFrequency | null {
  const value = raw.trim().toLowerCase();
  if (['semanal', 'weekly'].includes(value)) return 'weekly';
  if (['mensual', 'monthly'].includes(value)) return 'monthly';
  return null;
}

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function mondayOf(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

/**
 * Weekly metrics need a full date (normalized to that week's Monday, UTC).
 * Monthly metrics accept `AAAA-MM`, `MM/AAAA` or a full date (normalized to day 1).
 */
export function parsePeriod(raw: string, frequency: MetricFrequency): Date | null {
  const value = raw.trim();
  let match: RegExpMatchArray | null;

  let date: Date | null = null;
  if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    date = utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
  } else if ((match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    date = utcDate(Number(match[3]), Number(match[2]), Number(match[1]));
  }
  if (date) return frequency === 'weekly' ? mondayOf(date) : utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);

  if (frequency === 'weekly') return null;
  if ((match = value.match(/^(\d{4})-(\d{1,2})$/))) return utcDate(Number(match[1]), Number(match[2]), 1);
  if ((match = value.match(/^(\d{1,2})\/(\d{4})$/))) return utcDate(Number(match[2]), Number(match[1]), 1);
  return null;
}

interface Table {
  columns: Map<string, number>;
  rows: CsvRow[];
}

function readTable(csv: string, required: readonly string[]): Table | ImportError[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [{ row: 1, message: 'El fichero está vacío' }];

  const columns = new Map<string, number>();
  header.cells.forEach((cell, index) => columns.set(normalizeHeader(cell), index));

  const missing = required.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    return [{ row: header.line, message: `Faltan columnas obligatorias: ${missing.join(', ')}` }];
  }
  if (rows.length === 0) return [{ row: header.line, message: 'El fichero no tiene filas de datos' }];
  if (rows.length > MAX_IMPORT_ROWS) {
    return [{ row: header.line, message: `Máximo ${MAX_IMPORT_ROWS} filas por fichero (tiene ${rows.length})` }];
  }
  return { columns, rows };
}

function cellGetter(table: Table, row: CsvRow) {
  return (column: string) => {
    const index = table.columns.get(column);
    return index === undefined ? '' : (row.cells[index] ?? '');
  };
}

function finish<T>(rows: T[], errors: ImportError[]): ImportResult<T> {
  return errors.length > 0 ? { ok: false, errors: errors.slice(0, MAX_IMPORT_ERRORS) } : { ok: true, rows };
}

export function validateMetricImport(csv: string, ctx: MetricImportContext): ImportResult<MetricImportRow> {
  const table = readTable(csv, METRIC_REQUIRED_COLUMNS);
  if (Array.isArray(table)) return { ok: false, errors: table };

  const errors: ImportError[] = [];
  const result: MetricImportRow[] = [];
  const seenCodes = new Map<string, number>();

  for (const row of table.rows) {
    const get = cellGetter(table, row);
    const rowErrors: ImportError[] = [];
    const fail = (field: string, message: string) => rowErrors.push({ row: row.line, field, message });

    const code = normalizeCode(get('codigo'));
    if (!code) fail('codigo', 'El código es obligatorio');
    else if (!METRIC_CODE_PATTERN.test(code)) fail('codigo', `Código "${code}" inválido: solo A-Z, 0-9, "_" y "-" (máx. 40)`);
    else if (ctx.existingCodes.has(code)) fail('codigo', `Ya existe una métrica con código "${code}"`);
    else if (seenCodes.has(code)) fail('codigo', `Código "${code}" repetido (ya aparece en la fila ${seenCodes.get(code)})`);
    else seenCodes.set(code, row.line);

    const name = get('nombre');
    if (!name) fail('nombre', 'El nombre es obligatorio');

    const email = get('responsable_email').toLowerCase();
    const ownerUserId = email ? ctx.memberIdByEmail.get(email) : ctx.defaultOwnerUserId;
    if (!email && !ownerUserId) fail('responsable_email', 'Sin responsable: elige uno al subir el fichero o rellena el email');
    else if (!ownerUserId) fail('responsable_email', `"${email}" no es miembro activo de esta organización`);

    const goalValue = parseDecimal(get('objetivo'));
    if (goalValue === null) fail('objetivo', `Objetivo "${get('objetivo')}" no es un número válido`);

    const comparison = parseComparison(get('comparacion'));
    if (!comparison) fail('comparacion', `Comparación "${get('comparacion')}" inválida: usa >=, <= o =`);

    const frequency = parseFrequency(get('frecuencia'));
    if (!frequency) fail('frecuencia', `Frecuencia "${get('frecuencia')}" inválida: usa semanal o mensual`);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const description = get('descripcion');
    result.push({
      code,
      name,
      ...(description ? { description } : {}),
      ownerUserId: ownerUserId as string,
      goalValue: goalValue as number,
      comparison: comparison as MetricComparison,
      frequency: frequency as MetricFrequency,
      unit: get('unidad') || '#',
    });
  }

  return finish(result, errors);
}

export function validateEntryImport(csv: string, ctx: EntryImportContext): ImportResult<EntryImportRow> {
  const table = readTable(csv, ENTRY_IMPORT_COLUMNS);
  if (Array.isArray(table)) return { ok: false, errors: table };

  const errors: ImportError[] = [];
  const result: EntryImportRow[] = [];
  const seen = new Map<string, number>();

  for (const row of table.rows) {
    const get = cellGetter(table, row);
    const rowErrors: ImportError[] = [];
    const fail = (field: string, message: string) => rowErrors.push({ row: row.line, field, message });

    const code = normalizeCode(get('codigo'));
    const metric = code ? ctx.metricsByCode.get(code) : undefined;
    if (!code) fail('codigo', 'El código es obligatorio');
    else if (!metric) fail('codigo', `No existe ninguna métrica con código "${code}"`);

    const actualValue = parseDecimal(get('valor'));
    if (actualValue === null) fail('valor', `Valor "${get('valor')}" no es un número válido`);

    let periodStart: Date | null = null;
    if (metric) {
      periodStart = parsePeriod(get('periodo'), metric.frequency);
      if (!periodStart) {
        fail(
          'periodo',
          metric.frequency === 'weekly'
            ? `Periodo "${get('periodo')}" inválido: la métrica es semanal, usa una fecha AAAA-MM-DD`
            : `Periodo "${get('periodo')}" inválido: la métrica es mensual, usa AAAA-MM`
        );
      }
    }

    if (metric && periodStart) {
      const key = `${metric.id}|${periodStart.toISOString()}`;
      const firstLine = seen.get(key);
      if (firstLine !== undefined) {
        fail('periodo', `"${code}" ya tiene valor para ese periodo en la fila ${firstLine}`);
      } else {
        seen.set(key, row.line);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    result.push({ metricId: (metric as { id: string }).id, periodStart: periodStart as Date, actualValue: actualValue as number });
  }

  return finish(result, errors);
}
