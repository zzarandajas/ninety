import type { ThemeConfig } from 'antd';

export const glassThemeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#16983c',
    colorLink: '#16983c',
    colorInfo: '#16983c',
    colorBgContainer: 'rgba(255, 255, 255, 0.92)',
    colorBgElevated: 'rgba(255, 255, 255, 0.92)',
    colorBorder: 'rgba(15, 23, 42, 0.12)',
    borderRadius: 12,
    fontSize: 14,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      siderBg: 'transparent',
      headerBg: 'transparent',
      bodyBg: 'transparent',
      triggerHeight: 40,
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemColor: '#334155',
      itemHoverBg: 'rgba(22, 152, 60, 0.08)',
      itemHoverColor: '#0f6e2c',
      itemSelectedBg: 'rgba(22, 152, 60, 0.16)',
      itemSelectedColor: '#0f6e2c',
      itemBorderRadius: 10,
      itemMarginInline: 0,
    },
    Modal: {
      contentBg: 'rgba(255, 255, 255, 0.92)',
      headerBg: 'transparent',
      titleColor: '#0f172a',
      borderRadiusLG: 20,
      paddingMD: 24,
      paddingContentHorizontalLG: 28,
    },
    Drawer: {
      colorBgElevated: 'rgba(255, 255, 255, 0.94)',
    },
    Form: {
      labelFontSize: 13,
      labelColor: '#334155',
      itemMarginBottom: 18,
    },
    Input: {
      colorBgContainer: 'rgba(255, 255, 255, 0.85)',
      controlHeight: 40,
      borderRadius: 10,
    },
    Select: {
      colorBgContainer: 'rgba(255, 255, 255, 0.85)',
      controlHeight: 40,
      borderRadius: 10,
    },
    DatePicker: {
      colorBgContainer: 'rgba(255, 255, 255, 0.85)',
      controlHeight: 40,
      borderRadius: 10,
    },
    InputNumber: {
      colorBgContainer: 'rgba(255, 255, 255, 0.85)',
      controlHeight: 40,
      borderRadius: 10,
    },
    Button: {
      controlHeight: 40,
      borderRadius: 10,
      fontWeight: 600,
    },
  },
};
