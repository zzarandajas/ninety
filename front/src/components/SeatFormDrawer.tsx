import { Avatar, Button, Drawer, Form, Input, message, Popconfirm, Select, Space, Typography } from 'antd';
import { DeleteOutlined, SaveOutlined, UserAddOutlined, UserDeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { Membership } from '../lib/membershipsApi';
import { membershipsApi } from '../lib/membershipsApi';
import { seatsApi, type Seat } from '../lib/seatsApi';

export interface SeatFormDrawerProps {
  open: boolean;
  seat: Seat | 'new' | null;
  seats: Seat[];
  memberships: Membership[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  name: string;
  parentSeatId?: string;
  rolesAndResponsibilities: string[];
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function SeatFormDrawer({ open, seat, seats, memberships, onClose, onSaved }: SeatFormDrawerProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pendingMembershipId, setPendingMembershipId] = useState<string | undefined>(undefined);

  const editingSeat = seat === 'new' ? undefined : (seat ?? undefined);
  const occupant = editingSeat?.occupants[0];
  const availableMembers = memberships.filter((m) => m.isActive && !m.seatId);

  useEffect(() => {
    form.setFieldsValue(
      editingSeat
        ? {
            name: editingSeat.name,
            parentSeatId: editingSeat.parentSeatId ?? undefined,
            rolesAndResponsibilities: editingSeat.rolesAndResponsibilities,
          }
        : { name: '', parentSeatId: undefined, rolesAndResponsibilities: [] }
    );
    setPendingMembershipId(undefined);
  }, [seat, form, editingSeat]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        parentSeatId: values.parentSeatId ?? null,
        rolesAndResponsibilities: values.rolesAndResponsibilities ?? [],
      };
      if (editingSeat) {
        await seatsApi.update(editingSeat.id, payload);
      } else {
        await seatsApi.create(payload);
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!editingSeat || !pendingMembershipId) return;
    setAssigning(true);
    try {
      await membershipsApi.update(pendingMembershipId, { seatId: editingSeat.id });
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!occupant) return;
    setAssigning(true);
    try {
      await membershipsApi.update(occupant.id, { seatId: null });
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setAssigning(false);
    }
  }

  async function handleDelete() {
    if (!editingSeat) return;
    try {
      await seatsApi.remove(editingSeat.id);
      onSaved();
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function handleUpdateGWC(field: 'getsIt' | 'wantsIt' | 'hasCapacity', value: boolean | null) {
    if (!occupant) return;
    try {
      await membershipsApi.update(occupant.id, { [field]: value });
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {editingSeat ? 'Editar Seat (Puesto)' : 'Nuevo Seat (Puesto Organigrama)'}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            Estructura de responsabilidad (Accountability Chart).
          </Typography.Text>
        </div>
      }
      width={420}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Nombre del Seat / Puesto" rules={[{ required: true, message: 'Introduce un nombre' }]}>
          <Input placeholder="Ej. Integrador, Liderazgo de Ventas..." />
        </Form.Item>

        <Form.Item name="parentSeatId" label="Reporta a (Seat superior)">
          <Select
            allowClear
            placeholder="Sin seat superior (raíz u órgano supremo)"
            options={seats
              .filter((candidate) => candidate.id !== editingSeat?.id)
              .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          />
        </Form.Item>

        <Form.Item name="rolesAndResponsibilities" label="Funciones y responsabilidades (5 clave)">
          <Select mode="tags" placeholder="Escribe y pulsa Enter" tokenSeparators={[',']} />
        </Form.Item>

        <div className="modal-actions-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: 12 }}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} block>
            Guardar Seat
          </Button>
        </div>
      </Form>

      {editingSeat && (
        <div className="modal-section-card" style={{ marginTop: 20 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
            Persona asignada al Seat
          </Typography.Text>
          {occupant ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Space align="center">
                <Avatar
                  src={occupant.user.avatarUrl ? `/api${occupant.user.avatarUrl}` : undefined}
                  icon={!occupant.user.avatarUrl ? <UserOutlined /> : undefined}
                />
                <div>
                  <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                    {occupant.user.fullName}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {occupant.user.email}
                  </Typography.Text>
                </div>
              </Space>
              <Button size="small" danger icon={<UserDeleteOutlined />} onClick={handleUnassign} loading={assigning}>
                Desasignar
              </Button>
            </div>
          ) : (
            <Space style={{ width: '100%' }} direction="vertical">
              <Select
                aria-label="Asignar persona"
                style={{ width: '100%' }}
                placeholder="Seleccionar persona disponible"
                value={pendingMembershipId}
                onChange={setPendingMembershipId}
                options={availableMembers.map((m) => ({ value: m.id, label: m.user.fullName }))}
              />
              <Button icon={<UserAddOutlined />} onClick={handleAssign} loading={assigning} disabled={!pendingMembershipId} block>
                Asignar a este Seat
              </Button>
            </Space>
          )}

          {occupant && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                Evaluación GWC (Get it, Want it, Capacity)
              </Typography.Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Lo entiende (Gets it)', key: 'getsIt' as const },
                  { label: 'Lo quiere (Wants it)', key: 'wantsIt' as const },
                  { label: 'Capacidad (Capacity)', key: 'hasCapacity' as const },
                ].map((item) => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography.Text style={{ fontSize: 13 }}>{item.label}</Typography.Text>
                    <Select
                      size="small"
                      style={{ width: 80 }}
                      value={occupant[item.key]}
                      onChange={(val) => handleUpdateGWC(item.key, val)}
                      options={[
                        { label: 'SÍ', value: true },
                        { label: 'NO', value: false },
                        { label: '-', value: null },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editingSeat && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
          <Popconfirm
            title="¿Borrar este seat? Esta acción no se puede deshacer."
            onConfirm={handleDelete}
            okText="Borrar"
            cancelText="Cancelar"
          >
            <Button danger block type="text" icon={<DeleteOutlined />}>
              Borrar este seat
            </Button>
          </Popconfirm>
        </div>
      )}
    </Drawer>
  );
}
