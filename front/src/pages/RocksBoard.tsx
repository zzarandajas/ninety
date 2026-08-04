import * as Icons from '@ant-design/icons';
import { Button, Dropdown, message, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { RockFormModal } from '../components/RockFormModal';
import { Template } from '../components/Template';
import { MemberCell } from '../components/UserAvatar';
import { UserSelect } from '../components/UserSelect';
import { rocksApi, type Rock, type RockStatus } from '../lib/rocksApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { CustomSection } from '../components/Templates';

const ROCK_STATUS_CONFIG: Record<RockStatus, { label: string; color: string }> = {
  on_track: { label: 'On track', color: 'success' },
  off_track: { label: 'Off track', color: 'error' },
  done: { label: 'Done', color: 'processing' },
};

const QUARTER_STORAGE_KEY = 'rocks.activeQuarter';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function RocksBoard() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [quarter, setQuarter] = useState<string | undefined>(() => {
    const saved = localStorage.getItem(QUARTER_STORAGE_KEY);
    return saved ?? undefined;
  });
  const [ownerUserId, setOwnerUserId] = useState<string | undefined>(undefined);
  const [rockType, setRockType] = useState<'all' | 'company' | 'personal'>('all');
  const [loading, setLoading] = useState(false);
  const [modalRock, setModalRock] = useState<Rock | 'new' | null>(null);

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  function refetchRocks() {
    setLoading(true);
    return rocksApi
      .list({ quarter, ownerUserId })
      .then(setRocks)
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refetchRocks();
  }, [quarter, ownerUserId, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'rock') {
      refetchRocks();
    }
  });

  function handleQuarterChange(value: string | undefined) {
    setQuarter(value);
    if (value) {
      localStorage.setItem(QUARTER_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(QUARTER_STORAGE_KEY);
    }
  }

  function updateRock(id: string, patch: Parameters<typeof rocksApi.update>[1]) {
    setRocks((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    rocksApi.update(id, patch).catch((e) => {
      message.error(errorMessage(e));
      refetchRocks();
    });
  }

  const quarterOptions = useQuarterOptions(rocks.map((rock) => rock.quarter));

  const filteredRocks = useMemo(() => {
    if (rockType === 'company') {
      return rocks.filter((r) => r.isCompanyRock);
    }
    if (rockType === 'personal') {
      return rocks.filter((r) => !r.isCompanyRock);
    }
    return rocks;
  }, [rocks, rockType]);

  const ownerMember = useMemo(() => {
    const byUser = new Map(members.map((m) => [m.userId, m]));
    return (userId: string) => byUser.get(userId);
  }, [members]);

  const ownerName = useMemo(() => {
    const byUser = new Map(members.map((m) => [m.userId, m.fullName]));
    return (userId: string) => byUser.get(userId) ?? '';
  }, [members]);

  const sortedRocks = useMemo(() => {
    return [...filteredRocks].sort((a, b) => {
      if (a.isCompanyRock !== b.isCompanyRock) return a.isCompanyRock ? -1 : 1;
      return ownerName(a.ownerUserId).localeCompare(ownerName(b.ownerUserId), 'es');
    });
  }, [filteredRocks, ownerName]);

  const columns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, rock: Rock) => (
        <Space size={8}>
          <Icons.RocketOutlined style={{ color: rock.status === 'done' ? '#52c41a' : '#722ed1' }} />
          <Typography.Text strong>{title}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'isCompanyRock',
      key: 'type',
      width: 120,
      render: (isCompanyRock: boolean, rock: Rock) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={['click']}
            menu={{
              selectable: true,
              selectedKeys: [String(isCompanyRock)],
              items: [
                { key: 'true', label: 'Empresa' },
                { key: 'false', label: 'Personal' },
              ],
              onClick: ({ key }) => updateRock(rock.id, { isCompanyRock: key === 'true' }),
            }}
          >
            <Tag color={isCompanyRock ? 'blue' : 'purple'} style={{ cursor: 'pointer' }}>
              {isCompanyRock ? 'Empresa' : 'Personal'}
            </Tag>
          </Dropdown>
        </span>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: RockStatus, rock: Rock) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={['click']}
            menu={{
              selectable: true,
              selectedKeys: [status],
              items: (Object.keys(ROCK_STATUS_CONFIG) as RockStatus[]).map((s) => ({
                key: s,
                label: ROCK_STATUS_CONFIG[s].label,
              })),
              onClick: ({ key }) => updateRock(rock.id, { status: key as RockStatus }),
            }}
          >
            <Tag color={ROCK_STATUS_CONFIG[status].color} style={{ cursor: 'pointer' }}>
              {ROCK_STATUS_CONFIG[status].label}
            </Tag>
          </Dropdown>
        </span>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'ownerUserId',
      key: 'owner',
      render: (userId: string) => {
        const member = ownerMember(userId);
        if (!member) return 'Sin owner';
        return <MemberCell member={member} />;
      },
    },
    {
      title: 'Milestones',
      key: 'milestones',
      width: 110,
      render: (_: unknown, rock: Rock) => {
        if (!rock.milestones || rock.milestones.length === 0) return '—';
        const completed = rock.milestones.filter((m) => m.completedAt).length;
        return `${completed}/${rock.milestones.length}`;
      },
    },
    {
      title: 'Vencimiento',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (dueDate: string) => dayjs(dueDate).format('DD/MM/YYYY'),
    },
    {
      title: 'Trimestre',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
  ];

  function closeModal() {
    setModalRock(null);
    refetchRocks();
  }

  return (
    <Template
      title="Rocks"
      icon={<Icons.RocketOutlined />}
      subtitle="Rocks de empresa y personales del periodo: estado, milestones y vencimientos."
      extra={
        <Button icon={<Icons.PlusOutlined />} type="primary" onClick={() => setModalRock('new')}>
          Nuevo Rock
        </Button>
      }
    >

      <CustomSection
        titulo={'Filtros'}
        icon={<Icons.FilterOutlined />}
        extra={
          <Space wrap>
            <Select
              allowClear
              aria-label="Trimestre"
              placeholder="Trimestre"
              style={{ width: 160 }}
              value={quarter}
              onChange={handleQuarterChange}
              options={quarterOptions}
            />
            <UserSelect
              allowClear
              ariaLabel="Owner"
              placeholder="Owner"
              style={{ width: 200 }}
              members={members}
              value={ownerUserId}
              onChange={setOwnerUserId}
            />
            <Select
              aria-label="Tipo de Rock"
              placeholder="Tipo de Rock"
              style={{ width: 170 }}
              value={rockType}
              onChange={setRockType}
              options={[
                { value: 'all', label: 'Todos los tipos' },
                { value: 'company', label: '🏢 Empresa' },
                { value: 'personal', label: '👤 Personal' },
              ]}
            />
          </Space>
        }
      >




        <Table
          className="glass-panel"
          dataSource={sortedRocks}
          columns={columns}
          rowKey="id"
          pagination={false}
          loading={loading}
          locale={{ emptyText: 'Sin rocks' }}
          size="small"
          onRow={(rock: Rock) => ({
            onClick: () => setModalRock(rock),
            style: { cursor: 'pointer' },
          })}
        />

        {modalRock && (
          <RockFormModal
            open
            rock={modalRock === 'new' ? undefined : modalRock}
            members={members}
            onClose={closeModal}
            onSaved={closeModal}
          />
        )}
      </CustomSection>
    </Template>
  );
}
