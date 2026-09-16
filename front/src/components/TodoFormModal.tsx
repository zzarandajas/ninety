import { CheckSquareOutlined, CloseOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Col, DatePicker, Form, message, Modal, Popconfirm, Row, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { isHtmlEmpty } from '../lib/richText';
import { todosApi, type Todo, type TodoStatus } from '../lib/todosApi';
import type { TenantMember } from '../lib/tenantApi';
import { ModalTitle } from './ModalTitle';
import { RichTextEditor } from './RichTextEditor';
import { UserSelect } from './UserSelect';

import { currentQuarter } from '../lib/quarters';

export interface TodoFormModalProps {
  open: boolean;
  todo?: Todo;
  members: TenantMember[];
  meetingId?: string;
  quarter?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  title: string;
  ownerUserId: string;
  dueDate?: dayjs.Dayjs;
  status?: TodoStatus;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function TodoFormModal({ open, todo, members, meetingId, quarter, onClose, onSaved }: TodoFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue(
      todo
        ? { title: todo.title, ownerUserId: todo.ownerUserId, dueDate: todo.dueDate ? dayjs(todo.dueDate) : undefined, status: todo.status }
        : {}
    );
  }, [todo, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      const dueDate = values.dueDate ? values.dueDate.toISOString() : undefined;
      const effectiveQuarter = quarter ?? todo?.quarter ?? currentQuarter();

      if (todo) {
        await todosApi.update(todo.id, {
          title: values.title,
          ownerUserId: values.ownerUserId,
          dueDate: dueDate ?? null,
          status: values.status,
          quarter: effectiveQuarter,
        });
      } else {
        await todosApi.create({
          title: values.title,
          ownerUserId: values.ownerUserId,
          quarter: effectiveQuarter,
          dueDate,
          ...(meetingId ? { originatingMeetingId: meetingId } : {}),
        });
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!todo) return;
    try {
      await todosApi.remove(todo.id);
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
          icon={<CheckSquareOutlined />}
          title={todo ? 'Editar To-Do' : 'Nuevo To-Do (Compromiso a 7 días)'}
          subtitle="Acción concreta y asignada con objetivo de cumplimiento en una semana."
        />
      }
      width={500}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
        <Form.Item
          name="title"
          label="Descripción de la tarea"
          rules={[
            {
              validator: (_, value) =>
                isHtmlEmpty(value) ? Promise.reject(new Error('Introduce un título')) : Promise.resolve(),
            },
          ]}
        >
          <RichTextEditor placeholder="Ej. Enviar propuesta revisada a Cliente X" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ownerUserId" label="Responsable (Owner)" rules={[{ required: true, message: 'Elige un owner' }]}>
              <UserSelect placeholder="Seleccionar miembro" members={members} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="dueDate" label="Fecha límite">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="En 7 días" />
            </Form.Item>
          </Col>
        </Row>

        {todo && (
          <Form.Item name="status" label="Estado">
            <Select
              options={[
                { value: 'open', label: 'Pendiente (Open)' },
                { value: 'done', label: 'Completado (Done)' },
              ]}
            />
          </Form.Item>
        )}

        {/* FOOTER ACTIONS */}
        <div className="modal-actions-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {todo && (
              <Popconfirm
                title="¿Borrar este to-do? Esta acción no se puede deshacer."
                onConfirm={handleDelete}
                okText="Borrar"
                cancelText="Cancelar"
              >
                <Button danger type="text" icon={<DeleteOutlined />}>
                  Borrar to-do
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
