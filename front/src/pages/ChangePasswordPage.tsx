import { Button, Card, Form, Input, Typography } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordPage() {
  const updateUser = useAuthStore((state) => state.updateUser);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    setError(null);
    if (values.newPassword !== values.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      updateUser({ mustChangePassword: false });
      navigate('/dashboard');
    } catch {
      setError('No se pudo actualizar la contraseña. Revisa la contraseña actual.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}>
      <Card className="glass-panel" style={{ width: 400 }}>
        <Typography.Title level={3}>Actualiza tu contraseña</Typography.Title>
        <Typography.Paragraph type="secondary">
          Tu contraseña actual es temporal. Elige una nueva de al menos 10 caracteres,
          con al menos una letra y un número.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Contraseña actual"
            name="currentPassword"
            rules={[{ required: true, message: 'Introduce tu contraseña actual' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Nueva contraseña"
            name="newPassword"
            rules={[{ required: true, message: 'Introduce una nueva contraseña' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Confirma la nueva contraseña"
            name="confirmPassword"
            rules={[{ required: true, message: 'Confirma la nueva contraseña' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          {error && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {error}
            </Typography.Text>
          )}
          <Button type="primary" htmlType="submit" icon={<KeyOutlined />} block loading={submitting} disabled={submitting}>
            Actualizar contraseña
          </Button>
        </Form>
      </Card>
    </div>
  );
}
