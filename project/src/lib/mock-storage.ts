const DB_NAME = 'viva_mock';
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function getItem(key: string): Promise<string | null> {
  return openDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    })
  );
}

function setItem(key: string, value: string): Promise<void> {
  return openDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      const store = tx.objectStore('data');
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })
  );
}

function removeItem(key: string): Promise<void> {
  return openDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      const store = tx.objectStore('data');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })
  );
}

function getAllKeys(table: string): Promise<string[]> {
  return openDB().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]).filter(k => k.startsWith(`mock_supabase_${table}`));
        resolve(keys);
      };
      req.onerror = () => reject(req.error);
    })
  );
}

async function migrateFromLocalStorage() {
  const tables = ['profiles', 'banks', 'owners', 'clients', 'properties', 'exchanges', 'conversations', 'chat_messages', 'ai_actions'];
  for (const table of tables) {
    const key = `mock_supabase_${table}`;
    const val = localStorage.getItem(key);
    if (val) {
      const existing = await getItem(key);
      if (!existing) {
        await setItem(key, val);
      }
      localStorage.removeItem(key);
    }
  }
  // migrate session
  const session = localStorage.getItem('mock_supabase_session');
  if (session) {
    const existing = await getItem('mock_supabase_session');
    if (!existing) {
      await setItem('mock_supabase_session', session);
    }
    localStorage.removeItem('mock_supabase_session');
  }
  const userId = localStorage.getItem('mock_user_id');
  if (userId) {
    const existing = await getItem('mock_user_id');
    if (!existing) {
      await setItem('mock_user_id', userId);
    }
    localStorage.removeItem('mock_user_id');
  }
}

export const mockStorage = {
  async getItem(key: string): Promise<string | null> {
    try { return await getItem(key); } catch { return localStorage.getItem(key); }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { await setItem(key, value); } catch { localStorage.setItem(key, value); }
  },
  async removeItem(key: string): Promise<void> {
    try { await removeItem(key); } catch { localStorage.removeItem(key); }
  },
  async getAllKeys(table: string): Promise<string[]> {
    try { return await getAllKeys(table); } catch { return []; }
  },
  migrateFromLocalStorage,
};
