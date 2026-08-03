import { ExclamationCircleOutlined, CloseOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, message, Modal, Popconfirm, Row, Select, Space } from 'antd';
import { useEffect, useState } from 'react';
import { issuesApi, type Issue, type IssuePriority, type IssueStatus } from '../lib/issuesApi';
import type { TenantMember } from '../lib/tenantApi';
import { ModalTitle } from './ModalTitle';
import { UserSelect } from './UserSelect';

export interface IssueFormModalProps {
  open: boolean;
  issue?: Issue;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
  status?: IssueStatus;
  resolutionNotes?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function IssueFormModal({ open, issue, members, onClose, onSaved }: IssueFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (issue) {
      form.setFieldsValue({
        title: issue.title,
        description: issue.description ?? undefined,
        raisedByUserId: issue.raisedByUserId,
        priority: issue.priority,
        status: issue.status,
        resolutionNotes: issue.resolutionNotes ?? undefined,
      });
    } else {
      form.setFieldsValue({ priority: 'medium' });
    }
  }, [issue, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (issue) {
        await issuesApi.update(issue.id, values);
      } else {
        await issuesApi.create(values);
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!issue) return;
    try {
      await issuesApi.remove(issue.id);
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
          icon={<ExclamationCircleOutlined />}
          title={issue ? 'Editar Issue (IDS)' : 'Nuevo Issue (IDS)'}
          subtitle="Captura un problema u oportunidad para discutir y resolver en reunión L10."
        />
      }
      width={540}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Título del problema o tema" rules={[{ required: true, message: 'Introduce un título' }]}>
          <Input placeholder="Ej. Retrasos recurrentes en entregas a clientes" />
        </Form.Item>

        <Form.Item name="description" label="Descripción / Causa raíz inicial">
          <Input.TextArea rows={2} placeholder="Añade contexto adicional para agilizar el análisis..." />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="raisedByUserId" label="Owner / Creado por" rules={[{ required: true, message: 'Elige un owner' }]}>
              <UserSelect placeholder="Seleccionar miembro" members={members} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'low', label: '🔵 Baja' },
                  { value: 'medium', label: '🟠 Media' },
                  { value: 'high', label: '🔴 Alta' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {issue && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="status" label="Estado actual">
                <Select
                  options={[
                    { value: 'open', label: 'Abierto (Open)' },
                    { value: 'discussing', label: 'En discusión (Discussing)' },
                    { value: 'solved', label: 'Resuelto (Solved)' },
                    { value: 'dropped', label: 'Descartado (Dropped)' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {issue && (
          <Form.Item name="resolutionNotes" label="Notas de resolución acordada">
            <Input.TextArea rows={2} placeholder="Acuerdos principales alcanzados para solucionar el issue..." />
          </Form.Item>
        )}

        {/* FOOTER ACTIONS */}
        <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {issue && (
              <Popconfirm
                title="¿Borrar este issue? Esta acción no se puede deshacer."
                onConfirm={handleDelete}
                okText="Borrar"
                cancelText="Cancelar"
              >
                <Button danger type="text" icon={<DeleteOutlined />}>
                  Borrar
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
