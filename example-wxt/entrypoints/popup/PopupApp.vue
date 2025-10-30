<template>
  <div class="popup-root">
    <div class="background-layer" :style="{ backgroundImage: currentBackground }"></div>
    <div class="content-layer">
      <t-card bordered shadow="hover" class="welcome-card">
        <template #title>
          <div class="welcome-title">
            <span class="welcome-heading">你好，投资者</span>
            <span class="welcome-subtitle">这是你定投的第 <span class="days-number">{{ investmentDays }}</span> 天</span>
          </div>
        </template>
        <template #actions>
          <t-space size="small" wrap>
            <t-button
              v-for="action in headerActions"
              :key="action.label"
              :theme="action.theme"
              :variant="action.variant"
              shape="round"
              size="small"
              @click="action.handler"
            >
              {{ action.label }}
            </t-button>
          </t-space>
        </template>
      </t-card>

      <t-card bordered shadow="hover" class="quote-card">
        <div class="quote-body">
          <p class="quote-text">“{{ currentQuote.text }}”</p>
          <p class="quote-author">—— {{ currentQuote.author }}</p>
        </div>
      </t-card>

      <t-card bordered shadow="hover" class="index-board">
        <template #title>
          <div class="index-title">
            <span class="index-heading">市场速览</span>
            <span class="index-subtitle">四大核心指标，帮你把握当下节奏</span>
          </div>
        </template>
        <div class="index-body">
          <t-alert v-if="indexError" theme="error" :message="indexError" class="index-alert" closeable />
          <t-loading v-else-if="indexLoading" size="medium" text="指数加载中..." />
          <div v-else class="index-grid">
            <div v-for="item in indices" :key="item.id" class="index-cell">
              <div class="index-cell-header">
                <span class="index-name">{{ item.name }}</span>
                <span class="index-symbol">{{ item.displaySymbol }}</span>
              </div>
              <div class="index-value">{{ formatValue(item.last, item.currency) }}</div>
              <div class="index-deltas" :class="trendClass(item.change)">
                <span>{{ formatSigned(item.change) }}</span>
                <span>({{ formatPercent(item.changePercent) }})</span>
              </div>
            </div>
          </div>
        </div>
      </t-card>
    </div>

    <t-dialog v-model:visible="donationVisible" header="捐赠支持" :footer="null" width="360px">
      <p class="dialog-text">感谢您对基金定投助手的支持，您的鼓励能帮助我们持续优化体验。</p>
      <p class="dialog-tip">（此处可展示赞助二维码）</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { CloudUploadIcon, HelpCircleIcon, HeartIcon, ViewListIcon } from 'tdesign-icons-vue-next';
import { fetchMarketIndexes } from '@/lib/fund-service';
import type { MarketIndexResponse } from '@/lib/fund-service';
import { storageApi } from '@/lib/storage';

const INSTALL_STORAGE_KEY = 'ft_install_timestamp_v2';

interface MarketIndex {
  id: string;
  name: string;
  displaySymbol: string;
  last: number | null;
  change: number | null;
  changePercent: number | null;
  currency?: string | null;
  updatedAt?: string | null;
}

interface QuoteItem {
  text: string;
  author: string;
}

const donationVisible = ref(false);
const investmentDays = ref(1);
const currentBackground = ref('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
const indexLoading = ref(false);
const indexError = ref('');
const indices = ref<MarketIndex[]>([]);

const backgrounds = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)'
];

const quotes: QuoteItem[] = [
  { text: '滚雪球要学会两件事：找到湿雪和长坡。', author: '沃伦·巴菲特' },
  { text: '市场在短期是投票机，在长期是称重机。', author: '本杰明·格雷厄姆' },
  { text: '种一棵树最好的时间是十年前，其次是现在。', author: '中国谚语' },
  { text: '复利是世界第八大奇迹。', author: '阿尔伯特·爱因斯坦' },
  { text: '定期投入，让纪律替你做决定。', author: '约翰·博格' },
  { text: '当别人贪婪时要恐惧，当别人恐惧时要贪婪。', author: '沃伦·巴菲特' },
  { text: '波动不是风险，卖在低点才是。', author: '查理·芒格' },
  { text: '别把所有精力放在预测上，把更多时间留给行动。', author: '彼得·林奇' },
  { text: '最重要的是保持现金流和良好的心态。', author: '霍华德·马克斯' },
  { text: '不要试图把握每一次波动，关键是留在市场里。', author: '瑞·达利欧' }
];

