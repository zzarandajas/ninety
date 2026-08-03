import { Avatar, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Seat } from '../lib/seatsApi';

export type SeatNodeData = { seat: Seat };

// Conector superior (entrada) - azul
const handleStyleTop: React.CSSProperties = {
  width: 14,
  height: 14,
  background: '#3b82f6',
  border: '3px solid #1d4ed8',
  borderRadius: '50%',
};

// Conector inferior (salida) - verde
const handleStyleBottom: React.CSSProperties = {
  width: 14,
  height: 14,
  background: '#22c55e',
  border: '3px solid #15803d',
  borderRadius: '50%',
};

export function SeatNode({ data }: NodeProps & { data: SeatNodeData }) {
  const { seat } = data;
  const occupant = seat.occupants[0];
  const hasParent = seat.parentSeatId !== null;

  return (
    <div
      className="glass-panel"
      style={{ width: 220, padding: 12, cursor: 'grab' }}
      data-testid={`seat-node-${seat.id}`}
    >
      {/* Solo mostrar conector superior si tiene padre */}
      {hasParent && <Handle type="target" position={Position.Top} style={handleStyleTop} />}
      <Typography.Text strong ellipsis>
        {seat.name}
      </Typography.Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Avatar
          size="small"
          src={occupant?.user.avatarUrl ? `/api${occupant.user.avatarUrl}` : undefined}
          icon={!occupant?.user.avatarUrl ? <UserOutlined /> : undefined}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text type={occupant ? undefined : 'secondary'} ellipsis style={{ fontSize: 12, display: 'block' }}>
            {occupant?.user.fullName ?? 'Vacante'}
          </Typography.Text>
        </div>
        {occupant && (
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { label: 'G', val: occupant.getsIt },
              { label: 'W', val: occupant.wantsIt },
              { label: 'C', val: occupant.hasCapacity },
            ].map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  width: 14,
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  backgroundColor: item.val === true ? '#22c55e' : item.val === false ? '#ef4444' : 'rgba(0,0,0,0.06)',
                  color: item.val !== null ? '#fff' : 'rgba(0,0,0,0.25)',
                }}
              >
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {seat.rolesAndResponsibilities.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <Tag style={{ fontSize: 11 }}>
            {seat.rolesAndResponsibilities.length} responsabilidad
            {seat.rolesAndResponsibilities.length === 1 ? '' : 'es'}
          </Tag>
        </div>
      )}
      {/* Siempre mostrar conector inferior para poder añadir hijos */}
      <Handle type="source" position={Position.Bottom} style={handleStyleBottom} />
    </div>
  );
}
