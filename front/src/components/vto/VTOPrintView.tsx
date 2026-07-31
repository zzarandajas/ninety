import { Typography } from 'antd';
import type { Rock } from '../../lib/rocksApi';
import type { VTODocument } from '../../lib/vtoApi';

export interface VTOPrintViewProps {
  document: VTODocument;
  companyRocks: Rock[];
}

function ListOrDash({ items }: { items: string[] }) {
  if (items.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function VTOPrintView({ document, companyRocks }: VTOPrintViewProps) {
  const linkedRocks = document.oneYearPlan.companyRockIds
    ? companyRocks.filter((rock) => document.oneYearPlan.companyRockIds?.includes(rock.id))
    : [];

  return (
    <div className="vto-print-view">
      <Typography.Title level={3}>Core Values</Typography.Title>
      <ListOrDash items={document.coreValues} />

      <Typography.Title level={3}>Core Focus</Typography.Title>
      <Typography.Paragraph>
        <strong>Propósito:</strong> {document.coreFocusPurpose || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>Nicho:</strong> {document.coreFocusNiche || '—'}
      </Typography.Paragraph>

      <Typography.Title level={3}>10-Year Target</Typography.Title>
      <Typography.Paragraph>{document.tenYearTarget || '—'}</Typography.Paragraph>

      <Typography.Title level={3}>Marketing Strategy</Typography.Title>
      <Typography.Paragraph>
        <strong>Target Market:</strong> {document.marketingStrategy.targetMarket || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>Three Uniques:</strong>
      </Typography.Paragraph>
      <ListOrDash items={document.marketingStrategy.threeUniques ?? []} />
      <Typography.Paragraph>
        <strong>Proven Process:</strong> {document.marketingStrategy.provenProcess || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>Guarantee:</strong> {document.marketingStrategy.guarantee || '—'}
      </Typography.Paragraph>

      <Typography.Title level={3}>3-Year Picture</Typography.Title>
      <Typography.Paragraph>
        <strong>Fecha:</strong> {document.threeYearPicture.futureDate || '—'} | <strong>Ingresos:</strong> {document.threeYearPicture.revenue || '—'} | <strong>Beneficio:</strong> {document.threeYearPicture.profit || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>Medibles:</strong>
      </Typography.Paragraph>
      <ListOrDash items={document.threeYearPicture.measurables ?? []} />
      <Typography.Paragraph>
        <strong>¿Cómo se ve?:</strong>
      </Typography.Paragraph>
      <ListOrDash items={document.threeYearPicture.lookLikeStatements ?? []} />

      <Typography.Title level={3}>1-Year Plan</Typography.Title>
      <Typography.Paragraph>
        <strong>Fecha:</strong> {document.oneYearPlan.futureDate || '—'} | <strong>Ingresos:</strong> {document.oneYearPlan.revenue || '—'} | <strong>Beneficio:</strong> {document.oneYearPlan.profit || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>Medibles:</strong>
      </Typography.Paragraph>
      <ListOrDash items={document.oneYearPlan.measurables ?? []} />
      <Typography.Paragraph>
        <strong>Objetivos del año:</strong>
      </Typography.Paragraph>
      <ListOrDash items={document.oneYearPlan.goals ?? []} />
      <Typography.Paragraph>
        <strong>Company Rocks:</strong>
      </Typography.Paragraph>
      <ListOrDash items={linkedRocks.map((rock) => `${rock.title} (${rock.quarter})`)} />
    </div>
  );
}