const currentQuote = ref<QuoteItem>(quotes[0]);

const indexTargets: MarketIndex[] = [
  { id: 'nasdaq', name: '纳斯达克指数', displaySymbol: 'NASDAQ', last: null, change: null, changePercent: null, currency: 'USD' },
  { id: 'sp500', name: '标普五百', displaySymbol: 'S&P 500', last: null, change: null, changePercent: null, currency: 'USD' },
  { id: 'lbma-gold', name: 'LBMA 金价', displaySymbol: 'LBMA', last: null, change: null, changePercent: null, currency: 'USD/盎司' },
  { id: 'sse', name: '上证指数', displaySymbol: 'SSE', last: null, change: null, changePercent: null, currency: 'CNY' }
];

indices.value = indexTargets.map((item) => ({ ...item }));

const headerActions = [
  {
    label: '帮助文档',
    icon: HelpCircleIcon,
    theme: 'default',
    variant: 'outline' as const,
    handler: () => window.open('https://www.pescms.com/d/v/32/84.html', '_blank')
  },
  {
    label: '捐赠支持',
    icon: HeartIcon,
    theme: 'primary',
    variant: 'base' as const,
    handler: () => {
      donationVisible.value = true;
    }
  },
  {
    label: '详细列表',
    icon: ViewListIcon,
    theme: 'default',
    variant: 'outline' as const,
    handler: () => openExtensionPage('fund-list.html')
  },
  {
    label: '云备份',
    icon: CloudUploadIcon,
    theme: 'default',
    variant: 'outline' as const,
    handler: () => MessagePlugin.info('云备份功能待集成')
  }
];

