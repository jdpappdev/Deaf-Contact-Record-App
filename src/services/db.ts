/**
 * IndexedDB Database Layer for Deaf Contact Record App
 * Handles local structured data persistence with zero cloud synchronization.
 */

const DB_NAME = 'DeafContactRecordDB';
const DB_VERSION = 2;

export const STORES = {
  PEOPLE: 'people',
  VISITS: 'visits',
  TERRITORIES: 'territories',
  PHOTOS: 'photos',
  SYNC_QUEUE: 'sync_queue',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function closeDatabase(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Version 1 Migration: Initial base schema
      if (oldVersion < 1) {
        // People store
        if (!db.objectStoreNames.contains(STORES.PEOPLE)) {
          const peopleStore = db.createObjectStore(STORES.PEOPLE, { keyPath: 'id' });
          peopleStore.createIndex('territoryId', 'territoryId', { unique: false });
          peopleStore.createIndex('name', 'name', { unique: false });
        }

        // Visits store
        if (!db.objectStoreNames.contains(STORES.VISITS)) {
          const visitsStore = db.createObjectStore(STORES.VISITS, { keyPath: 'id' });
          visitsStore.createIndex('personId', 'personId', { unique: false });
          visitsStore.createIndex('visitedAt', 'visitedAt', { unique: false });
        }

        // Territories store
        if (!db.objectStoreNames.contains(STORES.TERRITORIES)) {
          const territoriesStore = db.createObjectStore(STORES.TERRITORIES, { keyPath: 'id' });
          territoriesStore.createIndex('name', 'name', { unique: false });
        }

        // Photos store (separated asset storage to keep main records lightweight)
        if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
          db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
        }
      }

      // Version 2 Migration: Sync preparation (sync_queue store)
      // Preserves all existing records in people, visits, territories, and photos without changes.
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          syncQueueStore.createIndex('createdAt', 'createdAt', { unique: false });
          syncQueueStore.createIndex('status', 'status', { unique: false });
          syncQueueStore.createIndex('entityType', 'entityType', { unique: false });
          syncQueueStore.createIndex('entityId', 'entityId', { unique: false });
          syncQueueStore.createIndex('entityType_entityId', ['entityType', 'entityId'], { unique: false });
          syncQueueStore.createIndex('status_createdAt', ['status', 'createdAt'], { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Close database connection if another tab/version requests an upgrade, preventing locks
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };

    request.onblocked = (event) => {
      console.warn('Database upgrade was blocked. Please close other open tabs/windows of this app.', event);
    };
  });

  return dbPromise;
}

export async function getFromStore<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllStores(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction([STORES.PEOPLE, STORES.VISITS, STORES.TERRITORIES, STORES.PHOTOS], 'readwrite');
  tx.objectStore(STORES.PEOPLE).clear();
  tx.objectStore(STORES.VISITS).clear();
  tx.objectStore(STORES.TERRITORIES).clear();
  tx.objectStore(STORES.PHOTOS).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
