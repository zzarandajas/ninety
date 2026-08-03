import { CheckOutlined, SafetyCertificateOutlined, LoginOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore, type AuthUser, type TenantMembershipView } from '../store/authStore';

interface LoginResponse {
  token: string;
  user: AuthUser;
  memberships: TenantMembershipView[];
}

const FEATURES = [
  'Rocks y Scorecard alineados a los objetivos trimestrales',
  'Reuniones L10 con agenda y cronómetro integrados',
  'Aislamiento de datos multi-tenant por diseño',
];

function BrandMark({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: { email: string; password: string }) {
    setError(null);
    setSubmitting(true);
    try {
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      login(response);
      navigate(response.user.mustChangePassword ? '/change-password' : '/dashboard');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-visual__glow login-visual__glow--one" />
        <div className="login-visual__glow login-visual__glow--two" />
        <div className="login-visual__pattern" />
        <div className="login-visual__content">
          <div className="login-visual__brand">
            <BrandMark className="login-visual__brand-mark" />
            EOS Tool
          </div>
          <Typography.Title level={2} className="login-visual__headline">
            Alinea a tu equipo. Ejecuta con claridad.
          </Typography.Title>
          <Typography.Paragraph className="login-visual__subtitle">
            La plataforma interna para gestionar Rocks, Scorecard, L10 y Accountability
            Chart
          </Typography.Paragraph>
          <ul className="login-visual__features">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <span className="login-visual__feature-icon">
                  <CheckOutlined />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <div className="login-visual__badge">
            <SafetyCertificateOutlined className="login-visual__badge-icon" />
            <div>
              <span className="login-visual__badge-title">Acceso privado</span>
              <span className="login-visual__badge-subtitle">
                Solo para miembros
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <Card className="login-card">
          <div className="login-card__logo">
            <BrandMark className="login-card__logo-mark" />
            EOS Tool
          </div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            Bienvenido de nuevo
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Inicia sesión para continuar con tu EOS.
          </Typography.Paragraph>
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, message: 'Introduce tu email' }]}
            >
              <Input type="email" autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: 'Introduce tu contraseña' }]}
            >
              <Input.Password autoComplete="current-password" size="large" />
            </Form.Item>
            {error && (
              <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
                {error}
              </Typography.Text>
            )}
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={<LoginOutlined />}
              loading={submitting}
              disabled={submitting}
            >
              Entrar
            </Button>
          </Form>
        </Card>
        <p >© {new Date().getFullYear()} EOS Tool</p>
      </div>
    </div>
  );
}