const pickRandom = <T,>(items: T[]): T | undefined => {
  if (!items.length) return undefined;
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatValue = (value: number | null, currency?: string | null): string => {
  if (value === null || value === undefined) return '--';
  const formatted = Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

const formatSigned = (value: number | null): string => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  const formatted = Math.abs(num).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (num > 0) return `+${formatted}`;
  if (num < 0) return `-${formatted}`;
  return '0.00';
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  const formatted = Math.abs(num).toFixed(2);
  if (num > 0) return `+${formatted}%`;
  if (num < 0) return `-${formatted}%`;
  return '0.00%';
};

const formatUpdatedAt = (value?: string | null): string => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const trendClass = (value: number | null) => {
  const num = toNumber(value);
  if (num === null || num === 0) return 'index-neutral';
  return num > 0 ? 'index-up' : 'index-down';
};

const openExtensionPage = (path: string) => {
  const url = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL(path) : path;
  window.open(url, '_blank');
};

const calculateInvestmentDays = (raw: string | null): number => {
  if (!raw) return 1;
  const installed = new Date(raw);
  if (Number.isNaN(installed.getTime())) return 1;
  const installStart = new Date(installed.getFullYear(), installed.getMonth(), installed.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayStart.getTime() - installStart.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return Math.max(1, days + 1);
};

const initializeInvestmentDays = async () => {
  try {
    const existing = await storageApi.get<string>(INSTALL_STORAGE_KEY);
    if (existing) {
      investmentDays.value = calculateInvestmentDays(existing);
      return;
    }
    const now = new Date().toISOString();
    await storageApi.set(INSTALL_STORAGE_KEY, now);
    investmentDays.value = 1;
  } catch (error) {
    investmentDays.value = 1;
  }
};

const applyMarketIndexes = (items: MarketIndexResponse[]) => {
  const map = new Map(items.map((item) => [item.id, item]));
  indices.value = indexTargets.map((target) => {
    const payload = map.get(target.id);
    if (!payload) {
      return { ...target };
    }
    const payloadRecord = payload as Record<string, unknown>;
    const changeValue = payloadRecord.change ?? payloadRecord.change_value ?? null;
    const percentValue = payloadRecord.changePercent ?? payloadRecord.change_percent ?? null;
    return {
      ...target,
      last: toNumber(payloadRecord.last ?? null),
      change: toNumber(changeValue),
      changePercent: toNumber(percentValue),
      currency: (payloadRecord.currency as string | null | undefined) ?? target.currency,
      updatedAt: (payloadRecord.updatedAt as string | null | undefined) ?? (payloadRecord.updated_at as string | null | undefined) ?? null
    };
  });
};

const loadIndexes = async () => {
  console.log('[PopupApp] loadIndexes started');
  indexLoading.value = true;
  indexError.value = '';
  try {
    const response = await fetchMarketIndexes();
    console.log('[PopupApp] fetchMarketIndexes returned:', response);
    applyMarketIndexes(response);
    console.log('[PopupApp] Applied indexes successfully');
  } catch (error: unknown) {
    console.error('[PopupApp] loadIndexes error:', error);
    const message = error instanceof Error ? error.message : '指数数据获取失败，请稍后重试。';
    indexError.value = message;
    MessagePlugin.error(message);
    applyMarketIndexes([]);
  } finally {
    indexLoading.value = false;
    console.log('[PopupApp] loadIndexes completed');
  }
};

onMounted(() => {
  const background = pickRandom(backgrounds);
  if (background) {
    currentBackground.value = background;
  }
  const quote = pickRandom(quotes);
  if (quote) {
    currentQuote.value = quote;
  }
  initializeInvestmentDays();
  loadIndexes();
});
</script>

<style>

@font-face {
  font-family: 'Qiushui Shotai';
  src: url('/assets/fonts/QiushuiShotai.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'YanZhenQing DuoBaoTaBei';
  src: url('/assets/fonts/YanZhenQingDuoBaoTaBei-2.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
</style>

<style scoped>

.popup-root {
  position: relative;
  width: 600px;
  min-height: 500px;
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #0f172a;
  font-family: 'Qiushui Shotai', sans-serif;
}

.popup-root::-webkit-scrollbar {
  display: none;
}

.popup-root {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.background-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(28px);
  transform: scale(1.05);
  opacity: 0.7;
}

.content-layer {
  position: relative;
  z-index: 1;
  width: 100%;
  margin: 0 auto;
  padding: 16px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.welcome-card,
.quote-card,
.index-board {
  backdrop-filter: blur(6px);
  background: rgba(245, 245, 245, 0.95);
}

.welcome-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.welcome-heading {
  font-size: 24px;
  font-weight: 800;
  color: #333333;
}

.welcome-subtitle {
  font-size: 11px;
  color: #666666;
}

.days-number {
  font-weight: 700;
  color: #E74856;
}

.welcome-body {
  margin-top: 8px;
}

.welcome-description {
  font-size: 14px;
  color: #475569;
  margin: 0;
}

.quote-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 4px;
}

.quote-text {
  font-family: 'YanZhenQing DuoBaoTaBei', sans-serif;
  font-size: 40px;
  line-height: 1.5;
  color: #db3365;
  margin: 0;
  font-style: italic;
  font-weight: 800;
}

.quote-author {
  font-family: sans-serif;
  font-size: 13px;
  color: #A0A0A0;
  margin: 0;
  text-align: left;
  font-weight: 600;
}

.index-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.index-heading {
  font-size: 15px;
  font-weight: 600;
  color: #333333;
}

.index-subtitle {
  font-size: 12px;
  color: #888888;
}

.index-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.index-alert {
  margin-top: 4px;
}

.index-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.index-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 6px;
  background: #E0E8ED;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.index-cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.15);
  background: #D6DFE9;
}

.index-cell-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.index-name {
  font-size: 13px;
  font-weight: 600;
  color: #333333;
}

.index-symbol {
  font-size: 11px;
  color: #888888;
  text-transform: uppercase;
}

.index-value {
  font-size: 18px;
  font-weight: 700;
  color: #333333;
}

.index-cell:nth-child(3) .index-value,
.index-cell:nth-child(4) .index-value {
  font-size: 18px;
  font-weight: 700;
}

.index-deltas {
  display: flex;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.index-up {
  color: #22B856;
}

.index-down {
  color: #E74856;
}

.index-neutral {
  color: #666666;
}

.dialog-text {
  font-size: 14px;
  color: #475569;
  margin: 0 0 12px 0;
}

.dialog-tip {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

:deep(.t-button) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

:deep(.t-button.t-is-base) {
  background-color: #3498DB;
  color: white;
}

:deep(.t-button.t-is-base:hover) {
  background-color: #2980B9;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

:deep(.t-button.t-is-outline:hover) {
  border-color: #3498DB;
  color: #3498DB;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.15);
  text-decoration: underline;
}

@media (max-width: 640px) {
  .content-layer {
    padding: 12px 16px 40px;
  }

  .welcome-heading {
    font-size: 11px;
  }

  .quote-text {
    font-size: 14px;
  }

  .index-value {
    font-size: 16px;
  }

  .index-grid {
    grid-template-columns: 1fr;
  }
}
</style>
