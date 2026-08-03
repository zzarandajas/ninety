import { ReloadOutlined } from '@ant-design/icons';
import { Button, Progress, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';

export interface AgendaSectionProps {
  title: string;
  targetMinutes: number;
  active: boolean;
  onActivate: () => void;
  onReset?: () => void;
  description?: string;
  children: ReactNode;
  // Timer persistence props
  initialSeconds?: number;
  timerStartedAt?: string | null;
  isPaused?: boolean;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function AgendaSection({ 
  title, 
  targetMinutes, 
  active, 
  onActivate, 
  onReset,
  description, 
  children,
  initialSeconds = 0,
  timerStartedAt = null,
  isPaused = false
}: AgendaSectionProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (active) {
      if (isPaused || !timerStartedAt) {
        setSeconds(initialSeconds);
      } else {
        const elapsed = dayjs().diff(dayjs(timerStartedAt), 'second');
        setSeconds(initialSeconds + (elapsed > 0 ? elapsed : 0));
      }
    } else {
      setSeconds(0);
    }
  }, [active, initialSeconds, timerStartedAt, isPaused]);

  useEffect(() => {
    if (!active || isPaused || !timerStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = dayjs().diff(dayjs(timerStartedAt), 'second');
      setSeconds(initialSeconds + (elapsed > 0 ? elapsed : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, isPaused, timerStartedAt, initialSeconds]);

  const targetSeconds = targetMinutes * 60;
  const overTarget = seconds >= targetSeconds;
  const progressPercent = Math.min(100, Math.round((seconds / targetSeconds) * 100));

  let progressColor = 'var(--brand-green)';
  if (progressPercent > 80 && !overTarget) progressColor = '#fa8c16'; // warning orange
  if (overTarget) progressColor = '#ff4d4f'; // danger red

  return (
    <div className={`agenda-section ${active ? 'agenda-section--active' : 'agenda-section--collapsed'}`}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={active ? undefined : onActivate}
      >
        <Space align="center" size="middle">
          <Typography.Text strong style={{ fontSize: 16 }}>
            {title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ⏱ Target: {targetMinutes} min
          </Typography.Text>
        </Space>

        {active ? (
          <Space align="center">
            <Typography.Text
              type={overTarget ? 'danger' : 'secondary'}
              style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 14 }}
            >
              {formatTime(seconds)} / {targetMinutes}:00
            </Typography.Text>
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReset}>
              Reiniciar
            </Button>
          </Space>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Hacer clic para activar sección →
          </Typography.Text>
        )}
      </div>

      {active && (
        <>
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <Progress
              percent={progressPercent}
              showInfo={false}
              strokeColor={progressColor}
              size="small"
              style={{ margin: 0 }}
            />
          </div>

          {description && (
            <div
              style={{
                background: 'rgba(22, 152, 60, 0.06)',
                borderLeft: '4px solid var(--brand-green)',
                padding: '10px 14px',
                borderRadius: '4px 12px 12px 4px',
                marginBottom: 16,
              }}
            >
              <Typography.Text
                style={{
                  fontSize: 11,
                  display: 'block',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--brand-green-dark)',
                  marginBottom: 2,
                }}
              >
                💡 Objetivo y Reglas de la Sección
              </Typography.Text>
              <Typography.Text style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                {description}
              </Typography.Text>
            </div>
          )}

          <div>{children}</div>
        </>
      )}
    </div>
  );
}
