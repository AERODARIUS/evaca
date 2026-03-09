import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { App } from './App';
import { appTheme } from './theme/theme';
import 'antd/dist/reset.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={appTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
