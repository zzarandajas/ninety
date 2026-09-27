import { CloseOutlined, CloudUploadOutlined, DownloadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, Button, message, Modal, Space, Table, Tag, Typography, Upload } from 'antd';
import { useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { scorecardApi, type ImportRowError, type ScorecardMetric, type SkippedCode } from '../lib/scorecardApi';
import { buildEntriesTemplate, buildMetricsTemplate, downloadCsv } from '../lib/scorecardCsv';
import type { TenantMember } from '../lib/tenantApi';
import { ModalTitle } from './ModalTitle';
import { UserSelect } from './UserSelect';

export type ScorecardImportMode = 'metrics' | 'entries';

export interface ScorecardImportModalProps {
  open: boolean;
  mode: ScorecardImportMode;
  metrics: ScorecardMetric[];
  /** Tenant members, for the owner picker in `metrics` mode. */
  members?: TenantMember[];
  /** Owner pre-selected in `metrics` mode (usually the current user), if they are a member. */
  defaultOwnerUserId?: string;
  onClose: () => void;
  /** Data changed: refresh the grid. The modal closes itself unless it has a summary to show. */
  onImported: () => void;
}

interface ColumnHelp {
  column: string;
  required: boolean;
  format: string;
}

const COPY: Record<
  ScorecardImportMode,
  { title: string; subtitle: string; filename: string; columns: ColumnHelp[]; success: (n: number) => string }
> = {
  metrics: {
    title: 'Alta masiva de métricas',
    subtitle: 'Crea varias métricas de golpe a partir de un CSV (por ejemplo, exportado del ERP).',
    filename: 'plantilla-alta-metricas.csv',
    columns: [
      { column: 'codigo', required: true, format: 'Único. A-Z, 0-9, "_" y "-". Ej. VENTAS_SEM' },
      { column: 'nombre', required: true, format: 'Texto libre' },
      { column: 'descripcion', required: false, format: 'Texto libre' },
      {
        column: 'responsable_email',
        required: false,
        format: 'Opcional. Si lo rellenas, esa fila se asigna a ese miembro en vez de al responsable elegido abajo',
      },
      { column: 'objetivo', required: true, format: 'Número. Coma o punto decimal' },
      { column: 'comparacion', required: true, format: '>=, <= o =' },
      { column: 'frecuencia', required: true, format: 'semanal o mensual' },
      { column: 'unidad', required: false, format: 'Ej. €, %, #. Por defecto #' },
    ],
    success: (n) => `${n} ${n === 1 ? 'métrica creada' : 'métricas creadas'}`,
  },
  entries: {
    title: 'Importar valores',
    subtitle: 'Carga valores semanales y mensuales; se guardan en su semana o mes.',
    filename: 'plantilla-valores-scorecard.csv',
    columns: [
      { column: 'codigo', required: true, format: 'Código de la métrica (ver ficha de la métrica)' },
      {
        column: 'periodo',
        required: true,
        format: 'Semanal: fecha AAAA-MM-DD o DD/MM/AAAA (se guarda en el lunes de esa semana). Mensual: AAAA-MM',
      },
      { column: 'valor', required: true, format: 'Número. Coma o punto decimal. Si ya hay valor, se sobrescribe' },
    ],
    success: (n) => `${n} ${n === 1 ? 'valor importado' : 'valores importados'}`,
  },
};

const COLUMN_LABELS: Record<string, string> = {
  codigo: 'Código',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  responsable_email: 'Responsable',
  objetivo: 'Objetivo',
  comparacion: 'Comparación',
  frecuencia: 'Frecuencia',
  unidad: 'Unidad',
  periodo: 'Periodo',
  valor: 'Valor',
};

function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el fichero'));
    reader.readAsText(file, 'utf-8');
  });
}

type KeyedRowError = ImportRowError & { key: string };

