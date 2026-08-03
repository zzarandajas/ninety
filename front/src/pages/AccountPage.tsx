import { KeyOutlined, SaveOutlined, UserOutlined, BankOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, List, Tag, Typography, message, Space, Divider, Row, Col } from 'antd';
import { useState } from 'react';
import { AvatarUploader } from '../components/AvatarUploader';
import { Template } from '../components/Template';
import { profileApi } from '../lib/profileApi';
import { useAuthStore } from '../store/authStore';

export function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const tenants = useAuthStore((state) => state.tenants);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleSaveProfile(values: { fullName: string }) {
    setSavingProfile(true);
    try {
      const res = await profileApi.updateProfile({ fullName: values.fullName.trim() });
      updateUser({ fullName: res.user.fullName });
      message.success('Perfil actualizado correctamente');
    } catch {
      message.error('No se pudo actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(values: { currentPassword: string; newPassword: string }) {
    setChangingPassword(true);
    try {
      await profileApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('Contraseña cambiada correctamente');
      passwordForm.resetFields();
    } catch {
      message.error('Contraseña actual incorrecta o la nueva contraseña no cumple los requisitos');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Template title="Mi Cuenta" icon={<UserOutlined />} subtitle="Gestiona tu perfil, tus empresas y tu contraseña.">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Row gutter={[24, 24]}>
          {/* Columna Izquierda: Perfil y Empresas */}
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              {/* Perfil de Usuario */}
              <Card
                className="glass-card"
                title={
                  <Space>
                    <UserOutlined /> Datos Personales
                  </Space>
                }
              >
                <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <AvatarUploader />
                    <div style={{ textAlign: 'center' }}>
                      <Typography.Text strong style={{ display: 'block' }}>
                        Foto de Perfil
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        PNG, JPG o WEBP (&lt;2MB)
                      </Typography.Text>
                    </div>
                  </div>

                  <Form
                    form={profileForm}
                    layout="vertical"
                    initialValues={{ fullName: user?.fullName, email: user?.email }}
                    onFinish={handleSaveProfile}
                    style={{ flex: 1, minWidth: 280 }}
                  >
                    <Form.Item label="Correo Electrónico" name="email">
                      <Input prefix={<MailOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />} disabled />
                    </Form.Item>

                    <Form.Item
                      label="Nombre Completo"
                      name="fullName"
                      rules={[{ required: true, message: 'Ingresa tu nombre completo' }]}
                    >
                      <Input placeholder="Tu nombre" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingProfile} block>
                        Guardar Cambios
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              </Card>

              {/* Mis Empresas / Membresías */}
              <Card
                className="glass-card"
                title={
                  <Space>
                    <BankOutlined /> Mis Empresas
                  </Space>
                }
              >
                <List
                  dataSource={tenants}
                  renderItem={(tenant) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<div className="icon-tile icon-tile--sm"><BankOutlined /></div>}
                        title={tenant.tenantName}
                        description={`Slug: ${tenant.tenantSlug}`}
                      />
                      <Tag color={tenant.role === 'owner' ? 'gold' : tenant.role === 'admin' ? 'blue' : 'default'}>
                        {tenant.role.toUpperCase()}
                      </Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Col>

          {/* Columna Derecha: Contraseña */}
          <Col xs={24} lg={10}>
            <Card
              className="glass-card"
              title={
                <Space>
                  <KeyOutlined /> Seguridad
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                Asegúrate de usar una contraseña fuerte para proteger tu cuenta.
              </Typography.Paragraph>

              <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
                <Form.Item
                  label="Contraseña Actual"
                  name="currentPassword"
                  rules={[{ required: true, message: 'Ingresa tu contraseña actual' }]}
                >
                  <Input.Password placeholder="••••••••" />
                </Form.Item>

                <Divider style={{ margin: '16px 0' }} />

                <Form.Item
                  label="Nueva Contraseña"
                  name="newPassword"
                  rules={[
                    { required: true, message: 'Ingresa la nueva contraseña' },
                    { min: 10, message: 'Mínimo 10 caracteres' },
                    {
                      pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                      message: 'Debe contener al menos una letra y un número',
                    },
                  ]}
                >
                  <Input.Password placeholder="Nueva contraseña" />
                </Form.Item>

                <Form.Item
                  label="Confirmar Nueva Contraseña"
                  name="confirmPassword"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Confirma la nueva contraseña' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Las contraseñas no coinciden'));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="Repite la contraseña" />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                  <Button type="primary" htmlType="submit" icon={<KeyOutlined />} loading={changingPassword} block>
                    Actualizar Contraseña
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </Template>
  );
}
