// 新的弹出框实现 - 使用原生JavaScript + Tailwind CSS
import { fetchMarketIndexes } from '@/lib/fund-service';
import { storageApi } from '@/lib/storage';

// 投资天数存储键
const INSTALL_STORAGE_KEY = 'ft_install_timestamp_v2';

// 投资名言数组
const quotes = [
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

// 市场指数配置
const indexTargets = [
  { id: 'nasdaq', name: '纳斯达克指数', displaySymbol: 'NASDAQ', currency: '' },
  { id: 'sp500', name: '标普五百', displaySymbol: 'S&P 500', currency: '' },
  { id: 'lbma-gold', name: 'LBMA 金价', displaySymbol: 'LBMA', currency: 'USD/oz' }
];

// 工具函数
function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatValue(value: number | null, currency?: string): string {
  if (value === null || value === undefined) return '--';
  const formatted = Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatted;
}

function formatSigned(value: number | null): string {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  const formatted = Math.abs(num).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (num > 0) return `+${formatted}`;
  if (num < 0) return `-${formatted}`;
  return '0.00';
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  const formatted = Math.abs(num).toFixed(2);
  if (num > 0) return `+${formatted}%`;
  if (num < 0) return `-${formatted}%`;
  return '0.00%';
}

// 计算投资天数
function calculateInvestmentDays(installDate: string): number {
  if (!installDate) return 1;
  const installed = new Date(installDate);
  if (isNaN(installed.getTime())) return 1;

  const installStart = new Date(installed.getFullYear(), installed.getMonth(), installed.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayStart.getTime() - installStart.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return Math.max(1, days + 1);
}

// 初始化投资天数
async function initializeInvestmentDays(): Promise<void> {
  try {
    const existing = await storageApi.get<string>(INSTALL_STORAGE_KEY);
    if (existing) {
      const days = calculateInvestmentDays(existing);
      const element = document.getElementById('investment-days');
      if (element) {
        element.textContent = `这是你定投的第 ${days} 天`;
      }
      return;
    }

    const now = new Date().toISOString();
    await storageApi.set(INSTALL_STORAGE_KEY, now);
    const element = document.getElementById('investment-days');
    if (element) {
      element.textContent = '这是你定投的第 1 天';
    }
  } catch (error) {
    console.error('初始化投资天数失败:', error);
    const element = document.getElementById('investment-days');
    if (element) {
      element.textContent = '这是你定投的第 1 天';
    }
  }
}

// 显示随机名言
function showRandomQuote(): void {
  const quote = pickRandom(quotes);
  if (quote) {
    const textElement = document.getElementById('quote-text');
    const authorElement = document.getElementById('quote-author');
    if (textElement) textElement.textContent = `"${quote.text}"`;
    if (authorElement) authorElement.textContent = `— ${quote.author}`;
  }
}

// 更新指数显示
function updateIndexDisplay(id: string, data: any): void {
  const valueEl = document.getElementById(`${id}-value`);
  const changeEl = document.getElementById(`${id}-change`);

  if (!valueEl || !changeEl) return;

  if (!data) {
    valueEl.textContent = '--';
    changeEl.innerHTML = '<span class="icon-neutral"></span><p class="font-medium text-sm ml-1">--</p>';
    changeEl.className = 'flex items-center mt-1 text-gray-500';
    return;
  }

  const target = indexTargets.find(t => t.id === id);

  // 处理API响应中的数据格式，兼容不同字段名
  const lastValue = toNumber(data.last);
  const changeValue = toNumber(data.change ?? data.change_value);
  const percentValue = toNumber(data.changePercent ?? data.change_percent);

  // 显示价格
  if (target?.currency && target.currency.trim()) {
    const formatted = formatValue(lastValue);
    valueEl.innerHTML = `${formatted} <span class="text-xs text-gray-500 font-medium">${target.currency}</span>`;
  } else {
    valueEl.textContent = formatValue(lastValue);
  }

  // 显示涨跌幅
  const changeText = formatSigned(changeValue);
  const percentText = formatPercent(percentValue);

  let iconClass = 'icon-neutral';
  let colorClass = 'text-gray-500';

  if (changeValue && changeValue > 0) {
    iconClass = 'icon-up';
    colorClass = 'text-green-500';
  } else if (changeValue && changeValue < 0) {
    iconClass = 'icon-down';
    colorClass = 'text-red-500';
  }

  changeEl.innerHTML = `
    <span class="${iconClass}"></span>
    <p class="font-medium text-sm ml-1">${changeText} (${percentText})</p>
  `;
  changeEl.className = `flex items-center mt-1 ${colorClass}`;
}

// 获取市场指数数据
async function loadMarketIndexes(): Promise<void> {
  const loadingEl = document.getElementById('loading-state');
  const errorEl = document.getElementById('error-state');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');

  try {
    console.log('[PopupMain] 开始获取市场指数数据');
    const data = await fetchMarketIndexes();
    console.log('[PopupMain] 获取到数据:', data);

    // 更新各个指数显示
    data.forEach(item => {
      updateIndexDisplay(item.id, item);
    });

  } catch (error) {
    console.error('[PopupMain] 获取市场指数失败:', error);
    const message = error instanceof Error ? error.message : '指数数据获取失败，请稍后重试。';
    const errorMessageEl = document.getElementById('error-message');
    if (errorMessageEl) errorMessageEl.textContent = message;
    if (errorEl) errorEl.classList.remove('hidden');

    // 显示默认数据
    indexTargets.forEach(target => {
      updateIndexDisplay(target.id, null);
    });
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

// 打开扩展页面
function openExtensionPage(path: string): void {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    const url = chrome.runtime.getURL(path);
    chrome.tabs.create({ url });
  } else {
    window.open(path, '_blank');
  }
}

// 事件监听器
document.addEventListener('DOMContentLoaded', function() {
  console.log('[PopupMain] DOM加载完成，开始初始化');

  // 初始化
  initializeInvestmentDays();
  showRandomQuote();
  loadMarketIndexes();

  // 按钮事件
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      window.open('https://www.pescms.com/d/v/32/84.html', '_blank');
    });
  }

  const donateBtn = document.getElementById('donate-btn');
  const donationModal = document.getElementById('donation-modal');
  if (donateBtn && donationModal) {
    donateBtn.addEventListener('click', () => {
      donationModal.classList.remove('hidden');
    });
  }

  const detailsBtn = document.getElementById('details-btn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      openExtensionPage('fund-list.html');
    });
  }

  const cloudSyncBtn = document.getElementById('cloud-sync-btn');
  if (cloudSyncBtn) {
    cloudSyncBtn.addEventListener('click', () => {
      alert('云备份功能待集成');
    });
  }

  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn && donationModal) {
    closeModalBtn.addEventListener('click', () => {
      donationModal.classList.add('hidden');
    });
  }

  // 点击模态框背景关闭
  if (donationModal) {
    donationModal.addEventListener('click', (e) => {
      if (e.target && (e.target as HTMLElement).id === 'donation-modal') {
        donationModal.classList.add('hidden');
      }
    });
  }

  console.log('[PopupMain] 初始化完成');
});

if (import.meta.env.DEV) {
  console.info('[popup] 新弹出框初始化完成');
}