function rowErrorsFrom(e: unknown): KeyedRowError[] | null {
  if (!(e instanceof ApiError)) return null;
  const errors = (e.details as { errors?: unknown } | undefined)?.errors;
  if (!Array.isArray(errors)) return null;
  return (errors as ImportRowError[]).map((error, index) => ({ ...error, key: `${error.row}-${error.field ?? ''}-${index}` }));
}

export function ScorecardImportModal({
  open,
  mode,
  metrics,
  members = [],
  defaultOwnerUserId,
  onClose,
  onImported,
}: ScorecardImportModalProps) {
  const copy = COPY[mode];
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<KeyedRowError[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ upserted: number; skipped: SkippedCode[] } | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | undefined>(() =>
    members.some((member) => member.userId === defaultOwnerUserId) ? defaultOwnerUserId : undefined
  );
  const needsOwner = mode === 'metrics' && !ownerUserId;
  const uploadStep = mode === 'metrics' ? 3 : 2;

  const metricsWithoutCode = mode === 'entries' ? metrics.filter((m) => m.isActive && !m.code).length : 0;

  function handleDownload() {
    const content = mode === 'metrics' ? buildMetricsTemplate() : buildEntriesTemplate(metrics);
    downloadCsv(copy.filename, content);
  }

  async function handleImport() {
    if (!file || needsOwner) return;
    setImporting(true);
    setErrors(null);
    setFailure(null);
    setSummary(null);
    try {
      const csv = await readFileText(file);
      if (mode === 'metrics') {
        const { created } = await scorecardApi.importMetrics(csv, ownerUserId);
        message.success(copy.success(created));
        onImported();
        onClose();
        return;
      }
      const { upserted, skipped } = await scorecardApi.importEntries(csv);
      if (upserted > 0) onImported();
      if (skipped.length === 0) {
        message.success(copy.success(upserted));
        onClose();
        return;
      }
      setSummary({ upserted, skipped });
      setFile(null);
    } catch (e) {
      const rowErrors = rowErrorsFrom(e);
      if (rowErrors) setErrors(rowErrors);
      else setFailure(e instanceof Error ? e.message : 'No se pudo importar el fichero');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
      title={<ModalTitle icon={<CloudUploadOutlined />} title={copy.title} subtitle={copy.subtitle} />}
    >
      <Space direction="vertical" size={20} style={{ width: '100%', marginTop: 16 }}>
        <section aria-labelledby="import-step-1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Typography.Text strong id="import-step-1">
              1. Descarga la plantilla y rellénala
            </Typography.Text>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}>
              Descargar plantilla
            </Button>
          </div>
          <Table
            size="small"
            pagination={false}
            rowKey="column"
            dataSource={copy.columns}
            columns={[
              {
                title: 'Columna',
                dataIndex: 'column',
                width: 170,
                render: (column: string, row: ColumnHelp) => (
                  <Space size={4}>
                    <Typography.Text code>{column}</Typography.Text>
                    {row.required && <Typography.Text type="danger" aria-label="obligatoria">*</Typography.Text>}
                  </Space>
                ),
              },
              { title: 'Formato', dataIndex: 'format' },
            ]}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
            * Obligatoria. Separador <Typography.Text code>;</Typography.Text> (también se acepta{' '}
            <Typography.Text code>,</Typography.Text>). Si una sola fila tiene errores no se importa nada.
            {mode === 'entries' && ' Las filas con códigos que no existen aquí se ignoran y se listan al terminar.'}
          </Typography.Text>
          {metricsWithoutCode > 0 && (
            <Alert
              style={{ marginTop: 8 }}
              type="info"
              showIcon
              message={`${metricsWithoutCode} ${
                metricsWithoutCode === 1 ? 'métrica activa no tiene código' : 'métricas activas no tienen código'
              }`}
              description="Solo se pueden importar valores de métricas con código. Asígnalo editando la métrica."
            />
          )}
        </section>

        {mode === 'metrics' && (
          <section aria-labelledby="import-step-owner">
            <Typography.Text strong id="import-step-owner" style={{ display: 'block', marginBottom: 8 }}>
              2. ¿A qué responsable se asignan las métricas?
            </Typography.Text>
            <UserSelect
              ariaLabel="Responsable de las métricas"
              placeholder="Seleccionar miembro"
              members={members}
              value={ownerUserId}
              onChange={setOwnerUserId}
              style={{ width: '100%', maxWidth: 360 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              Se aplica a todas las filas con <Typography.Text code>responsable_email</Typography.Text> vacío.
            </Typography.Text>
          </section>
        )}

        <section aria-labelledby="import-step-upload">
          <Typography.Text strong id="import-step-upload" style={{ display: 'block', marginBottom: 8 }}>
            {uploadStep}. Sube el fichero CSV
          </Typography.Text>
          <Upload.Dragger
            accept=".csv,text/csv"
            multiple={false}
            maxCount={1}
            showUploadList={false}
            beforeUpload={(selected) => {
              setFile(selected);
              setErrors(null);
              setFailure(null);
              setSummary(null);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              {file ? <FileTextOutlined /> : <InboxOutlined />}
            </p>
            <p className="ant-upload-text">{file ? file.name : 'Haz clic o arrastra aquí el fichero .csv'}</p>
            <p className="ant-upload-hint">{file ? 'Haz clic para elegir otro fichero' : 'Máximo 1 MB / 2.000 filas'}</p>
          </Upload.Dragger>
        </section>

        {failure && <Alert type="error" showIcon role="alert" message={failure} />}

        {summary && (
          <Alert
            role="status"
            type={summary.upserted > 0 ? 'warning' : 'error'}
            showIcon
            message={
              summary.upserted > 0
                ? `${copy.success(summary.upserted)}. Se han ignorado ${summary.skipped.length} ${
                    summary.skipped.length === 1 ? 'código desconocido' : 'códigos desconocidos'
                  }`
                : 'No se ha importado ningún valor: ningún código del fichero existe en esta organización'
            }
            description={
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  No existe ninguna métrica con estos códigos (o no tienen código asignado). Si alguno debería
                  importarse, créalo con Alta masiva o asígnale el código en su ficha y vuelve a subir el fichero.
                </Typography.Text>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {summary.skipped.map((item) => (
                    <div key={item.code} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                      <Tag style={{ fontFamily: 'monospace' }}>{item.code}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.rows.length === 1 ? 'fila' : 'filas'} {item.rows.join(', ')}
                      </Typography.Text>
                    </div>
                  ))}
                </div>
              </Space>
            }
          />
        )}

        {errors && (
          <div role="alert">
            <Alert
              type="error"
              showIcon
              message={`No se ha importado nada: ${errors.length} ${errors.length === 1 ? 'error' : 'errores'} en el fichero`}
              description="Corrige las filas indicadas y vuelve a subir el fichero."
              style={{ marginBottom: 8 }}
            />
            <Table
              size="small"
              rowKey="key"
              dataSource={errors}
              pagination={errors.length > 8 ? { pageSize: 8, size: 'small' } : false}
              columns={[
                { title: 'Fila', dataIndex: 'row', width: 64 },
                {
                  title: 'Columna',
                  dataIndex: 'field',
                  width: 130,
                  render: (field?: string) => (field ? <Tag>{COLUMN_LABELS[field] ?? field}</Tag> : '—'),
                },
                { title: 'Error', dataIndex: 'message' },
              ]}
            />
          </div>
        )}

        <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            {summary && !file ? (
              <Button type="primary" icon={<CloseOutlined />} onClick={onClose}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button icon={<CloseOutlined />} onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={handleImport}
                  loading={importing}
                  disabled={!file || needsOwner}
                >
                  Importar
                </Button>
              </>
            )}
          </Space>
        </div>
      </Space>
    </Modal>
  );
}
