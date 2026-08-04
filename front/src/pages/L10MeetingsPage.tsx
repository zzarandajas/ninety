import { CalendarOutlined, CheckOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Form, Modal, Popconfirm, Space, Table, Tag, message, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Template } from '../components/Template';
import { ModalTitle } from '../components/ModalTitle';
import { MemberCell } from '../components/UserAvatar';
import { UserSelect } from '../components/UserSelect';
import { l10Api, type L10Meeting, type MeetingStatus } from '../lib/l10Api';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { currentQuarter } from '../lib/quarters';

const QUARTER_STORAGE_KEY = 'l10.activeQuarter';

const STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

interface CreateFormValues {
  meetingDate: dayjs.Dayjs;
  facilitatorUserId: string;
}

export function L10MeetingsPage() {
  const authUser = useAuthStore((state) => state.user);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<L10Meeting[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [quarter, setQuarter] = useState<string | undefined>(() => {
    const saved = localStorage.getItem(QUARTER_STORAGE_KEY);
    return saved ?? currentQuarter();
  });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateFormValues>();

  const quarterOptions = useQuarterOptions(meetings.map((m) => m.quarter));

  function fetchMeetings() {
    l10Api
      .list({ quarter })
      .then(setMeetings)
      .catch((e) => message.error(errorMessage(e)));
  }

  useEffect(() => {
    fetchMeetings();
  }, [quarter, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'l10_meeting') {
      fetchMeetings();
    }
  });

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  useEffect(() => {
    if (creating) form.setFieldsValue({ meetingDate: dayjs(), facilitatorUserId: authUser?.id });
  }, [creating, authUser?.id, form]);

  function handleQuarterChange(value: string | undefined) {
    setQuarter(value);
    if (value) {
      localStorage.setItem(QUARTER_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(QUARTER_STORAGE_KEY);
    }
  }

  async function handleCreate(values: CreateFormValues) {
    setSaving(true);
    try {
      const meeting = await l10Api.create({
        meetingDate: values.meetingDate.toISOString(),
        facilitatorUserId: values.facilitatorUserId,
        quarter: quarter ?? currentQuarter(),
      });
      setCreating(false);
      navigate(`/l10/${meeting.id}`);
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meetingId: string) {
    try {
      await l10Api.remove(meetingId);
      fetchMeetings(); // Recargar tras borrar
      message.success('Reunión borrada');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  const userRole = members.find((m) => m.userId === authUser?.id)?.role;
  const canDelete = userRole === 'admin' || userRole === 'owner';

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'meetingDate',
      key: 'meetingDate',
      render: (date: string, meeting: L10Meeting) => (
        <a onClick={() => navigate(`/l10/${meeting.id}`)}>{dayjs(date).format('DD/MM/YYYY')}</a>
      ),
    },
    {
      title: 'Facilitador',
      key: 'facilitator',
      render: (_: unknown, meeting: L10Meeting) => (
        <MemberCell member={members.find((m) => m.userId === meeting.facilitatorUserId)} />
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (s: MeetingStatus) => {
        const color = s === 'in_progress' ? 'green' : s === 'completed' ? 'default' : 'blue';
        return <Tag color={color}>{STATUS_LABEL[s]}</Tag>;
      },
    },
    {
      title: 'Rating',
      dataIndex: 'overallRating',
      key: 'overallRating',
      render: (rating: number | null) => (rating !== null ? `${rating}/10` : '—'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, meeting: L10Meeting) => (
        <Space>
          {canDelete && (
            <Popconfirm
              title="¿Borrar esta reunión?"
              description="Esta acción es permanente y no se puede deshacer."
              onConfirm={() => handleDelete(meeting.id)}
              okText="Sí, borrar"
              cancelText="No"
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Template
      title="L10"
      icon={<CalendarOutlined />}
      subtitle="Reuniones de nivel 1 (L10): históricas, facilitador y rating."
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Nueva reunión
          </Button>
        </Space>
      }
    >
      <Table className="glass-panel" dataSource={meetings} columns={columns} rowKey="id" pagination={false} />

      <Modal
        open={creating}
        onCancel={() => setCreating(false)}
        footer={null}
        title={
          <ModalTitle
            icon={<CalendarOutlined />}
            title="Nueva reunión L10"
            subtitle="Crea una sesión con fecha y facilitador para el equipo."
          />
        }
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="meetingDate" label="Fecha" rules={[{ required: true, message: 'Elige una fecha' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="facilitatorUserId" label="Facilitador" rules={[{ required: true, message: 'Elige un facilitador' }]}>
            <UserSelect ariaLabel="Facilitador" members={members} />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<CheckOutlined />} loading={saving} block>
            Crear
          </Button>
        </Form>
      </Modal>
    </Template>
  );
}
