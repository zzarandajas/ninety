import { BarChartOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, InputNumber, message, Space, Switch, Table, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { ScorecardMetricFormModal } from '../components/ScorecardMetricFormModal';
import { Template } from '../components/Template';
import { evaluateGoal } from '../lib/evaluateGoal';
import { scorecardApi, type ScorecardEntry, type ScorecardMetric } from '../lib/scorecardApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { lastNMondays } from '../lib/weeks';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const STATUS_BG: Record<string, string> = {
  met: 'var(--status-on-track)',
  missed: 'var(--status-off-track)',
  'no-data': 'transparent',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function trendData(entries: ScorecardEntry[], metricId: string, weeks: Date[]) {
  return weeks
    .map((week) => {
      const iso = week.toISOString();
      const entry = entries.find((e) => e.metricId === metricId && e.periodStart === iso);
      return entry ? { week: iso, value: entry.actualValue } : null;
    })
    .filter((point): point is { week: string; value: number } => point !== null);
}

export function ScorecardPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [metrics, setMetrics] = useState<ScorecardMetric[]>([]);
  const [entries, setEntries] = useState<ScorecardEntry[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [modalMetric, setModalMetric] = useState<ScorecardMetric | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const weeks = useMemo(() => lastNMondays(12), []);

  useEffect(() => {
    scorecardApi
      .listMetrics(showInactive ? {} : { isActive: true })
      .then(setMetrics)
      .catch((e) => message.error(errorMessage(e)));
    scorecardApi
      .listEntries(12)
      .then(setEntries)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId, showInactive]);

  useRealtimeSync((event) => {
    if (event.entity === 'scorecard') {
      scorecardApi
        .listMetrics(showInactive ? {} : { isActive: true })
        .then(setMetrics)
        .catch(() => {});
      scorecardApi
        .listEntries(12)
        .then(setEntries)
        .catch(() => {});
    }
  });

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  function entryFor(metricId: string, week: Date): ScorecardEntry | undefined {
    const iso = week.toISOString();
    return entries.find((entry) => entry.metricId === metricId && entry.periodStart === iso);
  }

  async function saveCell(metricId: string, week: Date, value: number | null) {
    if (value === null) return;
    try {
      const saved = await scorecardApi.upsertEntry(metricId, week, value);
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
      width: 250,
      render: (name: string, metric: ScorecardMetric) => {
        const owner = members.find((m) => m.userId === metric.ownerUserId);
        const comparisonLabel = metric.comparison === 'gte' ? '≥' : metric.comparison === 'lte' ? '≤' : '=';
        
        return (
          <Space direction="vertical" size={0}>
            <a onClick={() => setModalMetric(metric)} style={{ fontWeight: 600 }}>
              {name}
            </a>
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
    ...weeks.map((week) => ({
      title: week.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      key: week.toISOString(),
      width: 90,
      render: (_: unknown, metric: ScorecardMetric) => {
        const entry = entryFor(metric.id, week);
        const status = evaluateGoal(entry?.actualValue ?? null, metric.goalValue, metric.comparison);
        return (
          <InputNumber
            value={entry?.actualValue ?? null}
            style={{ width: '100%', background: STATUS_BG[status] }}
            onBlur={(e) => {
              const raw = e.target.value;
              const parsed = raw === '' ? null : Number(raw);
              saveCell(metric.id, week, parsed);
            }}
          />
        );
      },
    })),
    {
      title: 'Media',
      key: 'average',
      fixed: 'right' as const,
      width: 80,
      render: (_: unknown, metric: ScorecardMetric) => {
        const data = trendData(entries, metric.id, weeks);
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
            <LineChart data={trendData(entries, metric.id, weeks)}>
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
      icon={<BarChartOutlined />}
      subtitle="Métricas semanales del cuadro de mando: objetivo, tendencia y avance."
      extra={
        <Space align="center" wrap>
          <Space align="center">
            <Switch checked={showInactive} onChange={setShowInactive} aria-label="Mostrar inactivas" />
            <Typography.Text>Mostrar inactivas</Typography.Text>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalMetric('new')}>
            Nueva métrica
          </Button>
        </Space>
      }
    >
      <Table
        className="glass-panel"
        dataSource={metrics}
        columns={columns}
        rowKey="id"
        pagination={false}
        scroll={{ x: true }}
      />

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
