import { Card, Space, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
}

export function KPICard({ title, value, icon, color, loading, onClick }: KPICardProps) {
  return (
    <Card
      className="glass-panel"
      styles={{body:{ padding: 16, cursor: onClick ? 'pointer' : 'default' }}}
      onClick={onClick}
    >
      <Space align="center" size={16}>
        <div className="icon-tile" style={{ color: color || 'var(--brand-green)' }}>
          {icon}
        </div>
        <div>
          <Typography.Text type="secondary" style={{ marginBottom: 4, display: 'block', textTransform: 'uppercase', fontSize: 12, fontWeight: 500 }}>
            {title}
          </Typography.Text>
          <Statistic
            value={value}
            loading={loading}
            valueStyle={{ fontSize: 22, fontWeight: 600, color: 'var(--corp-ink)' }}
          />
        </div>
      </Space>
    </Card>
  );
}
