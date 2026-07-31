import { Button, Form, Input, message, Select } from 'antd';
import { useEffect } from 'react';
import type { Rock } from '../../lib/rocksApi';
import { vtoApi, type VTODocument } from '../../lib/vtoApi';

export interface OneYearPlanFormProps {
  document: VTODocument;
  companyRocks: Rock[];
  onSaved: (doc: VTODocument) => void;
}

interface FormValues {
  futureDate?: string;
  revenue?: string;
  profit?: string;
  measurables?: string[];
  goals?: string[];
  companyRockIds?: string[];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function OneYearPlanForm({ document, companyRocks, onSaved }: OneYearPlanFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      futureDate: document.oneYearPlan.futureDate ?? '',
      revenue: document.oneYearPlan.revenue ?? '',
      profit: document.oneYearPlan.profit ?? '',
      measurables: document.oneYearPlan.measurables ?? [],
      goals: document.oneYearPlan.goals ?? [],
      companyRockIds: document.oneYearPlan.companyRockIds ?? [],
    });
  }, [document, form]);

  async function handleSubmit(values: FormValues) {
    try {
      const updated = await vtoApi.update({
        oneYearPlan: {
          futureDate: values.futureDate ?? '',
          revenue: values.revenue ?? '',
          profit: values.profit ?? '',
          measurables: values.measurables ?? [],
          goals: values.goals ?? [],
          companyRockIds: values.companyRockIds ?? [],
        },
      });
      onSaved(updated);
      message.success('1-Year Plan guardado');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item name="futureDate" label="Fecha futura">
        <Input placeholder="31/12/2026" />
      </Form.Item>
      <Form.Item name="revenue" label="Ingresos">
        <Input />
      </Form.Item>
      <Form.Item name="profit" label="Beneficio">
        <Input />
      </Form.Item>
      <Form.Item name="measurables" label="Medibles">
        <Select mode="tags" placeholder="Escribe un medible y pulsa Enter" tokenSeparators={[',']} />
      </Form.Item>
      <Form.Item name="goals" label="Objetivos del año">
        <Select mode="tags" placeholder="Escribe un objetivo y pulsa Enter" tokenSeparators={[',']} />
      </Form.Item>
      <Form.Item name="companyRockIds" label="Company Rocks del año">
        <Select
          mode="multiple"
          placeholder="Selecciona los Company Rocks vinculados"
          options={companyRocks.map((rock) => ({ value: rock.id, label: `${rock.title} (${rock.quarter})` }))}
        />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        Guardar sección
      </Button>
    </Form>
  );
}
