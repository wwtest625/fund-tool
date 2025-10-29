import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import PopupApp from './PopupApp.vue';
import './style.css';

if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {
      NODE_ENV: import.meta.env.MODE || 'production'
    }
  } as typeof process;
  if (import.meta.env.DEV) {
    console.info('[popup] injected process shim', window.process.env.NODE_ENV);
  }
}

if (import.meta.env.DEV) {
  console.info('[popup] Vue app mounting');
}

const app = createApp(PopupApp);

app.use(TDesign);

app.mount('#popup-app-root');

if (import.meta.env.DEV) {
  console.info('[popup] Vue app mounted');
}
