import { ConfigProvider } from 'antd';
import esES from 'antd/es/locale/es_ES';
import { useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AccountPage } from './pages/AccountPage';
import { AccountabilityChartPage } from './pages/AccountabilityChartPage';
import { AdminPage } from './pages/AdminPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { IssuesPage } from './pages/IssuesPage';
import { L10LiveMeetingPage } from './pages/L10LiveMeetingPage';
import { L10MeetingsPage } from './pages/L10MeetingsPage';
import { LoginPage } from './pages/LoginPage';
import { RocksBoard } from './pages/RocksBoard';
import { ScorecardPage } from './pages/ScorecardPage';
import { TodosPage } from './pages/TodosPage';
import { VTOPage } from './pages/VTOPage';
import { useAuthStore } from './store/authStore';
import { glassThemeConfig } from './theme/glassTokens';

function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId);

  useEffect(() => {
    const bgColor = activeTenant?.bgColor || '#eef2f0';
    const accentColor = activeTenant?.accentColor || '#16983c';

    // Set CSS variables on root element
    document.documentElement.style.setProperty('--tenant-bg', bgColor);
    document.documentElement.style.setProperty('--brand-green', accentColor);
    document.documentElement.style.setProperty('--brand-green-glow', `${accentColor}25`);
    document.documentElement.style.setProperty('--brand-green-tint', `${accentColor}18`);
    document.documentElement.style.setProperty('--brand-green-border', `${accentColor}33`);
    document.documentElement.style.setProperty('--brand-green-shadow', `${accentColor}47`);
    document.documentElement.style.setProperty('--brand-green-shadow-sm', `${accentColor}40`);
    document.documentElement.style.setProperty('--brand-green-dark', accentColor);

    // Also update body inline background color
    document.body.style.backgroundColor = bgColor;
  }, [activeTenant?.bgColor, activeTenant?.accentColor]);

  const themeConfig = useMemo(() => {
    const accent = activeTenant?.accentColor || '#16983c';
    return {
      ...glassThemeConfig,
      token: {
        ...glassThemeConfig.token,
        colorPrimary: accent,
        colorLink: accent,
        colorInfo: accent,
      },
      components: {
        ...glassThemeConfig.components,
        Button: {
          ...glassThemeConfig.components?.Button,
          colorPrimary: accent,
          colorPrimaryHover: accent,
          colorPrimaryActive: accent,
        },
        Menu: {
          ...glassThemeConfig.components?.Menu,
          itemHoverBg: `${accent}14`,
          itemHoverColor: accent,
          itemSelectedBg: `${accent}29`,
          itemSelectedColor: accent,
        },
        Tabs: {
          ...glassThemeConfig.components?.Tabs,
          itemSelectedColor: accent,
          itemHoverColor: accent,
          inkBarColor: accent,
        },
      },
    };
  }, [activeTenant?.accentColor]);

  return <ConfigProvider theme={themeConfig} locale={esES}>{children}</ConfigProvider>;
}

export function App() {
  return (
    <DynamicThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/rocks" element={<RocksBoard />} />
            <Route path="/scorecard" element={<ScorecardPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/todos" element={<TodosPage />} />
            <Route path="/l10" element={<L10MeetingsPage />} />
            <Route path="/l10/:id" element={<L10LiveMeetingPage />} />
            <Route path="/accountability-chart" element={<AccountabilityChartPage />} />
            <Route path="/vto" element={<VTOPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </DynamicThemeProvider>
  );
}
