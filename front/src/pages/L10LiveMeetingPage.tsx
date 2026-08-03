import * as Icons from '@ant-design/icons';
import { Button, Card, Col, Input, InputNumber,  Modal, Progress, Radio, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AgendaSection } from '../components/AgendaSection';
import { Template } from '../components/Template';
import { TodoFormModal } from '../components/TodoFormModal';
import { MemberCell } from '../components/UserAvatar';
import { evaluateGoal } from '../lib/evaluateGoal';
import { issuesApi, type Issue, type IssueStatus } from '../lib/issuesApi';
import { l10Api, type L10AgendaItemLog, type L10Meeting, type MeetingRating } from '../lib/l10Api';
import { rocksApi, type Rock } from '../lib/rocksApi';
import { scorecardApi, type MetricFrequency, type ScorecardEntry, type ScorecardMetric } from '../lib/scorecardApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { todosApi, type Todo } from '../lib/todosApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

type Section = 'segue' | 'scorecard' | 'rocks' | 'headlines' | 'todos' | 'ids' | 'conclude';

export const SECTIONS_CONFIG: { id: Section; label: string; minutes: number; icon: ReactNode }[] = [
  { id: 'segue', label: 'Segue', minutes: 5, icon: <Icons.SmileOutlined /> },
  { id: 'scorecard', label: 'Scorecard', minutes: 5, icon: <Icons.LineChartOutlined /> },
  { id: 'rocks', label: 'Rock Review', minutes: 5, icon: <Icons.RocketOutlined /> },
  { id: 'headlines', label: 'Headlines', minutes: 5, icon: <Icons.CheckSquareOutlined /> },
  { id: 'todos', label: 'To-Do List', minutes: 5, icon: <Icons.CheckSquareOutlined /> },
  { id: 'ids', label: 'IDS', minutes: 60, icon: <Icons.ExperimentOutlined /> },
  { id: 'conclude', label: 'Conclude', minutes: 5, icon: <Icons.FlagOutlined /> },
];

