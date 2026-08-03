import { CheckOutlined, CloseOutlined, SendOutlined, UserAddOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, message, Modal, Select, Space, Typography } from 'antd';
import { useState } from 'react';
import { membershipsApi, type InviteMemberResult, type TenantRole } from '../lib/membershipsApi';
import { ModalTitle } from './ModalTitle';

export interface InviteMemberModalProps {
  open: boolean;
  canGrantOwner: boolean;
  onClose: () => void;
  onInvited: () => void;
}

interface FormValues {
  email: string;
  fullName: string;
  role: TenantRole;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function InviteMemberModal({ open, canGrantOwner, onClose, onInvited }: InviteMemberModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<InviteMemberResult | null>(null);

  function handleClose() {
    setResult(null);
    form.resetFields();
    onClose();
  }

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      const invited = await membershipsApi.invite(values);
      setResult(invited);
      onInvited();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={
        <ModalTitle
          icon={<UserAddOutlined />}
          title="Invitar nuevo miembro"
          subtitle="Concede acceso a esta organización y asigna su rol de permisos."
        />
      }
      width={480}
      destroyOnHidden
    >
      {result ? (
        <div style={{ marginTop: 16 }}>
          {result.temporaryPassword ? (
            <Alert
              type="success"
              showIcon
              message="Usuario creado e invitado correctamente"
              description={
                <div style={{ marginTop: 8 }}>
                  <Typography.Paragraph style={{ marginBottom: 6 }}>
                    Contraseña temporal generada para <strong>{result.email}</strong> (pásasela de forma segura, no se volverá a mostrar):
                  </Typography.Paragraph>
                  <Typography.Text copyable code style={{ fontSize: 15, padding: '4px 8px' }}>
                    {result.temporaryPassword}
                  </Typography.Text>
                </div>
              }
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="Acceso concedido"
              description={`${result.email} ya dispone de cuenta previa. Se le ha añadido al tenant actual.`}
            />
          )}
          <div className="modal-actions-footer">
            <Button type="primary" block icon={<CheckOutlined />} onClick={handleClose}>
              Aceptar y Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: 'member' }} style={{ marginTop: 16 }}>
          <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email', message: 'Introduce un email válido' }]}>
            <Input placeholder="ejemplo@empresa.com" />
          </Form.Item>

          <Form.Item name="fullName" label="Nombre completo" rules={[{ required: true, message: 'Introduce el nombre completo' }]}>
            <Input placeholder="Ej. Ana Martínez" />
          </Form.Item>

          <Form.Item name="role" label="Rol en la organización" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'member', label: 'Miembro (Acceso a módulos de trabajo)' },
                { value: 'admin', label: 'Administrador (Gestión de usuarios y seats)' },
                { value: 'owner', label: 'Propietario / Owner', disabled: !canGrantOwner },
              ]}
            />
          </Form.Item>

          {/* FOOTER ACTIONS */}
          <div className="modal-actions-footer">
            <Space>
              <Button icon={<CloseOutlined />} onClick={handleClose}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={saving}>
                Invitar miembro
              </Button>
            </Space>
          </div>
        </Form>
      )}
    </Modal>
  );
}
