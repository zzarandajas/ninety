import { Typography } from 'antd';
import type { ReactNode } from 'react';

export interface ModalTitleProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}

export function ModalTitle({ icon, title, subtitle }: ModalTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <div className="icon-tile icon-tile--sm">{icon}</div>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle != null && (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
