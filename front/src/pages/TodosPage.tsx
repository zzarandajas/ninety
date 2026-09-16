import * as Icons from '@ant-design/icons';
import { Button, Checkbox, message, Popconfirm, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { RichTextView } from '../components/RichTextView';
import { TodoFormModal } from '../components/TodoFormModal';
import { Template } from '../components/Template';
import { MemberCell } from '../components/UserAvatar';
import { todosApi, type Todo, type TodoStatus } from '../lib/todosApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

import { useQuarterOptions } from '../hooks/useQuarterOptions';
import { currentQuarter } from '../lib/quarters';
import { CustomSection } from '../components/Templates';

const QUARTER_STORAGE_KEY = 'todos.activeQuarter';

const STATUS_LABEL: Record<TodoStatus, string> = {
  open: 'Pendiente',
  done: 'Completado',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function TodosPage() {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const tenants = useAuthStore((state) => state.tenants);
  const role = tenants.find((t) => t.tenantId === activeTenantId)?.role;
  const canDelete = role === 'owner' || role === 'admin';

  const [todos, setTodos] = useState<Todo[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [quarter, setQuarter] = useState<string | undefined>(() => {
    const saved = localStorage.getItem(QUARTER_STORAGE_KEY);
    return saved ?? currentQuarter();
  });
  const [statusFilter, setStatusFilter] = useState<TodoStatus | undefined>(undefined);
  const [modalTodo, setModalTodo] = useState<Todo | 'new' | null>(null);

  const quarterOptions = useQuarterOptions(todos.map((t) => t.quarter));

  function refetchTodos() {
    return todosApi
      .list({ status: statusFilter, quarter })
      .then(setTodos)
      .catch((e) => message.error(errorMessage(e)));
  }

  useEffect(() => {
    refetchTodos();
  }, [statusFilter, quarter, activeTenantId]);

  useRealtimeSync((event) => {
    if (event.entity === 'todo') {
      refetchTodos();
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

  function handleToggle(todo: Todo) {
    const newStatus: TodoStatus = todo.status === 'done' ? 'open' : 'done';
    todosApi
      .update(todo.id, { status: newStatus })
      .then(() => refetchTodos())
      .catch((e) => message.error(errorMessage(e)));
  }

  function handleDelete(todoId: string) {
    todosApi
      .remove(todoId)
      .then(() => {
        message.success('To-Do eliminado');
        refetchTodos();
      })
      .catch((e) => message.error(errorMessage(e)));
  }

  const columns = [
    {
      title: '',
      key: 'check',
      width: 72,
      render: (_: unknown, todo: Todo) => (
        <span style={{ display: 'inline-flex', transform: 'scale(1.7)', transformOrigin: 'left center', lineHeight: 0 }}>
          <Checkbox checked={todo.status === 'done'} onChange={() => handleToggle(todo)} />
        </span>
      ),
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, todo: Todo) => (
        <a onClick={() => setModalTodo(todo)}>
          <Space size={8} align="start">
            <Icons.CheckSquareOutlined style={{ color: todo.status === 'done' ? '#52c41a' : undefined, marginTop: 3 }} />
            <RichTextView
              html={title}
              style={{ textDecoration: todo.status === 'done' ? 'line-through' : undefined, color: 'inherit' }}
            />
          </Space>
        </a>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: unknown, todo: Todo) => {
        const member = members.find((m) => m.userId === todo.ownerUserId);
        return <MemberCell member={member} fallback="—" />;
      },
    },
    {
      title: 'Fecha límite',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate: string | null) => (dueDate ? dayjs(dueDate).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (s: TodoStatus) => <Tag color={s === 'done' ? 'green' : 'orange'}>{STATUS_LABEL[s]}</Tag>,
    },
        {
      title: 'Trimestre',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
    ...(canDelete
      ? [
          {
            title: '',
            key: 'actions',
            width: 48,
            render: (_: unknown, todo: Todo) => (
              <Popconfirm
                title="¿Eliminar este To-Do?"
                onConfirm={() => handleDelete(todo.id)}
                okText="Sí"
                cancelText="No"
              >
                <Button type="text" danger icon={<Icons.DeleteOutlined />} size="small" />
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  return (
    <Template
      title="To-Dos"
      icon={<Icons.CheckSquareOutlined />}
      subtitle="Compromisos a 7 días del equipo. Cada To-Do debe tener un owner y una fecha límite."
      extra={

          <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => setModalTodo('new')}>
            Nuevo To-Do
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
            options={(Object.keys(STATUS_LABEL) as TodoStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </Space>
        }
      >


      <Table
        className="glass-panel"
        dataSource={todos}
        columns={columns}
        rowKey="id"
        pagination={false}
      />

      </CustomSection>
      
      {modalTodo && (
        <TodoFormModal
          open
          todo={modalTodo === 'new' ? undefined : modalTodo}
          members={members}
          quarter={quarter}
          onClose={() => setModalTodo(null)}
          onSaved={() => {
            setModalTodo(null);
            refetchTodos();
          }}
        />
      )}
    </Template>
  );
}
