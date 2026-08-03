import {
  ApartmentOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  CompassOutlined,
  CrownOutlined,
  DashboardOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RocketOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Modal, Typography, type MenuProps } from 'antd';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useAuthStore } from '../store/authStore';
import { PageHeaderContext, type PageHeaderData } from './pageHeaderContext';
import { GodModeSelector } from './GodModeSelector';
import { ImpersonationBanner } from './ImpersonationBanner';
import { TenantSwitcher } from './TenantSwitcher';

const NAV_ITEMS = [
  { key: '/dashboard', title: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/scorecard', title: 'Scorecard', icon: <BarChartOutlined /> },
  { key: '/rocks', title: 'Rocks', icon: <RocketOutlined /> },
  { key: '/todos', title: 'To-Dos', icon: <CheckSquareOutlined /> },
  { key: '/issues', title: 'Issues', icon: <ExclamationCircleOutlined /> },
  { key: '/l10', title: 'L10', icon: <CalendarOutlined /> },
  { key: '/accountability-chart', title: 'Accountability Chart', icon: <ApartmentOutlined /> },
  { key: '/vto', title: 'V/TO', icon: <CompassOutlined /> },
];

function matchedNavItem(pathname: string) {
  return NAV_ITEMS.find((item) => pathname === item.key || pathname.startsWith(`${item.key}/`));
}

function pageTitle(pathname: string, fallback: string): string {
  if (pathname.startsWith('/l10/')) return 'Reunión L10';
  if (pathname === '/account') return 'Mi Cuenta';
  if (pathname === '/admin') return 'Administración';
  return matchedNavItem(pathname)?.title ?? fallback;
}

export function AppLayout() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const impersonating = useAuthStore((state) => state.impersonation != null);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [pageHeader, setPageHeader] = useState<PageHeaderData | null>(null);

  useRealtimeSync();

  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  const activeTenant = tenants.find((tenant) => tenant.tenantId === activeTenantId);
  const activeRole = activeTenant?.role;
  const isAdmin = activeRole === 'owner' || activeRole === 'admin';
  const isOwner = activeRole === 'owner';
  const selectedNavItem = matchedNavItem(location.pathname);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'account',
      icon: <UserOutlined />,
      label: 'Mi Cuenta',
      onClick: () => navigate('/account'),
    },
    ...(isAdmin
      ? [
        {
          key: 'admin',
          icon: <SettingOutlined />,
          label: 'Administración',
          onClick: () => navigate('/admin'),
        },
      ]
      : []),
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Salir',
      danger: true,
      onClick: () =>
        Modal.confirm({
          title: '¿Cerrar sesión?',
          icon: <ExclamationCircleOutlined />,
          content: '¿Seguro que quieres salir de la aplicación?',
          okText: 'Salir',
          cancelText: 'Cancelar',
          onOk: logout,
        }),
    },
  ];

  return (
    <PageHeaderContext.Provider value={setPageHeader}>
      <Layout style={{ height: '100dvh', overflow: 'hidden', background: 'transparent' }}>
        <Layout.Sider
          className="glass-panel app-sider"
          style={{ margin: '16px 0 16px 16px', border: '2px solid transparent' }}
          theme="light"
          width={232}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
        >
          <div className="app-sider-brand">
            {collapsed ? (
              <div className="app-sider-brand-collapsed">
                {activeTenant?.isotypeUrl ? (
                  <img
                    src={`/api${activeTenant.isotypeUrl}`}
                    alt="isotype"
                    style={{ maxHeight: 28, maxWidth: 28, objectFit: 'contain' }}
                  />
                ) : (
                  <span className="app-sider-brand-mark" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                <button
                  type="button"
                  className="app-sider-toggle"
                  onClick={() => setCollapsed(false)}
                  title="Expandir menú"
                  aria-label="Expandir menú"
                >
                  <MenuUnfoldOutlined />
                </button>
              </div>
            ) : (
              <>
                <div className="app-sider-brand-logo">
                  {activeTenant?.logoUrl ? (
                    <img
                      src={`/api${activeTenant.logoUrl}`}
                      alt={activeTenant.tenantName}
                      style={{ maxHeight: 32, maxWidth: 140, objectFit: 'contain' }}
                    />
                  ) : (
                    <>
                      {activeTenant?.isotypeUrl && (
                        <img
                          src={`/api${activeTenant.isotypeUrl}`}
                          alt="isotype"
                          style={{ maxHeight: 28, maxWidth: 28, objectFit: 'contain' }}
                        />
                      )}
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {activeTenant?.tenantName}
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="app-sider-toggle"
                  onClick={() => setCollapsed(true)}
                  title="Contraer menú"
                  aria-label="Contraer menú"
                >
                  <MenuFoldOutlined />
                </button>
              </>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedNavItem ? [selectedNavItem.key] : []}
            items={NAV_ITEMS.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: <Link to={item.key}>{item.title}</Link>,
            }))}
          />
        </Layout.Sider>
        <Layout style={{ background: 'transparent', minWidth: 0, overflow: 'hidden' }}>
          {impersonating && <ImpersonationBanner />}
          <Layout.Header className="glass-panel app-header-bar" style={{ margin: 16, padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div className="icon-tile">
                {pageHeader?.icon ?? selectedNavItem?.icon ?? <DashboardOutlined />}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <Typography.Title
                  level={4}
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    color: 'var(--corp-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pageHeader?.title ?? pageTitle(location.pathname, activeTenant?.tenantName ?? 'EOS Tool')}
                </Typography.Title>
                {pageHeader?.subtitle != null && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--corp-ink-muted)',
                      marginTop: 2,
                      lineHeight: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 560,
                    }}
                  >
                    {pageHeader.subtitle}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'flex-end',
                minWidth: 0,
                flexWrap: 'wrap',
              }}
            >
              {isOwner && !impersonating && <GodModeSelector />}
              <TenantSwitcher />

              <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                <Button
                  type="text"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 'auto',
                    padding: '4px 8px',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{user?.fullName}</span>
                  {isOwner && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(250, 173, 20, 0.2)',
                        borderRadius: 4,
                        padding: '2px 5px',
                      }}
                    >
                      <CrownOutlined style={{ fontSize: 12, color: '#d48806' }} />
                    </span>
                  )}
                  <Avatar
                    size={28}
                    src={user?.avatarUrl ? `/api${user.avatarUrl}` : undefined}
                    icon={!user?.avatarUrl ? <UserOutlined /> : undefined}
                  />
                  <DownOutlined style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)' }} />
                </Button>
              </Dropdown>
            </div>
          </Layout.Header>
          <Layout.Content
            className="glass-panel app-content-area"
            style={{ margin: '0 16px 16px', padding: 24, overflow: 'auto', minHeight: 0 }}
          >
            <Outlet />
          </Layout.Content>
        </Layout>
      </Layout>
    </PageHeaderContext.Provider>
  );
}
