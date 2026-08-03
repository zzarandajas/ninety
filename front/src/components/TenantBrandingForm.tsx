import {
  BgColorsOutlined,
  PictureOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { tenantApi, type TenantSettings } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';

const PRESET_BG_COLORS = [
  { label: 'Verde Suave', hex: '#eef7f2' },
  { label: 'Azul Suave', hex: '#f0f4f9' },
  { label: 'Gris Neutro', hex: '#f8fafc' },
  { label: 'Blanco', hex: '#ffffff' },
  { label: 'Oscuro (Dark)', hex: '#0f172a' },
];

const PRESET_ACCENT_COLORS = [
  { label: 'Verde EOS', hex: '#16983c' },
  { label: 'Azul Corporativo', hex: '#1890ff' },
  { label: 'Púrpura', hex: '#722ed1' },
  { label: 'Naranja', hex: '#fa8c16' },
  { label: 'Rojo', hex: '#f5222d' },
];

export function TenantBrandingForm() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIsotype, setUploadingIsotype] = useState(false);

  const updateActiveTenantBranding = useAuthStore((state) => state.updateActiveTenantBranding);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);

  const [form] = Form.useForm();

  const loadSettings = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const data = await tenantApi.getSettings();
      setSettings(data);
      form.setFieldsValue({
        name: data.name,
        timezone: data.timezone,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        bgColor: data.bgColor || '#ffffff',
        accentColor: data.accentColor || '#16983c',
      });
    } catch {
      message.error('No se pudo cargar la configuración de la empresa');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async (values: {
    name: string;
    timezone: string;
    fiscalYearStartMonth: number;
    bgColor: string;
    accentColor: string;
  }) => {
    setSaving(true);
    try {
      const updated = await tenantApi.updateSettings({
        name: values.name.trim(),
        timezone: values.timezone,
        fiscalYearStartMonth: values.fiscalYearStartMonth,
        bgColor: values.bgColor,
        accentColor: values.accentColor,
      });
      setSettings(updated);
      updateActiveTenantBranding({
        name: updated.name,
        bgColor: updated.bgColor,
        accentColor: updated.accentColor,
      });
      message.success('Configuración y personalización guardadas');
    } catch {
      message.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const res = await tenantApi.uploadLogo(file);
      setSettings((prev) => (prev ? { ...prev, logoUrl: res.logoUrl } : prev));
      updateActiveTenantBranding({ logoUrl: res.logoUrl });
      message.success('Logo actualizado correctamente');
    } catch {
      message.error('Error al subir el logo (formato PNG, JPG, WEBP o SVG, máx 5MB)');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadIsotype = async (file: File) => {
    setUploadingIsotype(true);
    try {
      const res = await tenantApi.uploadIsotype(file);
      setSettings((prev) => (prev ? { ...prev, isotypeUrl: res.isotypeUrl } : prev));
      updateActiveTenantBranding({ isotypeUrl: res.isotypeUrl });
      message.success('Isotipo/Isologo actualizado correctamente');
    } catch {
      message.error('Error al subir el isotipo (formato PNG, JPG, WEBP o SVG, máx 5MB)');
    } finally {
      setUploadingIsotype(false);
    }
  };

  if (loading || !settings) {
    return <Card className="glass-card">Cargando personalización...</Card>;
  }

  return (
    <Card className="glass-card" title="Personalización de Marca y Apariencia">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Identidad Visual (Logo e Isotipo) */}
        <div>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            <PictureOutlined /> Identidad Visual
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            Sube el Logo principal e Isotipo/Isologo de la empresa. Se mostrarán en la barra lateral y cabecera de la aplicación.
          </Typography.Paragraph>

          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            {/* Logo Section */}
            <div
              style={{
                padding: 16,
                border: '1px dashed var(--glass-border, #ccc)',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.4)',
              }}
            >
              <Typography.Text strong>Logo Principal</Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                <div
                  style={{
                    width: 140,
                    height: 60,
                    border: '1px solid #eee',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fff',
                    padding: 8,
                  }}
                >
                  {settings.logoUrl ? (
                    <img
                      src={`/api${settings.logoUrl}`}
                      alt="Logo Empresa"
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
                  <Button icon={<UploadOutlined />} loading={uploadingLogo}>
                    Subir Logo
                  </Button>
                </Upload>
              </div>
            </div>

            {/* Isotype Section */}
            <div
              style={{
                padding: 16,
                border: '1px dashed var(--glass-border, #ccc)',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.4)',
              }}
            >
              <Typography.Text strong>Isotipo / Isologo</Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    border: '1px solid #eee',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fff',
                    padding: 8,
                  }}
                >
                  {settings.isotypeUrl ? (
                    <img
                      src={`/api${settings.isotypeUrl}`}
                      alt="Isotipo Empresa"
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
                  <Button icon={<UploadOutlined />} loading={uploadingIsotype}>
                    Subir Isotipo
                  </Button>
                </Upload>
              </div>
            </div>
          </Space>
        </div>

        {/* Colores y Configuración */}
        <div>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            <BgColorsOutlined /> Colores y Configuración
          </Typography.Title>
          <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
            <Form.Item
              label="Nombre de la Empresa"
              name="name"
              rules={[{ required: true, message: 'Ingresa el nombre' }]}
            >
              <Input placeholder="Nombre de la empresa" />
            </Form.Item>

            {/* Color de Fondo */}
            <Form.Item label="Color de Fondo" name="bgColor">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Form.Item name="bgColor" noStyle>
                  <input
                    type="color"
                    style={{
                      width: 42,
                      height: 40,
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onChange={(e) => form.setFieldValue('bgColor', e.target.value)}
                  />
                </Form.Item>
                <Form.Item name="bgColor" noStyle>
                  <Input style={{ width: 120 }} placeholder="#ffffff" />
                </Form.Item>
                <Space wrap size={4}>
                  {PRESET_BG_COLORS.map((preset) => (
                    <Button
                      key={preset.hex}
                      size="small"
                      style={{
                        backgroundColor: preset.hex,
                        borderColor: '#ccc',
                        fontSize: 11,
                        padding: '0 8px',
                      }}
                      onClick={() => form.setFieldValue('bgColor', preset.hex)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </Form.Item>

            {/* Color de Acento */}
            <Form.Item label="Color de Acento (Principal)" name="accentColor">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Form.Item name="accentColor" noStyle>
                  <input
                    type="color"
                    style={{
                      width: 42,
                      height: 40,
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onChange={(e) => form.setFieldValue('accentColor', e.target.value)}
                  />
                </Form.Item>
                <Form.Item name="accentColor" noStyle>
                  <Input style={{ width: 120 }} placeholder="#16983c" />
                </Form.Item>
                <Space wrap size={4}>
                  {PRESET_ACCENT_COLORS.map((preset) => (
                    <Button
                      key={preset.hex}
                      size="small"
                      style={{
                        backgroundColor: preset.hex,
                        color: preset.hex === '#ffffff' ? '#000' : '#fff',
                        fontSize: 11,
                        padding: '0 8px',
                      }}
                      onClick={() => form.setFieldValue('accentColor', preset.hex)}
                    >
                      {preset.label}
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
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                Guardar Configuración
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </Card>
  );
}
