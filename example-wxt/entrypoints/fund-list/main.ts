import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import FundListApp from './FundListApp.vue';
import './style.css';

const app = createApp(FundListApp);

app.use(TDesign);

app.mount('#fund-list-root');
