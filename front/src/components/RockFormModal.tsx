import {
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import * as Icons from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { currentQuarter, currentQuarterEndDate } from '../lib/quarters';
import { isHtmlEmpty } from '../lib/richText';
import { rocksApi, type Milestone, type Rock } from '../lib/rocksApi';
import type { TenantMember } from '../lib/tenantApi';
import { ModalTitle } from './ModalTitle';
import { RichTextEditor } from './RichTextEditor';
import { UserSelect } from './UserSelect';

export interface RockFormModalProps {
  open: boolean;
  rock?: Rock;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: dayjs.Dayjs;
  status?: Rock['status'];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function RockFormModal({ open, rock, members, onClose, onSaved }: RockFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>(rock?.milestones ?? []);
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState<dayjs.Dayjs | null>(dayjs());
  const quarterOptions = useQuarterOptions(rock ? [rock.quarter] : []);

  useEffect(() => {
    setMilestones(rock?.milestones ?? []);
    form.setFieldsValue(
      rock
        ? {
            title: rock.title,
            description: rock.description ?? undefined,
            ownerUserId: rock.ownerUserId,
            quarter: rock.quarter,
            isCompanyRock: rock.isCompanyRock,
            dueDate: dayjs(rock.dueDate),
            status: rock.status,
          }
        : { isCompanyRock: false, quarter: currentQuarter(), dueDate: currentQuarterEndDate() }
    );
  }, [rock, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        ownerUserId: values.ownerUserId,
        quarter: values.quarter,
        isCompanyRock: values.isCompanyRock,
        dueDate: values.dueDate.toISOString(),
      };
      if (rock) {
        await rocksApi.update(rock.id, {
          ...payload,
          description: isHtmlEmpty(values.description) ? null : values.description,
          status: values.status,
        });
      } else {
        await rocksApi.create({
          ...payload,
          description: isHtmlEmpty(values.description) ? undefined : values.description,
        });
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMilestone() {
    if (!rock || !newMilestoneDescription) return;
    try {
      const milestone = await rocksApi.addMilestone(rock.id, {
        description: newMilestoneDescription,
        dueDate: (newMilestoneDueDate ?? dayjs()).toISOString(),
      });
      setMilestones((prev) => [...prev, milestone]);
      setNewMilestoneDescription('');
      setNewMilestoneDueDate(dayjs());
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleToggleMilestone(milestone: Milestone, completed: boolean) {
    if (!rock) return;
    try {
      const updated = await rocksApi.toggleMilestone(rock.id, milestone.id, completed);
      setMilestones((prev) => prev.map((m) => (m.id === milestone.id ? updated : m)));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleRemoveMilestone(milestone: Milestone) {
    if (!rock) return;
    try {
      await rocksApi.removeMilestone(rock.id, milestone.id);
      setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleDeleteRock() {
    if (!rock) return;
    try {
      await rocksApi.remove(rock.id);
      onSaved();
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <ModalTitle
          icon={<Icons.RocketOutlined />}
          title={rock ? 'Editar Rock Trimestral' : 'Nuevo Rock Trimestral'}
          subtitle="Define objetivos a 90 días alineados con el V/TO de la organización."
        />
      }
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Título del Rock" rules={[{ required: true, message: 'Introduce un título' }]}>
          <Input placeholder="Ej. Lanzar nueva versión de la app" />
        </Form.Item>

        <Form.Item name="description" label="Descripción / Detalle">
          <RichTextEditor placeholder="Suma de contexto, métricas clave para darlo por conseguido..." />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ownerUserId" label="Owner / Asignado" rules={[{ required: true, message: 'Elige un owner' }]}>
              <UserSelect ariaLabel="Owner" placeholder="Seleccionar responsable" members={members} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="quarter" label="Trimestre" rules={[{ required: true, message: 'Introduce el trimestre' }]}>
              <Select placeholder="2026-Q3" options={quarterOptions} showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col span={12}>
            <Form.Item name="isCompanyRock" label="Tipo de Rock" valuePropName="checked">
              <Switch checkedChildren="Empresa" unCheckedChildren="Personal" />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="dueDate" label="Fecha límite" rules={[{ required: true, message: 'Elige una fecha' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        {rock && (
          <Form.Item name="status" label="Estado actual">
            <Select
              options={[
                { value: 'on_track', label: '🟢 On track (En camino)' },
                { value: 'off_track', label: '🔴 Off track (En riesgo)' },
                { value: 'done', label: '🔵 Done (Conseguido)' },
              ]}
            />
          </Form.Item>
        )}

        {/* MILESTONES SECTION */}
        {rock && (
          <div className="modal-section-card">
            <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
              Milestones / Hitos intermedios
            </Typography.Text>
            {milestones.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                Sin hitos añadidos todavía.
              </Typography.Text>
            )}
            {milestones.map((milestone) => (
              <div key={milestone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Checkbox
                  checked={!!milestone.completedAt}
                  onChange={(e) => handleToggleMilestone(milestone, e.target.checked)}
                />
                <Typography.Text delete={!!milestone.completedAt} style={{ flex: 1, fontSize: 13 }}>
                  {milestone.description}
                </Typography.Text>
                <Button icon={<Icons.DeleteOutlined />} aria-label="Borrar" size="small" type="text" danger onClick={() => handleRemoveMilestone(milestone)}>
                  
                </Button>
              </div>
            ))}
            <Space style={{ width: '100%', marginTop: 8 }} wrap>
              <Input
                aria-label="Descripción del milestone"
                placeholder="Nuevo milestone / hito"
                value={newMilestoneDescription}
                onChange={(e) => setNewMilestoneDescription(e.target.value)}
                style={{ width: 220 }}
              />
              <DatePicker value={newMilestoneDueDate} onChange={setNewMilestoneDueDate} format="DD/MM/YYYY" style={{ width: 130 }} />
              <Button aria-label="Añadir milestone" onClick={handleAddMilestone}>+</Button>
            </Space>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {rock && (
              <Popconfirm
                title="¿Borrar este Rock? Esta acción no se puede deshacer."
                onConfirm={handleDeleteRock}
                okText="Borrar"
                cancelText="Cancelar"
              >
                <Button icon={<Icons.DeleteOutlined />}  danger type="text">
                  Borrar Rock
                </Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button icon={<Icons.CloseOutlined />}  onClick={onClose}>Cancelar</Button>
            <Button icon={<Icons.CheckOutlined />}  type="primary" htmlType="submit" loading={saving}>
              Guardar
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}
