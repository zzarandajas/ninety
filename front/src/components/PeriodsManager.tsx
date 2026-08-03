import { CalendarOutlined, CloseOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { currentQuarter, currentQuarterEndDate, currentQuarterStartDate } from '../lib/quarters';
import { quartersApi, type Quarter } from '../lib/quartersApi';
import { ModalTitle } from './ModalTitle';
import { useAuthStore } from '../store/authStore';

interface CreateFormValues {
  label: string;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  theme?: string;
  rolloverEnabled: boolean;
  rolloverFromLabel?: string;
}

interface EditFormValues {
  theme?: string;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  isOpen: boolean;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo salió mal';
}

export function PeriodsManager() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [periods, setPeriods] = useState<Quarter[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Quarter | null>(null);

  const [createForm] = Form.useForm<CreateFormValues>();
  const [editForm] = Form.useForm<EditFormValues>();
  const currentLabel = Form.useWatch('label', createForm);

  const loadPeriods = () => {
    if (!activeTenantId) return;
    setLoading(true);
    quartersApi
      .list()
      .then(setPeriods)
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPeriods();
  }, [activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'quarter') loadPeriods();
  });

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods]
  );

  function openCreateModal() {
    createForm.setFieldsValue({
      label: currentQuarter(),
      startDate: currentQuarterStartDate(),
      endDate: currentQuarterEndDate(),
      rolloverEnabled: false,
    });
    setCreateOpen(true);
  }

  async function handleCreate(values: CreateFormValues) {
    try {
      const created = await quartersApi.create({
        label: values.label.trim(),
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        ...(values.theme?.trim() ? { theme: values.theme.trim() } : {}),
        ...(values.rolloverEnabled && values.rolloverFromLabel
          ? { rolloverFromLabel: values.rolloverFromLabel }
          : {}),
      });
      message.success(
        values.rolloverEnabled && created.movedRockCount > 0
          ? `Periodo creado. Se movieron ${created.movedRockCount} rocks sin completar.`
          : 'Periodo creado correctamente'
      );
      setCreateOpen(false);
      loadPeriods();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleToggleOpen(period: Quarter) {
    try {
      await quartersApi.update(period.id, { isOpen: !period.isOpen });
      message.success(period.isOpen ? 'Periodo cerrado' : 'Periodo abierto');
      loadPeriods();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  function openEditModal(period: Quarter) {
    editForm.setFieldsValue({
      theme: period.theme ?? undefined,
      startDate: dayjs(period.startDate),
      endDate: dayjs(period.endDate),
      isOpen: period.isOpen,
    });
    setEditing(period);
  }

  async function handleEdit(values: EditFormValues) {
    if (!editing) return;
    try {
      await quartersApi.update(editing.id, {
        theme: values.theme?.trim() ? values.theme.trim() : null,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        isOpen: values.isOpen,
      });
      message.success('Periodo actualizado');
      setEditing(null);
      loadPeriods();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  const rolloverOptions = sortedPeriods
    .filter((p) => p.label !== currentLabel)
    .map((p) => ({ value: p.label, label: `${p.label}${p.theme ? ` — ${p.theme}` : ''}` }));

  return (
    <Card
      className="glass-card"
      title="Periodos / Trimestres"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Nuevo Periodo
        </Button>
      }
    >
      <Table
        dataSource={sortedPeriods}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        columns={[
          {
            title: 'Periodo',
            dataIndex: 'label',
            key: 'label',
            render: (label: string) => <Typography.Text strong>{label}</Typography.Text>,
          },
          {
            title: 'Tema',
            dataIndex: 'theme',
            key: 'theme',
            render: (theme: string | null) => theme || <Typography.Text type="secondary">—</Typography.Text>,
          },
          {
            title: 'Inicio',
            dataIndex: 'startDate',
            key: 'startDate',
            render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
          },
          {
            title: 'Fin',
            dataIndex: 'endDate',
            key: 'endDate',
            render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
          },
          {
            title: 'Rocks',
            key: 'rocks',
            render: (_, period) => (
              <Space size={4}>
                <Tag color="blue">{period.rockCount}</Tag>
                {period.openRockCount > 0 && <Tag color="orange">{period.openRockCount} abiertos</Tag>}
              </Space>
            ),
          },
          {
            title: 'Estado',
            dataIndex: 'isOpen',
            key: 'isOpen',
            render: (isOpen: boolean) => (
              <Tag color={isOpen ? 'green' : 'default'}>{isOpen ? 'Abierto' : 'Cerrado'}</Tag>
            ),
          },
          {
            title: 'Acciones',
            key: 'actions',
            render: (_, period) => (
              <Space wrap>
                <Switch
                  checked={period.isOpen}
                  checkedChildren="Abierto"
                  unCheckedChildren="Cerrado"
                  onChange={() => handleToggleOpen(period)}
                />
                <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(period)}>
                  Editar
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={
          <ModalTitle
            icon={<CalendarOutlined />}
            title="Nuevo Periodo"
            subtitle="Crea un trimestre con fechas, tema y reglas de rollover."
          />
        }
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Periodo"
            rules={[
              { required: true, message: 'Introduce el periodo' },
              { pattern: /^\d{4}-Q[1-4]$/, message: 'Formato: YYYY-Qn (ej. 2026-Q4)' },
            ]}
          >
            <Input placeholder="2026-Q4" />
          </Form.Item>

          <Space size={16} style={{ display: 'flex', width: '100%' }}>
            <Form.Item name="startDate" label="Fecha de inicio" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="endDate" label="Fecha de fin" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>

          <Form.Item name="theme" label="Tema del periodo (Quarterly Theme)">
            <Input placeholder="Ej. Ejecutar con foco" />
          </Form.Item>

          <Form.Item name="rolloverEnabled" valuePropName="checked">
            <Checkbox>Traer rocks sin completar del periodo anterior</Checkbox>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.rolloverEnabled !== cur.rolloverEnabled}>
            {({ getFieldValue }) =>
              getFieldValue('rolloverEnabled') ? (
                <Form.Item
                  name="rolloverFromLabel"
                  label="Periodo de origen"
                  rules={[{ required: true, message: 'Selecciona el periodo de origen' }]}
                >
                  <Select
                    placeholder="Desde qué periodo mover los rocks"
                    options={rolloverOptions}
                    aria-label="Periodo de origen"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                Crear Periodo
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <ModalTitle
            icon={<CalendarOutlined />}
            title={`Editar ${editing?.label ?? 'Periodo'}`}
            subtitle="Ajusta fechas, tema o estado del trimestre."
          />
        }
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item name="theme" label="Tema del periodo">
            <Input placeholder="Ej. Ejecutar con foco" />
          </Form.Item>

          <Space size={16} style={{ display: 'flex', width: '100%' }}>
            <Form.Item name="startDate" label="Fecha de inicio" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="endDate" label="Fecha de fin" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>

          <Form.Item name="isOpen" label="Periodo abierto" valuePropName="checked">
            <Switch checkedChildren="Abierto" unCheckedChildren="Cerrado" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                Guardar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
