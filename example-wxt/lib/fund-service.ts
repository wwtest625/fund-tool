import dayjs from 'dayjs';
import { API_URL } from './constants';
import { parseStorageRecord, storageApi } from './storage';

export interface FundStorageEntry {
  code: string;
  buy: string;
  adding: string;
  sell: string;
  fene: string;
  now?: string;
  gztime?: string;
  name?: string;
  jingzhi?: string;
  jingzhi_time?: string;
  notice?: string | number;
}

export interface FundCollectionResult {
  entries: FundStorageEntry[];
  raw: Record<string, unknown>;
}

export const isNumeric = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  const num = typeof value === 'string' ? value.trim() : String(value);
  if (num.length === 0) return false;
  return !isNaN(Number(num));
};

export const collectFundRecords = async (): Promise<FundCollectionResult> => {
  const all = await storageApi.getAll<Record<string, unknown>>();
  const list: FundStorageEntry[] = [];
  for (const key of Object.keys(all)) {
    if (!isNumeric(key)) continue;
    const parsed = parseStorageRecord<FundStorageEntry>(all[key]);
    if (!parsed) continue;
    list.push({ ...parsed, code: key });
  }
  return { entries: list, raw: all };
};

const toPayload = (record: FundStorageEntry): Record<string, unknown> => {
  const clone: Record<string, unknown> = { ...record };
  delete clone.code;
  return clone;
};

export const saveFundRecord = async (record: FundStorageEntry): Promise<void> => {
  await storageApi.set(record.code, toPayload(record));
};

export const removeFundRecord = async (code: string): Promise<void> => {
  await storageApi.remove(code);
};

export const updateFundRecords = async (records: FundStorageEntry[]): Promise<void> => {
  const payload: Record<string, unknown> = {};
  records.forEach((record) => {
    payload[record.code] = toPayload(record);
  });
  await storageApi.setBulk(payload);
};

export const currentHour = (): number => Number(dayjs().format('H'));

export const refreshFund = async (user: boolean): Promise<boolean> => {
  const hour = currentHour();
  if ((hour < 8 || hour > 17) && user === false) {
    return false;
  }

  const data = await collectFundRecords();
  if (!data.entries.length) {
    return false;
  }

  const updates: FundStorageEntry[] = [];
  await Promise.all(
    data.entries.map(async (record) => {
      try {
        const response = await fetch(`http://fundgz.1234567.com.cn/js/${record.code}.js?rt=${Date.now()}`);
        if (!response.ok) return;
        const text = await response.text();
        const match = text.match(/[a-zA-Z_]+\((.*)\)/);
        if (!match || match.length < 2) return;
        const fund = JSON.parse(match[1]);
        updates.push({
          ...record,
          now: fund['gsz'],
          gztime: fund['gztime'],
          name: fund['name'] || record.name
        });
      } catch (error) {
        console.error(`获取 ${record.code} 基金信息失败`, error);
      }
    })
  );

  if (updates.length) {
    await updateFundRecords(updates);
  }

  return true;
};

export const refreshJingzhi = async (user: boolean): Promise<boolean> => {
  const hour = currentHour();
  if (hour > 9 && hour < 19 && user === false) {
    return false;
  }

  const data = await collectFundRecords();
  if (!data.entries.length) {
    return false;
  }

  const updates: FundStorageEntry[] = [];

  await Promise.all(
    data.entries.map(async (record) => {
      try {
        const response = await fetch(
          `http://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=${record.code}&page=1&per=1&sdate=&edate=&rt=${Date.now()}`
        );
        if (!response.ok) return;
        const html = await response.text();
        const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
        if (!tbodyMatch) return;
        const rowMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
        if (!rowMatch) return;
        const cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
        if (!cells.length) return;
        const clean = (value: string) => value.replace(/<[^>]+>/g, '').trim();
        const jingzhiTime = cells[0] ? clean(cells[0][1]) : '';
        let jingzhiValue = '';
        const boldMatch = rowMatch[1].match(/class="tor bold">([\s\S]*?)<\/td>/i);
        if (boldMatch) jingzhiValue = clean(boldMatch[1]);
        if (!jingzhiValue && cells[1]) {
          jingzhiValue = clean(cells[1][1]);
        }
        if (!jingzhiValue || !jingzhiTime) return;
        updates.push({
          ...record,
          jingzhi: jingzhiValue,
          jingzhi_time: jingzhiTime
        });
      } catch (error) {
        console.error(`获取 ${record.code} 基金单位净值失败`, error);
      }
    })
  );

  if (updates.length) {
    await updateFundRecords(updates);
  }

  return true;
};

export const cloudBackUp = async (user: boolean): Promise<boolean> => {
  const apikey = await storageApi.get<string>('apikey');
  if (!apikey) {
    return true;
  }

  const data = await collectFundRecords();
  if (!data.entries.length) {
    return true;
  }

  const backupPayload: Record<string, unknown> = {};
  data.entries.forEach((record) => {
    const copy: Record<string, unknown> = { ...record };
    delete copy.code;
    backupPayload[record.code] = copy;
  });

  const formData = new FormData();
  formData.append('apikey', apikey);
  formData.append('backup', JSON.stringify(backupPayload));

  try {
    const response = await fetch(`${API_URL}/Api/Backup/append/${Math.random()}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`云备份失败: ${response.statusText}`);
    }

    if (user) {
      const result = await response.json().catch(() => null);
      console.info('云备份完成', result);
    }
    return true;
  } catch (error) {
    console.error('云备份失败', error);
    return false;
  }
};

export const updateNoticeForFunds = async (codes: string[], notice: string): Promise<void> => {
  const updates: FundStorageEntry[] = [];
  await Promise.all(
    codes.map(async (code) => {
      const record = await storageApi.get(code);
      const parsed = parseStorageRecord<FundStorageEntry>(record);
      if (!parsed) return;
      updates.push({ ...parsed, code, notice });
    })
  );
  if (updates.length) {
    await updateFundRecords(updates);
  }
};

export interface MarketIndexResponse {
  id: string;
  name: string;
  symbol: string;
  last?: number | string | null;
  change?: number | string | null;
  change_percent?: number | string | null;
  changePercent?: number | string | null;
  currency?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
}

export const fetchMarketIndexes = async (): Promise<MarketIndexResponse[]> => {
  console.log('[fetchMarketIndexes] Starting request to:', `${API_URL}/market/indexes`);
  console.log('[fetchMarketIndexes] API_URL:', API_URL);
  
  try {
    const response = await fetch(`${API_URL}/market/indexes`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[fetchMarketIndexes] Response status:', response.status);
    console.log('[fetchMarketIndexes] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.error('[fetchMarketIndexes] Request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`获取指数数据失败 (${response.status}: ${response.statusText})`);
    }
    
    const payload = await response.json().catch((e) => {
      console.error('[fetchMarketIndexes] JSON parse error:', e);
      throw new Error('指数数据解析失败');
    });
    
    console.log('[fetchMarketIndexes] Received payload:', payload);
    
    if (!Array.isArray(payload)) {
      console.error('[fetchMarketIndexes] Invalid payload type:', typeof payload);
      throw new Error('指数数据格式异常');
    }
    
    console.log('[fetchMarketIndexes] Success! Received', payload.length, 'indexes');
    return payload as MarketIndexResponse[];
  } catch (error) {
    if (error instanceof Error) {
      console.error('[fetchMarketIndexes] Error:', error.message);
      console.error('[fetchMarketIndexes] Stack:', error.stack);
    } else {
      console.error('[fetchMarketIndexes] Unknown error:', error);
    }
    throw error;
  }
};
