import { BarChartOutlined, CloseOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { scorecardApi, type MetricComparison, type MetricFrequency, type ScorecardMetric } from '../lib/scorecardApi';
import type { TenantMember } from '../lib/tenantApi';
import { ModalTitle } from './ModalTitle';
import { UserSelect } from './UserSelect';

export interface ScorecardMetricFormModalProps {
  open: boolean;
  metric?: ScorecardMetric;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function ScorecardMetricFormModal({ open, metric, members, onClose, onSaved }: ScorecardMetricFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue(metric ?? { comparison: 'gte', frequency: 'weekly', isActive: true });
  }, [metric, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (metric) {
        await scorecardApi.updateMetric(metric.id, values);
      } else {
        await scorecardApi.createMetric(values);
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!metric) return;
    try {
      await scorecardApi.deleteMetric(metric.id);
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
          icon={<BarChartOutlined />}
          title={metric ? 'Editar Métrica Scorecard' : 'Nueva Métrica Scorecard'}
          subtitle="Indicador clave semanal o mensual para medir la salud del negocio."
        />
      }
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Nombre del Indicador" rules={[{ required: true, message: 'Introduce un nombre' }]}>
          <Input placeholder="Ej. Facturación semanal, Llamadas comercial..." />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ownerUserId" label="Responsable (Owner)" rules={[{ required: true, message: 'Elige un owner' }]}>
              <UserSelect ariaLabel="Owner" placeholder="Seleccionar miembro" members={members} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="unit" label="Unidad" rules={[{ required: true, message: 'Introduce una unidad' }]}>
              <Input placeholder="Ej. #, %, €, k€" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="goalValue" label="Valor Objetivo" rules={[{ required: true, message: 'Introduce un objetivo' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="Ej. 10000" />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="comparison" label="Criterio Cumplimiento" rules={[{ required: true }]}>
              <Select
                aria-label="Comparación"
                options={[
                  { value: 'gte', label: '≥ (mayor o igual)' },
                  { value: 'lte', label: '≤ (menor o igual)' },
                  { value: 'eq', label: '= (igual exacto)' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col span={12}>
            <Form.Item name="frequency" label="Frecuencia" rules={[{ required: true }]}>
              <Select
                aria-label="Frecuencia"
                options={[
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'monthly', label: 'Mensual' },
                ]}
              />
            </Form.Item>
          </Col>

          {metric && (
            <Col span={12}>
              <Form.Item name="isActive" label="Métrica Activa" valuePropName="checked">
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* FOOTER ACTIONS */}
        <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {metric && (
              <Popconfirm
                title="¿Borrar esta métrica? Esta acción no se puede deshacer."
                onConfirm={handleDelete}
                okText="Borrar"
                cancelText="Cancelar"
              >
                <Button danger type="text" icon={<DeleteOutlined />}>
                  Borrar métrica
                </Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button icon={<CloseOutlined />} onClick={onClose}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Guardar
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}
