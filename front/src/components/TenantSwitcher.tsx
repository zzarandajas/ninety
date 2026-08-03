import { Select } from 'antd';
import { useAuthStore, type TenantMembershipView } from '../store/authStore';

function renderTenantIcon(tenant: TenantMembershipView) {
  if (tenant.isotypeUrl) {
    return (
      <img
        src={`/api${tenant.isotypeUrl}`}
        alt=""
        style={{ width: 16, height: 16, objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    );
  }
  if (tenant.logoUrl) {
    return (
      <img
        src={`/api${tenant.logoUrl}`}
        alt=""
        style={{ width: 16, height: 16, objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        display: 'inline-block',
        backgroundColor: tenant.accentColor || '#16983c',
        flexShrink: 0,
      }}
    />
  );
}

function renderTenantLabel(tenant: TenantMembershipView) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        lineHeight: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {renderTenantIcon(tenant)}
      <span
        style={{
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {tenant.tenantName}
      </span>
    </span>
  );
}

export function TenantSwitcher() {
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const setActiveTenant = useAuthStore((state) => state.setActiveTenant);

  if (tenants.length < 2) return null;

  const tenantById = (tenantId: string) => tenants.find((t) => t.tenantId === tenantId);

  return (
    <Select
      className="tenant-switcher"
      classNames={{ popup: { root: 'tenant-switcher-popup' } }}
      value={activeTenantId ?? undefined}
      onChange={setActiveTenant}
      style={{ minWidth: 180 }}
      options={tenants.map((tenant) => ({
        value: tenant.tenantId,
        label: tenant.tenantName,
        data: tenant,
      }))}
      labelRender={(props) => {
        const tenant = tenantById(String(props.value));
        return tenant ? renderTenantLabel(tenant) : props.label;
      }}
      optionRender={(option) => {
        const tenant = tenantById(String(option.value));
        return tenant ? renderTenantLabel(tenant) : option.label;
      }}
    />
  );
}
