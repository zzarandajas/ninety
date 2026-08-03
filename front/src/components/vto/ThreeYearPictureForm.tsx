import { SaveOutlined } from '@ant-design/icons';
import { Button, Form, Input, message, Select } from 'antd';
import { useEffect } from 'react';
import { vtoApi, type VTODocument } from '../../lib/vtoApi';

export interface ThreeYearPictureFormProps {
  document: VTODocument;
  onSaved: (doc: VTODocument) => void;
}

interface FormValues {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  lookLikeStatements?: string[];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function ThreeYearPictureForm({ document, onSaved }: ThreeYearPictureFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      futureDate: document.threeYearPicture.futureDate ?? '',
      revenue: document.threeYearPicture.revenue ?? '',
      profit: document.threeYearPicture.profit ?? '',
      measurables: document.threeYearPicture.measurables ?? [],
      lookLikeStatements: document.threeYearPicture.lookLikeStatements ?? [],
    });
  }, [JSON.stringify(document.threeYearPicture), form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({
        threeYearPicture: {
          futureDate: values.futureDate ?? '',
          revenue: values.revenue ?? '',
          profit: values.profit ?? '',
          measurables: values.measurables ?? [],
          lookLikeStatements: values.lookLikeStatements ?? [],
        },
      });
      onSaved(updated);
      message.success('3-Year Picture guardada');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Form form={form} layout='vertical' onFinish={handleSubmit}>
      <Form.Item name='futureDate' label='Fecha futura'>
        <Input placeholder='31/12/2029' />
      </Form.Item>
      <Form.Item name='revenue' label='Ingresos'>
        <Input />
      </Form.Item>
      <Form.Item name='profit' label='Beneficio'>
        <Input />
      </Form.Item>
      <Form.Item name='measurables' label='Medibles'>
        <Select mode='tags' placeholder='Escribe un medible y pulsa Enter' tokenSeparators={[',']} />
      </Form.Item>
      <Form.Item name='lookLikeStatements' label='¿Cómo se ve?'>
        <Select mode='tags' placeholder='Escribe una frase y pulsa Enter' tokenSeparators={[',']} />
      </Form.Item>
      <Button type='primary' htmlType='submit' icon={<SaveOutlined />}>
        Guardar sección
      </Button>
    </Form>
  );
}
