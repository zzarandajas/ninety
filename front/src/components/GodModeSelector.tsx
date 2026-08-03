import { CrownOutlined } from '@ant-design/icons';
import { Select, message } from 'antd';
import { useEffect, useState } from 'react';
import { impersonateApi, type ImpersonatableUser } from '../lib/impersonateApi';
import { useAuthStore } from '../store/authStore';

function renderOptionContent(user: ImpersonatableUser) {
  return (
    <span className="god-mode-option">
      <span className="god-mode-option__name">{user.fullName}</span>
      <span className="god-mode-option__meta">
        {user.email}
        {user.memberships.length > 0 && ` · ${user.memberships.map((m) => m.tenantName).join(', ')}`}
      </span>
    </span>
  );
}

/**
 * Selector "Modo dios": solo lo ve el owner y permite suplantar la sesión de
 * cualquier usuario para probar la app como si fueras esa persona. El disparador
 * siempre muestra "Modo dios" (nunca guarda selección): cada elección lanza una
 * simulación nueva.
 */
export function GodModeSelector() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const impersonate = useAuthStore((state) => state.impersonate);
  const [users, setUsers] = useState<ImpersonatableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    impersonateApi
      .listUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleImpersonate(userId: string) {
    try {
      const payload = await impersonateApi.impersonate(userId);
      impersonate(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'No se pudo iniciar la simulación');
    }
  }

  if (loadFailed) return null;

  const options = users
    .filter((user) => user.id !== currentUserId)
    .map((user) => ({
      value: user.id,
      label: user.fullName,
      data: user,
    }));

  return (
    <Select
      className="god-mode-selector"
      classNames={{ popup: { root: 'god-mode-selector-popup' } }}
      value={selected}
      placeholder={
        <span className="god-mode-selector__trigger">
          <CrownOutlined /> Modo dios
        </span>
      }
      labelRender={() => (
        <span className="god-mode-selector__trigger">
          <CrownOutlined /> Modo dios
        </span>
      )}
      loading={loading}
      showSearch
      optionFilterProp="label"
      style={{ minWidth: 190 }}
      onChange={(value) => {
        setSelected(null);
        if (!value) return;
        void handleImpersonate(value);
      }}
      options={options}
      optionRender={(option) => {
        const user = users.find((u) => u.id === String(option.value));
        return user ? renderOptionContent(user) : option.label;
      }}
    />
  );
}
