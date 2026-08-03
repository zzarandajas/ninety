import { CompassOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, message, Skeleton, Space, Tabs } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { CoreFocusForm } from '../components/vto/CoreFocusForm';
import { CoreValuesForm } from '../components/vto/CoreValuesForm';
import { MarketingStrategyForm } from '../components/vto/MarketingStrategyForm';
import { OneYearPlanForm } from '../components/vto/OneYearPlanForm';
import { ThreeYearPictureForm } from '../components/vto/ThreeYearPictureForm';
import { VTOPrintView } from '../components/vto/VTOPrintView';
import { Template } from '../components/Template';
import { rocksApi, type Rock } from '../lib/rocksApi';
import { vtoApi, type VTODocument } from '../lib/vtoApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function VTOPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [document, setDocument] = useState<VTODocument | null>(null);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [mode, setMode] = useState<'edit' | 'print'>('edit');

  const refetch = useCallback(() => {
    Promise.all([vtoApi.get(), rocksApi.list()])
      .then(([doc, allRocks]) => {
        setDocument(doc);
        setRocks(allRocks);
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'vto' || event.entity === 'rock') {
      refetch();
    }
  });

  if (!document) return <Skeleton active />;

  const companyRocks = rocks.filter((rock) => rock.isCompanyRock);

  if (mode === 'print') {
    return (
      <>
        <Space className='no-print' style={{ marginBottom: 16 }}>
          <Button icon={<EditOutlined />} onClick={() => setMode('edit')}>Volver a editar</Button>
          <Button type='primary' icon={<PrinterOutlined />} onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
        </Space>
        <VTOPrintView document={document} companyRocks={companyRocks} />
      </>
    );
  }

  return (
    <Template
      title="V/TO"
      icon={<CompassOutlined />}
      subtitle="Vision/Traction Organizer: identidad y dirección de la empresa."
      extra={
        <Button icon={<PrinterOutlined />} onClick={() => setMode('print')}>
          Imprimir vista previa
        </Button>
      }
    >
      <Tabs
        items={[
          { key: 'core-values', label: 'Core Values', children: <CoreValuesForm document={document} onSaved={setDocument} /> },
          { key: 'core-focus', label: 'Core Focus', children: <CoreFocusForm document={document} onSaved={setDocument} /> },
          {
            key: 'marketing-strategy',
            label: 'Marketing Strategy',
            children: <MarketingStrategyForm document={document} onSaved={setDocument} />,
          },
          {
            key: 'three-year-picture',
            label: '3-Year Picture',
            children: <ThreeYearPictureForm document={document} onSaved={setDocument} />,
          },
          {
            key: 'one-year-plan',
            label: '1-Year Plan',
            children: <OneYearPlanForm document={document} companyRocks={companyRocks} onSaved={setDocument} />,
          },
        ]}
      />
    </Template>
  );
}
