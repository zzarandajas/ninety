import * as Icons from '@ant-design/icons';
import { Button, InputNumber, message, Radio, Space, Switch, Table, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { ScorecardMetricFormModal } from '../components/ScorecardMetricFormModal';
import { Template } from '../components/Template';
import { evaluateGoal } from '../lib/evaluateGoal';
import { scorecardApi, type MetricFrequency, type ScorecardEntry, type ScorecardMetric } from '../lib/scorecardApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { lastNMondays, lastNMonths } from '../lib/weeks';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { CustomSection } from '../components/Templates';
import { UserSelect } from '../components/UserSelect';

const STATUS_BG: Record<string, string> = {
  met: 'var(--status-on-track)',
  missed: 'var(--status-off-track)',
  'no-data': 'transparent',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function trendData(entries: ScorecardEntry[], metricId: string, periods: Date[]) {
  return periods
    .map((period) => {
      const iso = period.toISOString();
      const entry = entries.find((e) => e.metricId === metricId && e.periodStart === iso);
      return entry ? { period: iso, value: entry.actualValue } : null;
    })
    .filter((point): point is { period: string; value: number } => point !== null);
}

export function ScorecardPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [metrics, setMetrics] = useState<ScorecardMetric[]>([]);
  const [entries, setEntries] = useState<ScorecardEntry[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [modalMetric, setModalMetric] = useState<ScorecardMetric | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<MetricFrequency | 'all'>('all');
  const tableRef = useRef<HTMLDivElement>(null);

  const filteredMetrics = useMemo(() => {
    if (frequencyFilter === 'all') return metrics;
    return metrics.filter((m) => m.frequency === frequencyFilter);
  }, [metrics, frequencyFilter]);

  function entryFor(metricId: string, period: Date): ScorecardEntry | undefined {
    const iso = period.toISOString();
    return entries.find((entry) => entry.metricId === metricId && entry.periodStart === iso);
  }

  const periods = useMemo(() => {
    if (frequencyFilter === 'monthly') {
      return lastNMonths(12);
    }
    return lastNMondays(12);
  }, [frequencyFilter]);

  // Scroll to the right when data or frequency changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tableRef.current) {
        const scrollable = tableRef.current.querySelector('.ant-table-body, .ant-table-content');
        if (scrollable) {
          scrollable.scrollLeft = scrollable.scrollWidth;
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [filteredMetrics, periods]);

  useEffect(() => {
    scorecardApi
      .listMetrics(showInactive ? {} : { isActive: true })
      .then(setMetrics)
      .catch((e) => message.error(errorMessage(e)));

    scorecardApi
      .listEntries(52) // Load enough data to cover months/weeks
      .then(setEntries)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId, showInactive]);

  useRealtimeSync((event) => {
    if (event.entity === 'scorecard') {
      scorecardApi
        .listMetrics(showInactive ? {} : { isActive: true })
        .then(setMetrics)
        .catch(() => { });
      scorecardApi
        .listEntries(52)
        .then(setEntries)
        .catch(() => { });
    }
  });

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);


  async function saveCell(metricId: string, period: Date, value: number | null) {
    if (value === null) return;
    try {
      const saved = await scorecardApi.upsertEntry(metricId, period, value);
      setEntries((prev) => [...prev.filter((e) => !(e.metricId === metricId && e.periodStart === saved.periodStart)), saved]);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  const columns = [
    {
      title: 'Métrica',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 280,
      render: (name: string, metric: ScorecardMetric) => {
        const owner = members.find((m) => m.userId === metric.ownerUserId);
        const comparisonLabel = metric.comparison === 'gte' ? '≥' : metric.comparison === 'lte' ? '≤' : '=';
        const frequencyLabel = metric.frequency === 'weekly' ? 'Semanal' : 'Mensual';

        return (
          <Space direction="vertical" size={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Space size="small">
                <Icons.BarChartOutlined style={{ color: 'var(--brand-green)' }} />
                <a onClick={() => setModalMetric(metric)} style={{ fontWeight: 600 }}>
                  {name}
                </a>
              </Space>
              <Tag color={metric.frequency === 'monthly' ? 'blue' : 'default'} style={{ fontSize: 9, lineHeight: '14px', height: 16 }}>{frequencyLabel}</Tag>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              Objetivo: {comparisonLabel} {metric.goalValue} {metric.unit}
            </Typography.Text>
            {owner && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Responsable: {owner.fullName}
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    ...periods.map((period) => {
      const isMonthly = frequencyFilter === 'monthly';
      const title = isMonthly
        ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{period.getUTCFullYear()}</div>
            <div style={{ fontWeight: 700 }}>{period.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</div>
          </div>
        )
        : period.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

      return {
        title,
        key: period.toISOString(),
        width: 110, // Increased width for inputs
        render: (_: unknown, metric: ScorecardMetric) => {
          const entry = entryFor(metric.id, period);
          const status = evaluateGoal(entry?.actualValue ?? null, metric.goalValue, metric.comparison);
          return (
            <InputNumber
              value={entry?.actualValue ?? null}
              style={{ width: '100%', background: STATUS_BG[status], borderRadius: 4 }}
              onBlur={(e) => {
                const raw = e.target.value;
                const parsed = raw === '' ? null : Number(raw.replace(',', '.'));
                saveCell(metric.id, period, parsed);
              }}
            />
          );
        },
      };
    }),
    {
      title: 'Media',
      key: 'average',
      fixed: 'right' as const,
      width: 90,
      render: (_: unknown, metric: ScorecardMetric) => {
        const data = trendData(entries, metric.id, periods);
        if (data.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;
        const avg = data.reduce((sum, p) => sum + p.value, 0) / data.length;
        return (
          <Typography.Text strong style={{ color: 'var(--brand-green)' }}>
            {avg.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
          </Typography.Text>
        );
      },
    },
    {
      title: 'Tendencia',
      key: 'trend',
      fixed: 'right' as const,
      width: 120,
      render: (_: unknown, metric: ScorecardMetric) => (
        <div data-testid={`trend-${metric.id}`} style={{ width: 100, height: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData(entries, metric.id, periods)}>
              <Line type="monotone" dataKey="value" stroke="#16983c" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
  ];

  return (
    <Template
      title="Scorecard"
      icon={<Icons.BarChartOutlined />}
      subtitle="Métricas del cuadro de mando: objetivo, tendencia y avance."
      extra={
        <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => setModalMetric('new')}>
          Nueva métrica
        </Button>
      }
    >


      <CustomSection
        titulo={'Filtros'}
        icon={<Icons.FilterOutlined />}
        extra={
          <Space align="center" wrap>
            <Radio.Group value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value)} size="middle">
              <Radio.Button value="all">Todas (Sem.)</Radio.Button>
              <Radio.Button value="weekly">Semanales</Radio.Button>
              <Radio.Button value="monthly">Mensuales</Radio.Button>
            </Radio.Group>
            <div style={{ width: 16 }} />
            <Space align="center">
              <Switch checked={showInactive} onChange={setShowInactive} aria-label="Mostrar inactivas" />
              <Typography.Text>Mostrar inactivas</Typography.Text>
            </Space>
          </Space>
        }
      >
        <div ref={tableRef}>
          <Table
            className="glass-panel"
            dataSource={filteredMetrics}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1500 }} // Increased x scroll for better visibility
          />
        </div>

      </CustomSection>


      {modalMetric && (
        <ScorecardMetricFormModal
          open
          metric={modalMetric === 'new' ? undefined : modalMetric}
          members={members}
          onClose={() => setModalMetric(null)}
          onSaved={() => {
            setModalMetric(null);
            scorecardApi.listMetrics(showInactive ? {} : { isActive: true }).then(setMetrics);
          }}
        />
      )}
    </Template>
  );
}
