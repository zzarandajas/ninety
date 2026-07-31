import { Button, Form, Input, message, Select, Typography } from 'antd';
import { useEffect } from 'react';
import { vtoApi, type VTODocument } from '../../lib/vtoApi';

export interface MarketingStrategyFormProps {
  document: VTODocument;
  onSaved: (doc: VTODocument) => void;
}

interface FormValues {
  targetMarket?: string;
  threeUniques?: string[];
  provenProcess?: string;
  guarantee?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function MarketingStrategyForm({ document, onSaved }: MarketingStrategyFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      targetMarket: document.marketingStrategy.targetMarket ?? '',
      threeUniques: document.marketingStrategy.threeUniques ?? [],
      provenProcess: document.marketingStrategy.provenProcess ?? '',
      guarantee: document.marketingStrategy.guarantee ?? '',
    });
  }, [document, form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({
        marketingStrategy: {
          targetMarket: values.targetMarket ?? '',
          threeUniques: values.threeUniques ?? [],
          provenProcess: values.provenProcess ?? '',
          guarantee: values.guarantee ?? '',
        },
      });
      onSaved(updated);
      message.success('Marketing Strategy guardada');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Form form={form} layout='vertical' onFinish={handleSubmit}>
      <Form.Item name='targetMarket' label='Target Market ("The List")'>
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name='threeUniques' label='The Three Uniques'>
        <Select mode='tags' placeholder='Escribe una diferencia y pulsa Enter' tokenSeparators={[',']} />
      </Form.Item>
      <Form.Item name='provenProcess' label='Proven Process'>
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name='guarantee' label='Guarantee'>
        <Input.TextArea rows={2} />
      </Form.Item>
      <Typography.Paragraph type='secondary'>
        The Three Uniques describe qué os diferencia realmente de la competencia.
      </Typography.Paragraph>
      <Button type='primary' htmlType='submit'>
        Guardar sección
      </Button>
    </Form>
  );
}
