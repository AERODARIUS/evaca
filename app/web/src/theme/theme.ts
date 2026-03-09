import { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1f6f78',
    colorInfo: '#1f6f78',
    colorSuccess: '#2e7d32',
    colorWarning: '#b26a00',
    colorError: '#a32626',
    colorText: '#1f2933',
    colorTextSecondary: '#52606d',
    colorBgBase: '#f5f8fb',
    colorBgContainer: '#ffffff',
    borderRadius: 12,
    borderRadiusLG: 16,
    controlHeight: 42,
    lineWidth: 1,
    fontSize: 15,
    fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
    wireframe: false,
  },
  components: {
    Form: {
      itemMarginBottom: 16,
      labelColor: '#243b53',
      labelFontSize: 14,
      verticalLabelPadding: '0 0 6px',
    },
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      fontWeight: 600,
    },
    Card: {
      borderRadiusLG: 16,
    },
    Typography: {
      titleMarginBottom: 0,
      titleMarginTop: 0,
    },
  },
};
