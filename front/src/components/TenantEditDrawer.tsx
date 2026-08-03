import {
  BgColorsOutlined,
  CloseOutlined,
  PictureOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { adminApi, type AdminTenant } from '../lib/adminApi';
import { profileApi } from '../lib/profileApi';
import { slugify } from '../lib/slugify';
import { useAuthStore } from '../store/authStore';

const PRESET_BG_COLORS = [
  { label: 'Verde Suave', hex: '#eef7f2' },
  { label: 'Azul Suave', hex: '#f0f4f9' },
  { label: 'Gris Neutro', hex: '#f8fafc' },
  { label: 'Blanco', hex: '#ffffff' },
  { label: 'Oscuro', hex: '#0f172a' },
];

const PRESET_ACCENT_COLORS = [
  { label: 'Verde EOS', hex: '#16983c' },
  { label: 'Azul Corporativo', hex: '#1890ff' },
  { label: 'Púrpura', hex: '#722ed1' },
  { label: 'Naranja', hex: '#fa8c16' },
  { label: 'Rojo', hex: '#f5222d' },
];

export interface TenantEditDrawerProps {
  tenant: AdminTenant | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function TenantEditDrawer({ tenant, onClose, onUpdated }: TenantEditDrawerProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIsotype, setUploadingIsotype] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isotypeUrl, setIsotypeUrl] = useState<string | null>(null);

  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const updateActiveTenantBranding = useAuthStore((state) => state.updateActiveTenantBranding);

  useEffect(() => {
    if (tenant) {
      form.setFieldsValue({
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        fiscalYearStartMonth: tenant.fiscalYearStartMonth || 1,
        bgColor: tenant.bgColor || '#ffffff',
        accentColor: tenant.accentColor || '#16983c',
      });
      setLogoUrl(tenant.logoUrl ?? null);
      setIsotypeUrl(tenant.isotypeUrl ?? null);
    }
  }, [tenant, form]);

  const handleSave = async (values: {
    name: string;
    timezone: string;
    fiscalYearStartMonth: number;
    bgColor: string;
    accentColor: string;
  }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateTenant(tenant.id, {
        name: values.name.trim(),
        timezone: values.timezone,
        fiscalYearStartMonth: values.fiscalYearStartMonth,
        bgColor: values.bgColor,
        accentColor: values.accentColor,
      });

      message.success('Empresa y personalización actualizadas');

      if (tenant.id === activeTenantId) {
        updateActiveTenantBranding({
          name: updated.name,
          bgColor: updated.bgColor,
          accentColor: updated.accentColor,
        });
      }

      // Refresh memberships in authStore
      const meData = await profileApi.getMe();
      useAuthStore.setState({ tenants: meData.memberships });

      onUpdated();
      onClose();
    } catch {
      message.error('No se pudo actualizar la empresa');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!tenant) return;
    setUploadingLogo(true);
    try {
      const res = await adminApi.uploadTenantLogo(tenant.id, file);
      setLogoUrl(res.logoUrl);
      if (tenant.id === activeTenantId) {
        updateActiveTenantBranding({ logoUrl: res.logoUrl });
      }
      message.success('Logo actualizado');
      onUpdated();
    } catch {
      message.error('Error al subir el logo (formato PNG, JPG, WEBP o SVG, máx 5MB)');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadIsotype = async (file: File) => {
    if (!tenant) return;
    setUploadingIsotype(true);
    try {
      const res = await adminApi.uploadTenantIsotype(tenant.id, file);
      setIsotypeUrl(res.isotypeUrl);
      if (tenant.id === activeTenantId) {
        updateActiveTenantBranding({ isotypeUrl: res.isotypeUrl });
      }
      message.success('Isotipo actualizado');
      onUpdated();
    } catch {
      message.error('Error al subir el isotipo (formato PNG, JPG, WEBP o SVG, máx 5MB)');
    } finally {
      setUploadingIsotype(false);
    }
  };

  return (
    <Drawer
      title={tenant ? `Personalización y Marca: ${tenant.name}` : 'Editar Empresa'}
      width={560}
      open={!!tenant}
      onClose={onClose}
      destroyOnHidden 
    >
      {tenant && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Marca / Identidad */}
          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              <PictureOutlined /> Identidad Visual
            </Typography.Title>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* Logo */}
              <div
                style={{
                  padding: 12,
                  border: '1px dashed #ccc',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                <Typography.Text strong style={{ fontSize: 13 }}>
                  Logo Principal
                </Typography.Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  <div
                    style={{
                      width: 120,
                      height: 50,
                      border: '1px solid #eee',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#fff',
                      padding: 6,
                    }}
                  >
                    {logoUrl ? (
                      <img
                        src={`/api${logoUrl}`}
                        alt="Logo"
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Sin logo
                      </Typography.Text>
                    )}
                  </div>
                  <Upload
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleUploadLogo(file);
                      return false;
                    }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  >
                    <Button size="small" icon={<UploadOutlined />} loading={uploadingLogo}>
                      Subir Logo
                    </Button>
                  </Upload>
                </div>
              </div>

              {/* Isotype */}
              <div
                style={{
                  padding: 12,
                  border: '1px dashed #ccc',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                <Typography.Text strong style={{ fontSize: 13 }}>
                  Isotipo / Isologo
                </Typography.Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      border: '1px solid #eee',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#fff',
                      padding: 6,
                    }}
                  >
                    {isotypeUrl ? (
                      <img
                        src={`/api${isotypeUrl}`}
                        alt="Isotipo"
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Sin isologo
                      </Typography.Text>
                    )}
                  </div>
                  <Upload
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleUploadIsotype(file);
                      return false;
                    }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  >
                    <Button size="small" icon={<UploadOutlined />} loading={uploadingIsotype}>
                      Subir Isotipo
                    </Button>
                  </Upload>
                </div>
              </div>
            </Space>
          </div>

          {/* Formulario de Configuración */}
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              <BgColorsOutlined /> Datos y Paleta de Colores
            </Typography.Title>

            <Form.Item
              label="Nombre de la Empresa"
              name="name"
              rules={[{ required: true, message: 'Ingresa el nombre' }]}
            >
              <Input placeholder="Nombre de la empresa" />
            </Form.Item>

            {/* Color de Fondo */}
            <Form.Item label="Color de Fondo" name="bgColor">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Form.Item name="bgColor" noStyle>
                  <input
                    type="color"
                    style={{
                      width: 36,
                      height: 36,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onChange={(e) => form.setFieldValue('bgColor', e.target.value)}
                  />
                </Form.Item>
                <Form.Item name="bgColor" noStyle>
                  <Input style={{ width: 110 }} placeholder="#ffffff" />
                </Form.Item>
                <Space wrap size={4}>
                  {PRESET_BG_COLORS.map((p) => (
                    <Button
                      key={p.hex}
                      size="small"
                      style={{
                        backgroundColor: p.hex,
                        borderColor: '#ccc',
                        fontSize: 10,
                        padding: '0 6px',
                      }}
                      onClick={() => form.setFieldValue('bgColor', p.hex)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </Form.Item>

            {/* Color de Acento */}
            <Form.Item label="Color de Acento (Principal)" name="accentColor">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Form.Item name="accentColor" noStyle>
                  <input
                    type="color"
                    style={{
                      width: 36,
                      height: 36,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onChange={(e) => form.setFieldValue('accentColor', e.target.value)}
                  />
                </Form.Item>
                <Form.Item name="accentColor" noStyle>
                  <Input style={{ width: 110 }} placeholder="#16983c" />
                </Form.Item>
                <Space wrap size={4}>
                  {PRESET_ACCENT_COLORS.map((p) => (
                    <Button
                      key={p.hex}
                      size="small"
                      style={{
                        backgroundColor: p.hex,
                        color: p.hex === '#ffffff' ? '#000' : '#fff',
                        fontSize: 10,
                        padding: '0 6px',
                      }}
                      onClick={() => form.setFieldValue('accentColor', p.hex)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </Form.Item>

            <Form.Item label="Zona Horaria" name="timezone">
              <Select>
                <Select.Option value="Europe/Madrid">Europe/Madrid</Select.Option>
                <Select.Option value="UTC">UTC</Select.Option>
                <Select.Option value="America/New_York">America/New_York</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Mes de Inicio del Año Fiscal" name="fiscalYearStartMonth">
              <InputNumber min={1} max={12} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button icon={<CloseOutlined />} onClick={onClose}>Cancelar</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  Guardar Cambios
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}
    </Drawer>
  );
}
