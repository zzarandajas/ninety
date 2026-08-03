import { SaveOutlined } from '@ant-design/icons';
import { Button, Form, Input, message, Typography } from 'antd';
import { useEffect } from 'react';
import { vtoApi, type VTODocument } from '../../lib/vtoApi';

export interface CoreFocusFormProps {
  document: VTODocument;
  onSaved: (doc: VTODocument) => void;
}

interface FormValues {
  coreFocusPurpose?: string;
  coreFocusNiche?: string;
  tenYearTarget?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function CoreFocusForm({ document, onSaved }: CoreFocusFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      coreFocusPurpose: document.coreFocusPurpose ?? undefined,
      coreFocusNiche: document.coreFocusNiche ?? undefined,
      tenYearTarget: document.tenYearTarget ?? undefined,
    });
  }, [document.coreFocusPurpose, document.coreFocusNiche, document.tenYearTarget, form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({
        coreFocusPurpose: values.coreFocusPurpose ?? null,
        coreFocusNiche: values.coreFocusNiche ?? null,
        tenYearTarget: values.tenYearTarget ?? null,
      });
      onSaved(updated);
      message.success('Core Focus guardado');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Typography.Title level={5}>Core Focus</Typography.Title>
      <Form.Item name="coreFocusPurpose" label="Propósito / Causa / Pasión">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="coreFocusNiche" label="Nicho">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        10-Year Target
      </Typography.Title>
      <Form.Item name="tenYearTarget" label="Objetivo a 10 años">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
        Guardar sección
      </Button>
    </Form>
  );
}