const ISSUE_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'discussing', label: 'Discussing' },
  { value: 'solved', label: 'Solved' },
  { value: 'dropped', label: 'Dropped' },
];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function formatTotalTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function L10LiveMeetingPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const currentUser = useAuthStore((state) => state.user);
  const activeTenantRole = useAuthStore((state) => state.tenants.find((t) => t.tenantId === activeTenantId)?.role);
  const { id } = useParams<{ id: string }>();

  const [meeting, setMeeting] = useState<L10Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<L10AgendaItemLog[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metrics, setMetrics] = useState<ScorecardMetric[]>([]);
  const [entries, setEntries] = useState<ScorecardEntry[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [activeSection, setActiveSection] = useState<Section>('segue');
  const [rockNoteDrafts, setRockNoteDrafts] = useState<Record<string, string>>({});
  const [issueNoteDrafts, setIssueNoteDrafts] = useState<Record<string, string>>({});
  const [creatingTodo, setCreatingTodo] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [memberRatingsDraft, setMemberRatingsDraft] = useState<Record<string, number | null>>({});
  const [concludeNotesDraft, setConcludeNotesDraft] = useState('');
  const [rockFilter, setRockFilter] = useState<'all' | 'company' | 'personal'>('all');
  const [metricFilter, setMetricFilter] = useState<MetricFrequency | 'all'>('all');
  const [endMeetingModalOpen, setEndMeetingModalOpen] = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);

  // Timer global de reunión
  const [meetingSeconds, setMeetingSeconds] = useState(0);

  useEffect(() => {
    if (meeting && !timerInitialized) {
      if (meeting.timerIsPaused || !meeting.timerStartedAt) {
        setMeetingSeconds(meeting.timerAccumulatedSeconds);
      } else {
        const elapsedSinceStart = dayjs().diff(dayjs(meeting.timerStartedAt), 'second');
        setMeetingSeconds(meeting.timerAccumulatedSeconds + (elapsedSinceStart > 0 ? elapsedSinceStart : 0));
      }
      
      if (meeting.currentSectionId) {
        setActiveSection(meeting.currentSectionId as Section);
      }
      
      setTimerInitialized(true);
    }
  }, [meeting, timerInitialized]);

  useEffect(() => {
    if (!meeting || meeting.status === 'completed' || meeting.timerIsPaused || !meeting.timerStartedAt || !timerInitialized) return;
    const interval = setInterval(() => {
      const elapsedSinceStart = dayjs().diff(dayjs(meeting.timerStartedAt), 'second');
      setMeetingSeconds(meeting.timerAccumulatedSeconds + (elapsedSinceStart > 0 ? elapsedSinceStart : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [meeting?.status, meeting?.timerIsPaused, meeting?.timerStartedAt, meeting?.timerAccumulatedSeconds, timerInitialized]);

  async function toggleTimer() {
    if (!meeting || !id) return;
    
    try {
      const payload: any = {};
      const isStartingOrResuming = meeting.timerIsPaused || !meeting.timerStartedAt;

      if (isStartingOrResuming) {
        payload.timerStartedAt = new Date().toISOString();
        payload.timerIsPaused = false;
        
        // También reanudar el timer de la sección actual si existe
        if (meeting.currentSectionId) {
          payload.currentSectionStartedAt = new Date().toISOString();
        }

        if (meeting.status === 'scheduled') {
          payload.status = 'in_progress';
        }
      } else {
        const elapsedSinceStart = dayjs().diff(dayjs(meeting.timerStartedAt), 'second');
        payload.timerAccumulatedSeconds = meeting.timerAccumulatedSeconds + (elapsedSinceStart > 0 ? elapsedSinceStart : 0);
        payload.timerStartedAt = null;
        payload.timerIsPaused = true;

        // También pausar el timer de la sección actual
        if (meeting.currentSectionId && meeting.currentSectionStartedAt) {
          const sectionElapsed = dayjs().diff(dayjs(meeting.currentSectionStartedAt), 'second');
          payload.currentSectionAccumulatedSeconds = meeting.currentSectionAccumulatedSeconds + (sectionElapsed > 0 ? sectionElapsed : 0);
          payload.currentSectionStartedAt = null;
        }
      }

      const updated = await l10Api.update(id, payload);
      setMeeting(updated);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function changeSection(sectionId: Section) {
    if (!id || !meeting) return;

    try {
      const payload: any = {
        currentSectionId: sectionId,
      };

      // Al cambiar de sección, reiniciamos el timer de la sección (comportamiento EOS estándar)
      payload.currentSectionAccumulatedSeconds = 0;
      
      if (!meeting.timerIsPaused && meeting.timerStartedAt) {
        payload.currentSectionStartedAt = new Date().toISOString();
      } else {
        payload.currentSectionStartedAt = null;
      }

      const updated = await l10Api.update(id, payload);
      setMeeting(updated);
      setActiveSection(sectionId);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function resetSectionTimer() {
    if (!id || !meeting) return;
    try {
      const payload: any = {
        currentSectionAccumulatedSeconds: 0,
      };
      if (!meeting.timerIsPaused && (meeting.timerStartedAt || !meeting.timerIsPaused)) {
         // Si la reunión no está pausada, empezamos a contar de nuevo desde ya
         if (meeting.timerStartedAt) {
           payload.currentSectionStartedAt = new Date().toISOString();
         }
      }
      const updated = await l10Api.update(id, payload);
      setMeeting(updated);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  function refetchTodos() {
    return todosApi
      .list({ status: 'open' })
      .then(setTodos)
      .catch((e) => message.error(errorMessage(e)));
  }

  function refetchIssues() {
    return issuesApi
      .list()
      .then(setIssues)
      .catch((e) => message.error(errorMessage(e)));
  }

  useEffect(() => {
    if (!id) return;
    l10Api.get(id).then(setMeeting).catch((e) => message.error(errorMessage(e)));
    l10Api.listAgendaItems(id).then(setAgendaItems).catch((e) => message.error(errorMessage(e)));
  }, [id, activeTenantId]);

  useEffect(() => {
    rocksApi.list().then(setRocks).catch((e) => message.error(errorMessage(e)));
    refetchIssues();
    scorecardApi.listMetrics({ isActive: true }).then(setMetrics).catch((e) => message.error(errorMessage(e)));
    scorecardApi.listEntries(5).then(setEntries).catch((e) => message.error(errorMessage(e)));
    refetchTodos();
    tenantApi.listMembers().then(setMembers).catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  useRealtimeSync((event) => {
    if (!id) return;
    if (event.entity === 'l10_meeting' || event.entity === 'l10_agenda_log') {
      l10Api.get(id).then(setMeeting).catch(() => {});
      l10Api.listAgendaItems(id).then(setAgendaItems).catch(() => {});
    } else if (event.entity === 'issue') {
      refetchIssues();
    } else if (event.entity === 'todo') {
      refetchTodos();
    } else if (event.entity === 'rock' || event.entity === 'milestone') {
      rocksApi.list().then(setRocks).catch(() => {});
    } else if (event.entity === 'scorecard_metric' || event.entity === 'scorecard_entry') {
      scorecardApi.listMetrics({ isActive: true }).then(setMetrics).catch(() => {});
      scorecardApi.listEntries(5).then(setEntries).catch(() => {});
    }
  });

  useEffect(() => {
    if (meeting) {
      const initialRatings: Record<string, number | null> = {};
      meeting.ratings?.forEach((r) => {
        initialRatings[r.userId] = r.rating;
      });
      setMemberRatingsDraft(initialRatings);
      setConcludeNotesDraft(meeting.concludeNotes ?? '');
    }
  }, [meeting?.id, meeting?.ratings]);

  async function handleSubmitMemberRating(userId: string, rating: number | null) {
    if (!id || rating === null) return;
    try {
      await l10Api.submitRating(id, { rating, targetUserId: userId });
      const updated = await l10Api.get(id);
      setMeeting(updated);
      message.success('Calificación guardada');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function closeMeeting() {
    if (!id) return;
    try {
      const updated = await l10Api.close(id, { concludeNotes: concludeNotesDraft || undefined });
      setMeeting(updated);
      message.success('Reunión cerrada');
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function saveSegueNotes(value: string) {
    if (!id) return;
    try {
      const updated = await l10Api.update(id, { segueNotes: value });
      setMeeting(updated);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function saveHeadlines(value: string) {
    if (!id) return;
    try {
      const updated = await l10Api.update(id, { headlines: value });
      setMeeting(updated);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function logRockNote(rockId: string) {
    if (!id) return;
    const notes = rockNoteDrafts[rockId];
    if (!notes) return;
    try {
      const log = await l10Api.logAgendaItem(id, { itemType: 'rock_review', referenceId: rockId, notes });
      setAgendaItems((prev) => [...prev, log]);
      setRockNoteDrafts((prev) => ({ ...prev, [rockId]: '' }));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function logIssueNote(issueId: string) {
    if (!id) return;
    const notes = issueNoteDrafts[issueId];
    if (!notes) return;
    try {
      const log = await l10Api.logAgendaItem(id, { itemType: 'issue', referenceId: issueId, notes });
      setAgendaItems((prev) => [...prev, log]);
      setIssueNoteDrafts((prev) => ({ ...prev, [issueId]: '' }));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function changeIssueStatus(issueId: string, status: IssueStatus) {
    try {
      const updated = await issuesApi.update(issueId, { status });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? updated : i)));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  async function dropToIDS(title: string, description?: string) {
    if (!currentUser) return;
    try {
      const newIssue = await issuesApi.create({
        title,
        description,
        priority: 'high',
        raisedByUserId: currentUser.id,
      });
      setIssues((prev) => [newIssue, ...prev]);
      message.success(`Issue añadido a IDS: "${title}"`);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  if (!meeting) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Cargando reunión L10…</div>;
  }

  const facilitator = members.find((m) => m.userId === meeting.facilitatorUserId);
  const isFacilitator = currentUser?.id === meeting.facilitatorUserId;
  const canManageMeeting = isFacilitator || activeTenantRole === 'owner' || activeTenantRole === 'admin';

  function logsFor(itemType: L10AgendaItemLog['itemType'], referenceId: string) {
    return agendaItems.filter((log) => log.itemType === itemType && log.referenceId === referenceId);
  }

  const latestEntryFor = (metricId: string) =>
    entries.filter((e) => e.metricId === metricId).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];

  const totalTargetSeconds = 90 * 60; // 90 min
  const meetingProgress = Math.min(100, Math.round((meetingSeconds / totalTargetSeconds) * 100));

  const filteredRocks = rocks.filter((r) => {
    if (rockFilter === 'company') return r.isCompanyRock;
    if (rockFilter === 'personal') return !r.isCompanyRock;
    return true;
  });

  const filteredMetrics = metrics.filter((m) => {
    if (metricFilter === 'all') return true;
    return m.frequency === metricFilter;
  });

  const isPaused = meeting.timerIsPaused || !meeting.timerStartedAt;

  return (
    <Template
      title="Reunión L10"
      icon={<Icons.CalendarOutlined />}
      subtitle="Sesión en directo de la L10: agenda, timer y notas por sección."
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', position: 'relative' }}>
        {/* SIDEBAR FIJO */}
        <div style={{ 
          width: 280, 
          position: 'sticky', 
          top: 24, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 20,
          zIndex: 10
        }}>
          <Card className="glass-panel" styles={{body:{ padding: 16} }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                Tiempo total reunión
              </Typography.Text>
              <Typography.Title level={2} style={{ margin: '4px 0', fontFamily: 'monospace', fontSize: 32 }}>
                {formatTotalTime(meetingSeconds)}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Objetivo: 90:00
              </Typography.Text>
              
              <Progress
                percent={meetingProgress}
                showInfo={false}
                strokeColor={meetingSeconds > totalTargetSeconds ? '#ff4d4f' : 'var(--brand-green)'}
                style={{ marginTop: 12, marginBottom: 16 }}
              />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  block
                  type={isPaused ? 'primary' : 'default'}
                  icon={isPaused ? <Icons.PlayCircleOutlined /> : <Icons.PauseCircleOutlined />} 
                  onClick={toggleTimer}
                >
                  {isPaused ? (!meeting.timerStartedAt ? 'Iniciar' : 'Reanudar') : 'Pausar'}
                </Button>
                {meeting.status !== 'completed' && (
                  <Button
                    block
                    danger
                    icon={<Icons.StopOutlined />}
                    onClick={() => setEndMeetingModalOpen(true)}
                  >
                    Terminar reunión
                  </Button>
                )}
              </Space>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
              <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>
                Agenda
              </Typography.Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SECTIONS_CONFIG.map((sec) => {
                  const isActive = activeSection === sec.id;
                  return (
                    <Button
                      key={sec.id}
                      type={isActive ? 'primary' : 'text'}
                      style={{ 
                        textAlign: 'left', 
                        height: 'auto', 
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 8,
                        backgroundColor: isActive ? undefined : 'transparent'
                      }}
                      onClick={async () => {
                        await changeSection(sec.id);
                        document.getElementById(`section-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <Space size="middle">
                        <span style={{ fontSize: 18, display: 'flex' }}>{sec.icon}</span>
                        <span>{sec.label}</span>
                      </Space>
                      <Typography.Text type={isActive ? undefined : 'secondary'} style={{ fontSize: 11 }}>
                        {sec.minutes}m
                      </Typography.Text>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 16, paddingTop: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Fecha:</Typography.Text>
                  <Typography.Text style={{ fontSize: 12 }}>{dayjs(meeting.meetingDate).format('DD/MM/YYYY')}</Typography.Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Facilitador:</Typography.Text>
                  <Typography.Text style={{ fontSize: 12 }}>{facilitator?.fullName ?? '—'}</Typography.Text>
                </div>
              </Space>
            </div>
          </Card>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="section-segue" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[0].label}
              icon={SECTIONS_CONFIG[0].icon}
              targetMinutes={5}
              active={activeSection === 'segue'}
              onActivate={() => changeSection('segue')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'segue' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'segue' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Buenas noticias personales y profesionales de la semana. Transición mental para conectar al equipo y enfocar la energía antes de revisar métricas."
            >
              <Input.TextArea
                rows={3}
                placeholder="Notas de segue (1 buena noticia personal y 1 profesional por asistente)"
                defaultValue={meeting.segueNotes ?? ''}
                onBlur={(e) => saveSegueNotes(e.target.value)}
              />
            </AgendaSection>
          </div>

          {/* 2. SCORECARD */}
          <div id="section-scorecard" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[1].label}
              icon={SECTIONS_CONFIG[1].icon}
              targetMinutes={5}
              active={activeSection === 'scorecard'}
              onActivate={() => changeSection('scorecard')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'scorecard' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'scorecard' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Revisión rápida de métricas clave. Indicar sólo 'En objetivo' o 'Fuera de objetivo'. No justificar ni discutir aquí; si un número falla, enviar a IDS."
            >
              <div style={{ marginBottom: 12 }}>
                <Radio.Group value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)} size="small">
                  <Radio.Button value="all">Todas</Radio.Button>
                  <Radio.Button value="weekly">Semanales</Radio.Button>
                  <Radio.Button value="monthly">Mensuales</Radio.Button>
                </Radio.Group>
              </div>
              <Table
                className="glass-panel"
                pagination={false}
                size="small"
                dataSource={filteredMetrics}
                rowKey="id"
                columns={[
                  {
                    title: 'Métrica',
                    dataIndex: 'name',
                    key: 'name',
                    sorter: (a, b) => a.name.localeCompare(b.name),
                    render: (name, record) => (
                      <Space>
                        <Icons.BarChartOutlined style={{ color: 'var(--brand-green)' }} />
                        <Typography.Text strong>{name}</Typography.Text>
                        <Tag style={{ fontSize: 9, lineHeight: '14px', height: 16 }}>
                          {record.frequency === 'weekly' ? 'S' : 'M'}
                        </Tag>
                      </Space>
                    )
                  },
                  {
                    title: 'Objetivo',
                    key: 'goal',
                    sorter: (a, b) => a.goalValue - b.goalValue,
                    render: (_, record) => <Typography.Text type="secondary">{record.goalValue} {record.unit}</Typography.Text>
                  },
                  {
                    title: 'Estado',
                    key: 'status',
                    filters: [
                      { text: 'En objetivo', value: 'met' },
                      { text: 'Fuera de objetivo', value: 'missed' },
                    ],
                    onFilter: (value, record) => {
                      const entry = latestEntryFor(record.id);
                      return evaluateGoal(entry?.actualValue ?? null, record.goalValue, record.comparison) === value;
                    },
                    render: (_, record) => {
                      const entry = latestEntryFor(record.id);
                      const status = evaluateGoal(entry?.actualValue ?? null, record.goalValue, record.comparison);
                      return (
                        <Tag 
                          icon={status === 'met' ? <Icons.CheckCircleOutlined /> : status === 'missed' ? <Icons.CloseCircleOutlined /> : undefined}
                          color={status === 'met' ? 'green' : status === 'missed' ? 'red' : 'default'}
                        >
                          {status === 'met' ? 'En objetivo' : status === 'missed' ? 'Fuera de objetivo' : 'Sin datos'}
                        </Tag>
                      );
                    }
                  },
                  {
                    title: 'Valor Actual',
                    key: 'current',
                    render: (_, record) => {
                      const entry = latestEntryFor(record.id);
                      return <span>{entry ? entry.actualValue : '—'} {record.unit}</span>;
                    }
                  },
                  {
                    title: 'Acciones',
                    key: 'actions',
                    render: (_, record) => {
                      const entry = latestEntryFor(record.id);
                      const status = evaluateGoal(entry?.actualValue ?? null, record.goalValue, record.comparison);
                      return (
                        <Button
                          size="small"
                          danger={status === 'missed'}
                          icon={<Icons.SendOutlined />}
                          onClick={() =>
                            dropToIDS(
                              `Scorecard: ${record.name} fuera de objetivo`,
                              `Métrica ${record.name}: valor actual ${entry?.actualValue ?? '—'} vs objetivo ${record.goalValue} ${record.unit}`
                            )
                          }
                        >
                          + IDS
                        </Button>
                      );
                    }
                  }
                ]}
              />
            </AgendaSection>
          </div>

          {/* 3. ROCK REVIEW */}
          <div id="section-rocks" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[2].label}
              icon={SECTIONS_CONFIG[2].icon}
              targetMinutes={5}
              active={activeSection === 'rocks'}
              onActivate={() => changeSection('rocks')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'rocks' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'rocks' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Revisar estado de Rocks de Empresa y Personales del trimestre ('On Track' / 'Off Track'). Si un Rock está Off-track, enviar a IDS para analizar y solucionar bloqueos."
            >
              <div style={{ marginBottom: 16 }}>
                <Space wrap align="center">
                  <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>Filtrar Rocks:</Typography.Text>
                  <Select
                    size="small"
                    value={rockFilter}
                    onChange={setRockFilter}
                    style={{ width: 170 }}
                    options={[
                      { value: 'all', label: 'Todos los Rocks' },
                      { value: 'company', label: '🏢 Rocks de Empresa' },
                      { value: 'personal', label: '👤 Rocks Personales' },
                    ]}
                  />
                </Space>
              </div>

              <Table
                className="glass-panel"
                pagination={false}
                size="small"
                dataSource={filteredRocks}
                rowKey="id"
                columns={[
                  {
                    title: 'Rock',
                    dataIndex: 'title',
                    key: 'title',
                    sorter: (a, b) => a.title.localeCompare(b.title),
                    render: (title) => <Typography.Text strong>{title}</Typography.Text>
                  },
                  {
                    title: 'Tipo',
                    key: 'type',
                    filters: [
                      { text: 'Empresa', value: true },
                      { text: 'Personal', value: false },
                    ],
                    onFilter: (value, record) => record.isCompanyRock === value,
                    render: (_, record) => (
                      <Tag color={record.isCompanyRock ? 'blue' : 'purple'}>
                        {record.isCompanyRock ? 'Empresa' : 'Personal'}
                      </Tag>
                    )
                  },
                  {
                    title: 'Estado',
                    dataIndex: 'status',
                    key: 'status',
                    filters: [
                      { text: 'On Track', value: 'on_track' },
                      { text: 'Off Track', value: 'off_track' },
                      { text: 'Done', value: 'done' },
                    ],
                    onFilter: (value, record) => record.status === value,
                    render: (status) => (
                      <Tag color={status === 'on_track' ? 'green' : status === 'off_track' ? 'red' : 'blue'}>
                        {status}
                      </Tag>
                    )
                  },
                  {
                    title: 'Owner',
                    key: 'owner',
                    filters: members.map(m => ({ text: m.fullName, value: m.userId })),
                    onFilter: (value, record) => record.ownerUserId === value,
                    render: (_, record) => {
                      const owner = members.find((m) => m.userId === record.ownerUserId);
                      return <MemberCell member={owner} />;
                    }
                  },
                  {
                    title: 'Acciones',
                    key: 'actions',
                    render: (_, record) => {
                      const isOffTrack = record.status === 'off_track';
                      const owner = members.find((m) => m.userId === record.ownerUserId);
                      return (
                        <Button
                          size="small"
                          danger={isOffTrack}
                          icon={<Icons.SendOutlined />}
                          onClick={() =>
                            dropToIDS(`Rock off-track: ${record.title}`, `Rock de ${record.isCompanyRock ? 'Empresa' : 'Personal'} desviado. Owner: ${owner?.fullName ?? 'Sin owner'}`)
                          }
                        >
                          + IDS
                        </Button>
                      );
                    }
                  },
                  {
                    title: 'Discusión',
                    key: 'discussion',
                    width: 250,
                    render: (_, record) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Input
                            size="small"
                            placeholder="Añadir nota..."
                            value={rockNoteDrafts[record.id] ?? ''}
                            onChange={(e) => setRockNoteDrafts((prev) => ({ ...prev, [record.id]: e.target.value }))}
                            onPressEnter={() => logRockNote(record.id)}
                          />
                          <Button size="small" icon={<Icons.PlusOutlined />} onClick={() => logRockNote(record.id)} />
                        </div>
                        {logsFor('rock_review', record.id).length > 0 && (
                          <div style={{ maxHeight: 60, overflowY: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.02)', padding: '2px 6px', borderRadius: 4 }}>
                            {logsFor('rock_review', record.id).map((log) => (
                              <div key={log.id}>• {log.notes}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            </AgendaSection>
          </div>

          {/* 4. HEADLINES */}
          <div id="section-headlines" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[3].label}
              icon={SECTIONS_CONFIG[3].icon}
              targetMinutes={5}
              active={activeSection === 'headlines'}
              onActivate={() => changeSection('headlines')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'headlines' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'headlines' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Titulares breves sobre clientes, empleados u organización. Si un titular requiere debate o solución formal, convertirlo en un Issue para IDS."
            >
              <Input.TextArea
                rows={3}
                placeholder="Titulares de clientes y empleados"
                defaultValue={meeting.headlines ?? ''}
                onBlur={(e) => saveHeadlines(e.target.value)}
              />
              {meeting.headlines && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    icon={<Icons.SendOutlined />}
                    onClick={() => dropToIDS(`Titular a tratar: ${meeting.headlines?.slice(0, 50)}...`, meeting.headlines ?? undefined)}
                  >
                    + Convertir Titular en Issue
                  </Button>
                </div>
              )}
            </AgendaSection>
          </div>

          {/* 5. TO-DO LIST */}
          <div id="section-todos" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[4].label}
              icon={SECTIONS_CONFIG[4].icon}
              targetMinutes={5}
              active={activeSection === 'todos'}
              onActivate={() => changeSection('todos')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'todos' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'todos' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Revisión de compromisos a 7 días creados en reuniones previas. 'Hecho' o 'No hecho'. El objetivo del equipo es mantener un nivel de cumplimiento >90%."
            >
              <div style={{ marginBottom: 12 }}>
                <Button icon={<Icons.PlusOutlined />} onClick={() => setCreatingTodo(true)}>
                  Nuevo to-do
                </Button>
              </div>
              <Table
                className="glass-panel"
                pagination={false}
                size="small"
                dataSource={todos}
                rowKey="id"
                columns={[
                  {
                    title: 'Tarea',
                    dataIndex: 'title',
                    key: 'title',
                    sorter: (a, b) => a.title.localeCompare(b.title),
                    render: (title, record) => (
                      <a onClick={() => setEditingTodo(record)} style={{ fontWeight: 600 }}>
                        {title}
                      </a>
                    )
                  },
                  {
                    title: 'Owner',
                    key: 'owner',
                    filters: members.map(m => ({ text: m.fullName, value: m.userId })),
                    onFilter: (value, record) => record.ownerUserId === value,
                    render: (_, record) => {
                      const owner = members.find((m) => m.userId === record.ownerUserId);
                      return <MemberCell member={owner} />;
                    }
                  },
                  {
                    title: 'Fecha Límite',
                    dataIndex: 'dueDate',
                    key: 'dueDate',
                    sorter: (a, b) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
                    render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '—'
                  },
                  {
                    title: 'Acciones',
                    key: 'actions',
                    render: (_, record) => {
                      const owner = members.find((m) => m.userId === record.ownerUserId);
                      return (
                        <Button
                          size="small"
                          icon={<Icons.SendOutlined />}
                          onClick={() => dropToIDS(`To-Do no completado: ${record.title}`, `Owner: ${owner?.fullName ?? 'Sin asignado'}`)}
                        >
                          + IDS
                        </Button>
                      );
                    }
                  }
                ]}
              />
            </AgendaSection>
          </div>

          {/* 6. IDS (IDENTIFY, DISCUSS, SOLVE) */}
          <div id="section-ids" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[5].label}
              icon={SECTIONS_CONFIG[5].icon}
              targetMinutes={60}
              active={activeSection === 'ids'}
              onActivate={() => changeSection('ids')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'ids' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'ids' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Core de la reunión L10 (60 min). Priorizar los Top 3 issues. 1) Identificar la causa raíz real, 2) Discutir soluciones de forma concisa, 3) Resolver creando To-Dos concretos."
            >
              <Table
                className="glass-panel"
                pagination={false}
                size="small"
                dataSource={issues}
                rowKey="id"
                columns={[
                  {
                    title: 'Título',
                    dataIndex: 'title',
                    key: 'title',
                    sorter: (a, b) => a.title.localeCompare(b.title),
                    render: (title, record) => (
                      <div>
                        <Space size="small">
                          <Icons.ExclamationCircleOutlined style={{ color: 'var(--brand-green)' }} />
                          <Typography.Text strong style={{ fontSize: 14 }}>{title}</Typography.Text>
                        </Space>
                        {record.description && (
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                            {record.description}
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    title: 'Prioridad',
                    dataIndex: 'priority',
                    key: 'priority',
                    filters: [
                      { text: 'Alta', value: 'high' },
                      { text: 'Media', value: 'medium' },
                      { text: 'Baja', value: 'low' },
                    ],
                    onFilter: (value, record) => record.priority === value,
                    render: (priority) => (
                      <Tag color={priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'blue'}>
                        {priority.toUpperCase()}
                      </Tag>
                    )
                  },
                  {
                    title: 'Estado',
                    dataIndex: 'status',
                    key: 'status',
                    filters: ISSUE_STATUS_OPTIONS.map(o => ({ text: o.label, value: o.value })),
                    onFilter: (value, record) => record.status === value,
                    render: (status, record) => (
                      <Select
                        size="small"
                        style={{ width: 110 }}
                        value={status}
                        options={ISSUE_STATUS_OPTIONS}
                        onChange={(newStatus) => changeIssueStatus(record.id, newStatus)}
                      />
                    )
                  },
                  {
                    title: 'Acciones',
                    key: 'actions',
                    render: (_, record) => (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<Icons.PlusOutlined />}
                        onClick={() => setCreatingTodo(true)}
                      >
                        + To-Do
                      </Button>
                    )
                  },
                  {
                    title: 'Discusión',
                    key: 'discussion',
                    width: 250,
                    render: (_, record) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Input
                            size="small"
                            placeholder="Añadir nota..."
                            value={issueNoteDrafts[record.id] ?? ''}
                            onChange={(e) => setIssueNoteDrafts((prev) => ({ ...prev, [record.id]: e.target.value }))}
                            onPressEnter={() => logIssueNote(record.id)}
                          />
                          <Button size="small" icon={<Icons.PlusOutlined />} onClick={() => logIssueNote(record.id)} />
                        </div>
                        {logsFor('issue', record.id).length > 0 && (
                          <div style={{ maxHeight: 60, overflowY: 'auto', fontSize: 11, background: 'rgba(0,0,0,0.02)', padding: '2px 6px', borderRadius: 4 }}>
                            {logsFor('issue', record.id).map((log) => (
                              <div key={log.id}>• {log.notes}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            </AgendaSection>
          </div>

          {/* 7. CONCLUDE */}
          <div id="section-conclude" style={{ scrollMarginTop: 24 }}>
            <AgendaSection
              title={SECTIONS_CONFIG[6].label}
              icon={SECTIONS_CONFIG[6].icon}
              targetMinutes={5}
              active={activeSection === 'conclude'}
              onActivate={() => changeSection('conclude')}
              onReset={resetSectionTimer}
              initialSeconds={meeting.currentSectionId === 'conclude' ? meeting.currentSectionAccumulatedSeconds : 0}
              timerStartedAt={meeting.currentSectionId === 'conclude' ? meeting.currentSectionStartedAt : null}
              isPaused={meeting.timerIsPaused}
              description="Cierre impecable: 1) Recapitular To-Dos nuevos creados, 2) Mensajes en cascada para la organización, 3) Cada miembro califica la reunión del 1 al 10 (apuntar a media > 8)."
            >
              <Row gutter={24}>
                <Col xs={24} md={ facilitator ? 12 : 24 }>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <FormItemLabel label="Notas de cierre y mensajes en cascada">
                      <Input.TextArea
                        rows={6}
                        placeholder="Notas de cierre y acuerdos a comunicar a otros equipos"
                        value={concludeNotesDraft}
                        onChange={(e) => setConcludeNotesDraft(e.target.value)}
                        onBlur={(e) => l10Api.update(id!, { concludeNotes: e.target.value })}
                        disabled={meeting.status === 'completed'}
                      />
                    </FormItemLabel>

                    <Button
                      type="primary"
                      size="large"
                      icon={<Icons.CheckCircleOutlined />}
                      disabled={meeting.status === 'completed'}
                      onClick={() => setEndMeetingModalOpen(true)}
                    >
                      Cerrar reunión L10
                    </Button>
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <FormItemLabel label={`Calificaciones del equipo${meeting.overallRating ? ` (Media: ${meeting.overallRating.toFixed(1)})` : ''}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {members.map((member) => {
                        const memberRating = memberRatingsDraft[member.userId] ?? null;
                        const isMe = member.userId === currentUser?.id;
                        const canEdit = isMe || canManageMeeting;

                        return (
                          <div
                            key={member.userId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: isMe ? 'rgba(var(--brand-green-rgb), 0.05)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 8,
                              border: isMe ? '1px solid var(--brand-green)' : '1px solid rgba(0,0,0,0.06)',
                            }}
                          >
                            <Space align="center">
                              <MemberCell member={member} />
                              {isMe && <Tag color="green">Yo</Tag>}
                            </Space>
                            <InputNumber
                              min={1}
                              max={10}
                              value={memberRating}
                              onChange={(value) => setMemberRatingsDraft((prev) => ({ ...prev, [member.userId]: value }))}
                              onBlur={() => canEdit && handleSubmitMemberRating(member.userId, memberRatingsDraft[member.userId])}
                              placeholder="-"
                              style={{ width: 60, textAlign: 'center' }}
                              disabled={!canEdit || meeting.status === 'completed'}
                            />
                          </div>
                        );
                      })}
                      {members.length === 0 && (
                        <Typography.Text type="secondary">No hay miembros</Typography.Text>
                      )}
                    </div>
                  </FormItemLabel>
                </Col>
              </Row>
            </AgendaSection>
          </div>
        </div>
      </div>

      {(creatingTodo || editingTodo) && (
        <TodoFormModal
          open
          todo={editingTodo ?? undefined}
          members={members}
          meetingId={id}
          onClose={() => {
            setCreatingTodo(false);
            setEditingTodo(null);
          }}
          onSaved={() => {
            setCreatingTodo(false);
            setEditingTodo(null);
            refetchTodos();
          }}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN PARA TERMINAR REUNIÓN */}
      <Modal
        title="Terminar reunión L10"
        open={endMeetingModalOpen}
        onCancel={() => setEndMeetingModalOpen(false)}
        footer={null}
        destroyOnHidden 

      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            Vas a finalizar la reunión L10. La calificación promedio actual es{' '}
            <strong>{meeting.overallRating ? `${meeting.overallRating.toFixed(1)}/10` : 'N/A'}</strong>
            {' '}({meeting.ratings?.length ?? 0} votos).
          </Typography.Paragraph>

          <FormItemLabel label="Notas de cierre y mensajes en cascada">
            <Input.TextArea
              rows={3}
              placeholder="Opcional - Notas de cierre y acuerdos a comunicar"
              value={concludeNotesDraft}
              onChange={(e) => setConcludeNotesDraft(e.target.value)}
            />
          </FormItemLabel>

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setEndMeetingModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="primary"
              danger
              icon={<Icons.CheckCircleOutlined />}
              onClick={async () => {
                await closeMeeting();
                setEndMeetingModalOpen(false);
              }}
            >
              Confirmar y cerrar reunión
            </Button>
          </Space>
        </div>
      </Modal>
    </Template>
  );
}

function FormItemLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography.Text strong style={{ fontSize: 13 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}
