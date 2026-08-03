import { SaveOutlined } from '@ant-design/icons';
import { Button, Form, message, Select, Typography } from 'antd';
import { useEffect } from 'react';
import { vtoApi, type VTODocument } from '../../lib/vtoApi';

export interface CoreValuesFormProps {
  document: VTODocument;
  onSaved: (doc: VTODocument) => void;
}

interface FormValues {
  coreValues: string[];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function CoreValuesForm({ document, onSaved }: CoreValuesFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({ coreValues: document.coreValues });
  }, [JSON.stringify(document.coreValues), form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({ coreValues: values.coreValues ?? [] });
      onSaved(updated);
      message.success('Core Values guardados');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Typography.Paragraph type="secondary">
        Los valores fundamentales que definen quiénes somos, no lo que hacemos.
      </Typography.Paragraph>
      <Form.Item name="coreValues" label="Core Values">
        <Select mode="tags" placeholder="Escribe un valor y pulsa Enter" tokenSeparators={[',']} />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
        Guardar sección
      </Button>
    </Form>
  );
}
