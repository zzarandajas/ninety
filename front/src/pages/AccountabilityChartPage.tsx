import { ApartmentOutlined, PlusOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, message, Modal, Space, Tabs } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { MembersTable } from '../components/MembersTable';
import { OrgChart } from '../components/OrgChart';
import { SeatFormDrawer } from '../components/SeatFormDrawer';
import { Template } from '../components/Template';
import { membershipsApi, type Membership } from '../lib/membershipsApi';
import { seatsApi, type Seat } from '../lib/seatsApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function AccountabilityChartPage() {
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);

  const [seats, setSeats] = useState<Seat[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [drawerSeat, setDrawerSeat] = useState<Seat | 'new' | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const role = tenants.find((tenant) => tenant.tenantId === activeTenantId)?.role;
  const canManage = role === 'owner' || role === 'admin';

  const refetch = useCallback(() => {
    Promise.all([seatsApi.list(), membershipsApi.list()])
      .then(([nextSeats, nextMemberships]) => {
        setSeats(nextSeats);
        setMemberships(nextMemberships);
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'seat' || event.entity === 'member') {
      refetch();
    }
  });

  async function handleReparent(seatId: string, parentSeatId: string) {
    try {
      await seatsApi.update(seatId, { parentSeatId });
      refetch();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  function handleResetChart() {
    Modal.confirm({
      title: 'Resetear organigrama',
      content:
        'Se eliminarán todos los seats actuales y se restaurará el organigrama EOS inicial (Visionario, 3 Integradores y sus departamentos). Los usuarios asignados serán desvinculados de sus seats. ¿Continuar?',
      okText: 'Sí, resetear',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await seatsApi.reset();
          message.success('Organigrama reseteado correctamente');
          refetch();
        } catch (e) {
          message.error(errorMessage(e));
        }
      },
    });
  }

  function closeDrawer() {
    setDrawerSeat(null);
    refetch();
  }

  return (
    <Template
      title="Accountability Chart"
      icon={<ApartmentOutlined />}
      subtitle="Organigrama, seats y funciones de la organización."
    >
      <Tabs
        items={[
          {
            key: 'org-chart',
            label: 'Organigrama',
            children: (
              <div>
                {canManage && (
                  <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerSeat('new')}>
                      Nuevo seat
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={handleResetChart}>
                      Resetear
                    </Button>
                  </Space>
                )}
                <OrgChart seats={seats} onSelectSeat={setDrawerSeat} onReparent={handleReparent} />
              </div>
            ),
          },
          {
            key: 'members',
            label: 'Usuarios',
            children: (
              <div>
                {canManage && (
                  <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
                      Invitar usuario
                    </Button>
                  </Space>
                )}
                <MembersTable
                  memberships={memberships}
                  seats={seats}
                  canManage={canManage}
                  canResetOwner={role === 'owner'}
                  onChanged={refetch}
                />
              </div>
            ),
          },
        ]}
      />

      <SeatFormDrawer
        open={drawerSeat !== null}
        seat={drawerSeat}
        seats={seats}
        memberships={memberships}
        onClose={closeDrawer}
        onSaved={refetch}
      />

      <InviteMemberModal
        open={inviteOpen}
        canGrantOwner={role === 'owner'}
        onClose={() => setInviteOpen(false)}
        onInvited={refetch}
      />
    </Template>
  );
}
