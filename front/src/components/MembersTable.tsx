import { Avatar, Button, message, Modal, Select, Switch, Table, Tooltip, Typography } from 'antd';
import { CopyOutlined, CrownOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import {
  membershipsApi,
  type Membership,
  type ResetPasswordResult,
  type TenantRole,
} from '../lib/membershipsApi';
import type { Seat } from '../lib/seatsApi';

const ROLE_OPTIONS: { value: TenantRole; label: React.ReactNode }[] = [
  {
    value: 'owner',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(250, 173, 20, 0.2)',
            borderRadius: 4,
            padding: '1px 4px',
          }}
        >
          <CrownOutlined style={{ fontSize: 11, color: '#d48806' }} />
        </span>
        Owner
      </span>
    ),
  },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export interface MembersTableProps {
  memberships: Membership[];
  seats: Seat[];
  canManage: boolean;
  /** El usuario actual es owner en este tenant (único que puede resetear a otros owners). */
  canResetOwner: boolean;
  onChanged: () => void;
}

export function MembersTable({ memberships, seats, canManage, canResetOwner, onChanged }: MembersTableProps) {
  const [resetTarget, setResetTarget] = useState<Membership | null>(null);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
  const [resetting, setResetting] = useState(false);

  async function updateMembership(id: string, patch: Parameters<typeof membershipsApi.update>[1]) {
    try {
      await membershipsApi.update(id, patch);
      onChanged();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleResetConfirm() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const result = await membershipsApi.resetPassword(resetTarget.id);
      setResetResult(result);
      setResetTarget(null);
      onChanged();
    } catch (e) {
      message.error(errorMessage(e));
      setResetTarget(null);
    } finally {
      setResetting(false);
    }
  }

  async function handleCopyPassword() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.temporaryPassword);
      message.success('Contraseña copiada al portapapeles');
    } catch {
      message.error('No se pudo copiar la contraseña');
    }
  }

  return (
    <>
      <Table<Membership>
        rowKey="id"
        dataSource={memberships}
        pagination={false}
        columns={[
          {
            title: 'Nombre',
            key: 'name',
            render: (_, membership) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar
                  size="small"
                  src={membership.user.avatarUrl ? `/api${membership.user.avatarUrl}` : undefined}
                  icon={!membership.user.avatarUrl ? <UserOutlined /> : undefined}
                />
                {membership.user.fullName}
              </span>
            ),
          },
          { title: 'Email', dataIndex: ['user', 'email'], key: 'email' },
          {
            title: 'Rol',
            key: 'role',
            render: (_, membership) => (
              <Select<TenantRole>
                value={membership.role}
                disabled={!canManage}
                style={{ width: 120 }}
                options={ROLE_OPTIONS}
                onChange={(role) => updateMembership(membership.id, { role })}
              />
            ),
          },
          {
            title: 'Seat',
            key: 'seat',
            render: (_, membership) => (
              <Select
                allowClear
                disabled={!canManage}
                placeholder="Sin seat"
                style={{ width: 180 }}
                value={membership.seatId ?? undefined}
                options={seats.map((seat) => ({ value: seat.id, label: seat.name }))}
                onChange={(seatId) => updateMembership(membership.id, { seatId: seatId ?? null })}
              />
            ),
          },
          {
            title: 'Activo',
            key: 'isActive',
            render: (_, membership) => (
              <Switch
                checked={membership.isActive}
                disabled={!canManage}
                onChange={(isActive) => updateMembership(membership.id, { isActive })}
              />
            ),
          },
          {
            title: 'Acciones',
            key: 'actions',
            render: (_, membership) => {
              const ownerBlocked = membership.role === 'owner' && !canResetOwner;
              const disabled = !canManage || ownerBlocked;
              return (
                <Tooltip
                  title={
                    ownerBlocked
                      ? 'Solo un owner puede resetear la contraseña de otro owner'
                      : disabled
                        ? 'No tienes permisos para gestionar miembros'
                        : 'Generar una contraseña temporal'
                  }
                >
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    disabled={disabled}
                    onClick={() => setResetTarget(membership)}
                  >
                    Resetear
                  </Button>
                </Tooltip>
              );
            },
          },
        ]}
      />

      <Modal
        title="Resetear contraseña"
        open={!!resetTarget}
        onCancel={() => setResetTarget(null)}
        onOk={handleResetConfirm}
        okText="Resetear"
        okButtonProps={{ danger: true, loading: resetting }}
        cancelText="Cancelar"
        centered
      >
        <p>
          ¿Seguro que quieres resetear la contraseña de{' '}
          <strong>{resetTarget?.user.fullName}</strong> ({resetTarget?.user.email})?
        </p>
        <Typography.Paragraph type="secondary">
          Se generará una contraseña temporal y el usuario deberá cambiarla en su próximo inicio de sesión.
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Contraseña restablecida"
        open={!!resetResult}
        onCancel={() => setResetResult(null)}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopyPassword}>
            Copiar
          </Button>,
          <Button key="close" type="primary" onClick={() => setResetResult(null)}>
            Cerrar
          </Button>,
        ]}
        centered
      >
        <p>
          Entrega esta contraseña temporal a <strong>{resetResult?.fullName}</strong> ({resetResult?.email}):
        </p>
        <Typography.Text code strong style={{ fontSize: 16 }}>
          {resetResult?.temporaryPassword}
        </Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          El usuario deberá cambiarla en su próximo inicio de sesión.
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
