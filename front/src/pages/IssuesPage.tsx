import * as Icons from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, message, Select, Space, Table, Tag } from 'antd';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { IssueFormModal } from '../components/IssueFormModal';
import { Template } from '../components/Template';
import { MemberCell } from '../components/UserAvatar';
import { issuesApi, type Issue, type IssueStatus } from '../lib/issuesApi';
import { reorderIds } from '../lib/reorder';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { currentQuarter } from '../lib/quarters';
import { CustomSection } from '../components/Templates';

const QUARTER_STORAGE_KEY = 'issues.activeQuarter';

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  discussing: 'Discussing',
  solved: 'Solved',
  dropped: 'Dropped',
};

const PRIORITY_LABEL: Record<Issue['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
}

const RowContext = createContext<RowContextProps>({});

function DragHandle() {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <Icons.MenuOutlined
      ref={setActivatorNodeRef}
      aria-label="Arrastrar para reordenar"
      style={{ touchAction: 'none', cursor: 'grab' }}
      {...listeners}
    />
  );
}

function DraggableRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
    attributes: { role: 'row' },
  });
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };
  const contextValue = useMemo(() => ({ setActivatorNodeRef, listeners }), [setActivatorNodeRef, listeners]);
  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowContext.Provider>
  );
}

function BodyRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string }) {
  const rowKey = props['data-row-key'];
  if (!rowKey) return <tr {...props} />;
  return <DraggableRow {...props} data-row-key={rowKey} />;
}

export function IssuesPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [quarter, setQuarter] = useState<string | undefined>(() => {
    const saved = localStorage.getItem(QUARTER_STORAGE_KEY);
    return saved ?? currentQuarter();
  });
  const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
  const [modalIssue, setModalIssue] = useState<Issue | 'new' | null>(null);

  const quarterOptions = useQuarterOptions(issues.map((i) => i.quarter));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function refetchIssues() {
    return issuesApi
      .list({ status: statusFilter, quarter })
      .then(setIssues)
      .catch((e) => message.error(errorMessage(e)));
  }

  useEffect(() => {
    refetchIssues();
  }, [statusFilter, quarter, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'issue') {
      refetchIssues();
    }
  });

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  function handleQuarterChange(value: string | undefined) {
    setQuarter(value);
    if (value) {
      localStorage.setItem(QUARTER_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(QUARTER_STORAGE_KEY);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = issues.map((issue) => issue.id);
    const newIds = reorderIds(ids, String(active.id), String(over.id));
    setIssues(newIds.map((id) => issues.find((issue) => issue.id === id)!));
    issuesApi.reorder(newIds).catch((e) => {
      message.error(errorMessage(e));
      refetchIssues();
    });
  }

  const columns = [
    ...(statusFilter
      ? []
      : [{ title: '', key: 'drag', width: 32, render: () => <DragHandle /> }]),
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, issue: Issue) => (
        <Space>
          <Icons.ExclamationCircleOutlined style={{ color: 'var(--brand-green)' }} />
          <a onClick={() => setModalIssue(issue)}>{title}</a>
        </Space>
      ),
    },
    { title: 'Prioridad', dataIndex: 'priority', key: 'priority', render: (p: Issue['priority']) => PRIORITY_LABEL[p] },
    { title: 'Estado', dataIndex: 'status', key: 'status', render: (s: IssueStatus) => <Tag>{STATUS_LABEL[s]}</Tag> },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: unknown, issue: Issue) => {
        const member = members.find((m) => m.userId === issue.raisedByUserId);
        return <MemberCell member={member} fallback="—" />;
      },
    },
        {
      title: 'Trimestre',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
  ];

  return (
    <Template
      title="Issues"
      icon={<Icons.ExclamationCircleOutlined />}
      subtitle="Backlog de issues priorizados para IDS: identificar, discutir y resolver."
      extra={

          <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => setModalIssue('new')}>
            Nuevo issue
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
          <Select
            allowClear
            aria-label="Estado"
            placeholder="Estado"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={(Object.keys(STATUS_LABEL) as IssueStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </Space>
        }
      >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <Table
            className="glass-panel"
            components={statusFilter ? undefined : { body: { row: BodyRow } }}
            dataSource={issues}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </SortableContext>
      </DndContext>        
      </CustomSection>



      {modalIssue && (
        <IssueFormModal
          open
          issue={modalIssue === 'new' ? undefined : modalIssue}
          members={members}
          quarter={quarter}
          onClose={() => setModalIssue(null)}
          onSaved={() => {
            setModalIssue(null);
            refetchIssues();
          }}
        />
      )}
    </Template>
  );
}
