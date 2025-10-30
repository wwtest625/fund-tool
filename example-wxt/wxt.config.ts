import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  manifest: {
    name: '投投是道',
    description: '一款简单的基金定投助手',
    version: '1.6.6',
    action: {
      default_title: '投投是道'
    },
    permissions: ['alarms', 'notifications', 'storage'],
    host_permissions: [
      '*://*.1234567.com.cn/*',
      '*://*.eastmoney.com/*',
      '*://fund.pescms.com/*',
      'http://192.2.123.34:8000/*'
    ],
    homepage_url: 'https://www.pescms.com'
  },
  vite: () => ({
    plugins: [vue()],
    define: {
      'process.env': {}
    }
  })
});
