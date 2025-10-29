export interface StorageRecord {
  [key: string]: unknown;
}

const storage = () => chrome.storage?.local;

export const storageApi = {
  async getAll<T extends StorageRecord>(): Promise<T> {
    return new Promise((resolve, reject) => {
      const namespace = storage();
      if (!namespace) {
        reject(new Error('chrome.storage.local is unavailable'));
        return;
      }
      namespace.get(null, (result) => resolve(result as T));
    });
  },
  async get<T = unknown>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const namespace = storage();
      if (!namespace) {
        reject(new Error('chrome.storage.local is unavailable'));
        return;
      }
      namespace.get([key], (data) => resolve(data[key] as T | undefined));
    });
  },
  async set<T = unknown>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const namespace = storage();
      if (!namespace) {
        reject(new Error('chrome.storage.local is unavailable'));
        return;
      }
      namespace.set({ [key]: value }, () => resolve());
    });
  },
  async setBulk(entries: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const namespace = storage();
      if (!namespace) {
        reject(new Error('chrome.storage.local is unavailable'));
        return;
      }
      namespace.set(entries, () => resolve());
    });
  },
  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const namespace = storage();
      if (!namespace) {
        reject(new Error('chrome.storage.local is unavailable'));
        return;
      }
      namespace.remove(key, () => resolve());
    });
  }
};

export const parseStorageRecord = <T>(value: unknown): T | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse storage record', error);
      return null;
    }
  }
  return value as T;
};
