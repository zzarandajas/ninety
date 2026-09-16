import { SaveOutlined } from '@ant-design/icons';
import { Button, Form, message, Select, Typography } from 'antd';
import { useEffect } from 'react';
import { RichTextEditor } from '../RichTextEditor';
import { isHtmlEmpty } from '../../lib/richText';
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
  }, [JSON.stringify(document.marketingStrategy), form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({
        marketingStrategy: {
          targetMarket: isHtmlEmpty(values.targetMarket) ? '' : values.targetMarket,
          threeUniques: values.threeUniques ?? [],
          provenProcess: isHtmlEmpty(values.provenProcess) ? '' : values.provenProcess,
          guarantee: isHtmlEmpty(values.guarantee) ? '' : values.guarantee,
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
        <RichTextEditor />
      </Form.Item>
      <Form.Item name='threeUniques' label='The Three Uniques'>
        <Select mode='tags' placeholder='Escribe una diferencia y pulsa Enter' tokenSeparators={[',']} />
      </Form.Item>
      <Form.Item name='provenProcess' label='Proven Process'>
        <RichTextEditor />
      </Form.Item>
      <Form.Item name='guarantee' label='Guarantee'>
        <RichTextEditor />
      </Form.Item>
      <Typography.Paragraph type='secondary'>
        The Three Uniques describe qué os diferencia realmente de la competencia.
      </Typography.Paragraph>
      <Button type='primary' htmlType='submit' icon={<SaveOutlined />}>
        Guardar sección
      </Button>
    </Form>
  );
}
