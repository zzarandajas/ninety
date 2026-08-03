import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Card, Checkbox, Col, message, Row, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import { Template } from '../components/Template';
import { MemberCell } from '../components/UserAvatar';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { issuesApi, type Issue } from '../lib/issuesApi';
import { l10Api, type L10Meeting } from '../lib/l10Api';
import { currentQuarter } from '../lib/quarters';
import { rocksApi, type Rock } from '../lib/rocksApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { todosApi, type Todo } from '../lib/todosApi';
import { useAuthStore } from '../store/authStore';

const ROCK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On track', color: 'success' },
  off_track: { label: 'Off track', color: 'error' },
  done: { label: 'Done', color: 'processing' },
};

const ISSUE_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'red' },
  medium: { label: 'Media', color: 'orange' },
  low: { label: 'Baja', color: 'blue' },
};

const ISSUE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'default' },
  discussing: { label: 'Discussing', color: 'warning' },
  solved: { label: 'Solved', color: 'success' },
  dropped: { label: 'Dropped', color: 'default' },
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const activeTenantId = useAuthStore((state) => state.activeTenantId);

  const [quarter, setQuarter] = useState<string>(currentQuarter());
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [meetings, setMeetings] = useState<L10Meeting[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  const loadDashboardData = () => {
    if (!activeTenantId) return;
    setLoading(true);
    Promise.all([
      rocksApi.list({ quarter }),
      issuesApi.list({ status: 'open' }),
      todosApi.list({ status: 'open' }),
      l10Api.list(),
    ])
      .then(([rocksData, issuesData, todosData, meetingsData]) => {
        setRocks(rocksData);
        setIssues(issuesData);
        setTodos(todosData);
        setMeetings(meetingsData);
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeTenantId, quarter]);

  useRealtimeSync(() => {
    loadDashboardData();
  });

  const quarterOptions = useQuarterOptions(rocks.map((r) => r.quarter));

  const companyRocks = useMemo(() => rocks.filter((r) => r.isCompanyRock), [rocks]);
  const individualRocks = useMemo(() => rocks.filter((r) => !r.isCompanyRock), [rocks]);

  const onTrackCount = useMemo(() => rocks.filter((r) => r.status === 'on_track').length, [rocks]);
  const offTrackCount = useMemo(() => rocks.filter((r) => r.status === 'off_track').length, [rocks]);

  const openIssues = useMemo(() => issues.filter((i) => i.status === 'open' || i.status === 'discussing'), [issues]);
  const openTodos = useMemo(() => todos.filter((t) => t.status === 'open'), [todos]);

  const nextMeeting = useMemo(() => {
    const scheduled = meetings.filter((m) => m.status === 'scheduled' || m.status === 'in_progress');
    if (scheduled.length > 0) {
      return scheduled.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime())[0];
    }
    return meetings[0];
  }, [meetings]);

  const handleToggleTodo = (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'done' : 'open';
    todosApi
      .update(todoId, { status: newStatus })
      .then(() => {
        loadDashboardData();
      })
      .catch((e) => message.error(errorMessage(e)));
  };

  const rockColumns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
    },
    {
      title: 'Owner',
      dataIndex: 'ownerUserId',
      key: 'ownerUserId',
      render: (ownerUserId: string) => (
        <MemberCell member={members.find((m) => m.userId === ownerUserId)} />
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const conf = ROCK_STATUS_CONFIG[status] ?? { label: status, color: 'default' };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Milestones',
      key: 'milestones',
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
      render: (dueDate: string) => dayjs(dueDate).format('DD/MM/YYYY'),
    },
  ];

  const todoColumns = [
    {
      title: '',
      key: 'check',
      width: 40,
      render: (_: unknown, todo: Todo) => (
        <Checkbox checked={todo.status === 'done'} onChange={() => handleToggleTodo(todo.id, todo.status)} />
      ),
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, todo: Todo) => (
        <Typography.Text delete={todo.status === 'done'}>{title}</Typography.Text>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'ownerUserId',
      key: 'ownerUserId',
      render: (ownerUserId: string) => (
        <MemberCell member={members.find((m) => m.userId === ownerUserId)} />
      ),
    },
    {
      title: 'Vencimiento',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate: string | null) => (dueDate ? dayjs(dueDate).format('DD/MM/YYYY') : '—'),
    },
  ];

  const issueColumns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const conf = ISSUE_PRIORITY_CONFIG[priority] ?? { label: priority, color: 'default' };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const conf = ISSUE_STATUS_CONFIG[status] ?? { label: status, color: 'default' };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Creado por',
      dataIndex: 'raisedByUserId',
      key: 'raisedByUserId',
      render: (raisedByUserId: string) => (
        <MemberCell member={members.find((m) => m.userId === raisedByUserId)} />
      ),
    },
  ];

  return (
    <Template
      title="Dashboard"
      icon={<DashboardOutlined />}
      subtitle="Visión general del trimestre: rocks, issues, to-dos y próxima reunión L10."
      extra={
        <Select
          aria-label="Trimestre"
          style={{ width: 140 }}
          value={quarter}
          onChange={setQuarter}
          options={quarterOptions}
        />
      }
    >
      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Rocks On Track"
            value={`${onTrackCount} / ${rocks.length}`}
            icon={<RocketOutlined />}
            color={offTrackCount > 0 ? '#faad14' : '#52c41a'}
            loading={loading}
            onClick={() => navigate('/rocks')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Issues Abiertos"
            value={openIssues.length}
            icon={<ExclamationCircleOutlined />}
            color="#fa8c16"
            loading={loading}
            onClick={() => navigate('/issues')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="To-Dos Pendientes"
            value={openTodos.length}
            icon={<CheckCircleOutlined />}
            color="#1890ff"
            loading={loading}
            onClick={() => navigate('/l10')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Próxima L10"
            value={nextMeeting ? dayjs(nextMeeting.meetingDate).format('D/M/YYYY') : 'N/A'}
            icon={<CalendarOutlined />}
            color="#722ed1"
            loading={loading}
            onClick={() => nextMeeting && navigate(`/l10/${nextMeeting.id}`)}
          />
        </Col>
      </Row>

      {/* Company Rocks & Individual Rocks */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            className="glass-panel"
            title={
              <Space>
                <BellOutlined />
                <span>Rocks de Compañía ({quarter})</span>
                <Tag color="green">{companyRocks.length} rocks</Tag>
              </Space>
            }
          >
            <Table
              columns={rockColumns}
              dataSource={companyRocks}
              rowKey="id"
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Sin rocks de compañía este trimestre' }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            className="glass-panel"
            title={
              <Space>
                <BellOutlined />
                <span>Rocks Individuales ({quarter})</span>
                <Tag color="blue">{individualRocks.length} rocks</Tag>
              </Space>
            }
          >
            <Table
              columns={rockColumns}
              dataSource={individualRocks}
              rowKey="id"
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Sin rocks individuales este trimestre' }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* To Dos & Issues */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            className="glass-panel"
            title={
              <Space>
                <CheckCircleOutlined />
                <span>To Dos del periodo</span>
                <Tag color="orange">{openTodos.length} to dos</Tag>
              </Space>
            }
          >
            <Table
              columns={todoColumns}
              dataSource={openTodos}
              rowKey="id"
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Sin to dos pendientes' }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            className="glass-panel"
            title={
              <Space>
                <ExclamationCircleOutlined />
                <span>Issues del periodo</span>
                <Tag color="volcano">{openIssues.length} issues</Tag>
              </Space>
            }
          >
            <Table
              columns={issueColumns}
              dataSource={openIssues}
              rowKey="id"
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Sin issues abiertos' }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </Template>
  );
}
