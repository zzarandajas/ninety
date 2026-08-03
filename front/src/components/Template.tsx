import { Space } from 'antd';
import type { ReactNode } from 'react';
import { usePageHeader } from './pageHeaderContext';

export interface TemplateProps {
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

export function Template({ title, icon, subtitle, extra, children }: TemplateProps) {
  usePageHeader({ title, icon, subtitle });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {extra != null && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{extra}</div>}
      {children}
    </Space>
  );
}
