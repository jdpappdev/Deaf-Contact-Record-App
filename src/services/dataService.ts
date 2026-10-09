import { Person, Visit, Territory, PhotoAsset, BackupData, PersonInput, VisitInput, TerritoryInput } from '../types';
import {
  getDatabase,
  getFromStore,
  getAllFromStore,
  putInStore,
  deleteFromStore,
  getByIndex,
  clearAllStores,
  STORES,
} from './db';

// Helper to generate IDs
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// Helper to convert any valid stored contact URL into a fully-qualified navigable external URL
export function getExternalUrl(urlStr: string | null | undefined): string {
  if (!urlStr || !urlStr.trim()) return '';
  let trimmed = urlStr.trim();

  // Strip duplicate or malformed prefixes like "https://https:", "https:m.me", "http:/m.me", etc.
  while (/^(https?:\/?\/?)+/i.test(trimmed)) {
    trimmed = trimmed.replace(/^(https?:\/?\/?)+/i, '');
  }
  // Strip any leftover leading colons or slashes
  trimmed = trimmed.replace(/^[:/]+/, '');

  if (!trimmed) return '';

  try {
    const parsed = new URL(`https://${trimmed}`);
    return parsed.href;
  } catch {
    return '';
  }
}

// URL validation helper for Messenger/Contact URL
export function isValidUrl(urlStr: string): boolean {
  if (!urlStr || !urlStr.trim()) return false;
  const trimmed = urlStr.trim();

  // Whitespace is not allowed in URLs
  if (/\s/.test(trimmed)) return false;

  const external = getExternalUrl(trimmed);
  if (!external) return false;

  try {
    const parsed = new URL(external);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0 &&
      parsed.hostname.includes('.') &&
      !parsed.hostname.startsWith('.') &&
      !parsed.hostname.endsWith('.')
    );
  } catch {
    return false;
  }
}

// Helper to convert Blob to base64 dataUrl purely for JSON backup export serialization
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to convert base64 dataUrl back into native Blob during JSON backup import
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// Photo Asset Service - stores original intact Blob in IndexedDB without canvas transformation
export const photoService = {
  async savePhoto(blobOrFile: Blob | File, mimeType?: string): Promise<string> {
    const id = generateId();
    const type = mimeType || blobOrFile.type || 'image/jpeg';
    const blob = blobOrFile instanceof Blob ? blobOrFile : new Blob([blobOrFile], { type });
    const asset: PhotoAsset = {
      id,
      blob,
      mimeType: type,
      createdAt: new Date().toISOString(),
    };
    await putInStore(STORES.PHOTOS, asset);
    return id;
  },

  async getPhoto(id: string): Promise<PhotoAsset | null> {
    return getFromStore<PhotoAsset>(STORES.PHOTOS, id);
  },

  async deletePhoto(id: string): Promise<void> {
    await deleteFromStore(STORES.PHOTOS, id);
  },
};

// Person Service
export const personService = {
  async getAll(): Promise<Person[]> {
    const people = await getAllFromStore<Person>(STORES.PEOPLE);
    // Sort alphabetically by name
    return people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  },

  async getById(id: string): Promise<Person | null> {
    return getFromStore<Person>(STORES.PEOPLE, id);
  },

  async save(data: PersonInput): Promise<Person> {
    const now = new Date().toISOString();
    const existing = data.id ? await getFromStore<Person>(STORES.PEOPLE, data.id) : null;

    if (!data.name || !data.name.trim()) {
      throw new Error('Contact name is required.');
    }

    if (data.messengerUrl && !isValidUrl(data.messengerUrl)) {
      throw new Error('Please enter a valid Messenger URL.');
    }

    const person: Person = {
      id: data.id || generateId(),
      name: data.name.trim(),
      photoRef: data.photoRef || null,
      latitude: typeof data.latitude === 'number' && !isNaN(data.latitude) ? data.latitude : null,
      longitude: typeof data.longitude === 'number' && !isNaN(data.longitude) ? data.longitude : null,
      territoryId: data.territoryId || null,
      messengerUrl: data.messengerUrl ? data.messengerUrl.trim() : null,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await putInStore(STORES.PEOPLE, person);
    return person;
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    const person = await getFromStore<Person>(STORES.PEOPLE, id);
    if (!person) return;

    // Use a multi-store transaction to guarantee atomic deletion of person, visits, and photo
    const tx = db.transaction([STORES.PEOPLE, STORES.VISITS, STORES.PHOTOS], 'readwrite');
    const peopleStore = tx.objectStore(STORES.PEOPLE);
    const visitsStore = tx.objectStore(STORES.VISITS);
    const photosStore = tx.objectStore(STORES.PHOTOS);

    // Delete person
    peopleStore.delete(id);

    // Delete associated photo if any
    if (person.photoRef) {
      photosStore.delete(person.photoRef);
    }

    // Delete all visits associated with this person
    const visitIndex = visitsStore.index('personId');
    const visitRequest = visitIndex.openCursor(IDBKeyRange.only(id));

    visitRequest.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Visit Service
export const visitService = {
  async getByPersonId(personId: string): Promise<Visit[]> {
    const visits = await getByIndex<Visit>(STORES.VISITS, 'personId', personId);
    // Sort descending by visitedAt (chronological newest first)
    return visits.sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
  },

  async getAll(): Promise<Visit[]> {
    return getAllFromStore<Visit>(STORES.VISITS);
  },

  async getLatestForPerson(personId: string): Promise<Visit | null> {
    const visits = await this.getByPersonId(personId);
    return visits.length > 0 ? visits[0] : null;
  },

  async save(data: VisitInput): Promise<Visit> {
    const now = new Date().toISOString();
    const existing = data.id ? await getFromStore<Visit>(STORES.VISITS, data.id) : null;

    if (!data.personId) {
      throw new Error('A visit must be associated with a valid contact.');
    }
    if (!data.visitedAt) {
      throw new Error('Visit date is required.');
    }

    const visit: Visit = {
      id: data.id || generateId(),
      personId: data.personId,
      visitedAt: data.visitedAt,
      remarks: (data.remarks || '').trim(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await putInStore(STORES.VISITS, visit);
    return visit;
  },

  async delete(id: string): Promise<void> {
    await deleteFromStore(STORES.VISITS, id);
  },
};

// Territory Service
export const territoryService = {
  async getAll(): Promise<Territory[]> {
    const territories = await getAllFromStore<Territory>(STORES.TERRITORIES);
    return territories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  },

  async getById(id: string): Promise<Territory | null> {
    return getFromStore<Territory>(STORES.TERRITORIES, id);
  },

  async save(data: TerritoryInput): Promise<Territory> {
    const now = new Date().toISOString();
    const existing = data.id ? await getFromStore<Territory>(STORES.TERRITORIES, data.id) : null;

    if (!data.name || !data.name.trim()) {
      throw new Error('Territory name is required.');
    }

    const territory: Territory = {
      id: data.id || generateId(),
      name: data.name.trim(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await putInStore(STORES.TERRITORIES, territory);
    return territory;
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    // In a single transaction: remove territory and clear territoryId from contacts in this territory
    const tx = db.transaction([STORES.TERRITORIES, STORES.PEOPLE], 'readwrite');
    const terrStore = tx.objectStore(STORES.TERRITORIES);
    const peopleStore = tx.objectStore(STORES.PEOPLE);

    terrStore.delete(id);

    const terrIndex = peopleStore.index('territoryId');
    const request = terrIndex.openCursor(IDBKeyRange.only(id));

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const contact = cursor.value as Person;
        contact.territoryId = null;
        contact.updatedAt = new Date().toISOString();
        cursor.update(contact);
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Backup and Restore Service
export const backupService = {
  async exportData(): Promise<BackupData> {
    const [people, visits, territories, rawPhotos] = await Promise.all([
      getAllFromStore<Person>(STORES.PEOPLE),
      getAllFromStore<Visit>(STORES.VISITS),
      getAllFromStore<Territory>(STORES.TERRITORIES),
      getAllFromStore<PhotoAsset>(STORES.PHOTOS),
    ]);

    // Serialize Blobs to base64 dataUrl string solely for JSON portability
    const photos: PhotoAsset[] = await Promise.all(
      rawPhotos.map(async (p) => {
        if (p.blob) {
          const dataUrl = await blobToDataUrl(p.blob);
          return {
            id: p.id,
            dataUrl,
            mimeType: p.mimeType,
            createdAt: p.createdAt,
          };
        }
        return p;
      })
    );

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      people,
      visits,
      territories,
      photos,
    };
  },

  async importData(data: BackupData, mode: 'merge' | 'replace' = 'replace'): Promise<{ importedCount: number }> {
    if (!data || data.version !== 1 || !Array.isArray(data.people) || !Array.isArray(data.visits)) {
      throw new Error('Invalid backup file format or missing data structures.');
    }

    if (mode === 'replace') {
      await clearAllStores();
    }

    const db = await getDatabase();
    const tx = db.transaction([STORES.PEOPLE, STORES.VISITS, STORES.TERRITORIES, STORES.PHOTOS], 'readwrite');

    const peopleStore = tx.objectStore(STORES.PEOPLE);
    const visitsStore = tx.objectStore(STORES.VISITS);
    const territoriesStore = tx.objectStore(STORES.TERRITORIES);
    const photosStore = tx.objectStore(STORES.PHOTOS);

    for (const terr of data.territories || []) {
      territoriesStore.put(terr);
    }
    for (const photo of data.photos || []) {
      const blob = photo.blob || (photo.dataUrl ? dataUrlToBlob(photo.dataUrl) : undefined);
      if (blob) {
        photosStore.put({
          id: photo.id,
          blob,
          mimeType: photo.mimeType,
          createdAt: photo.createdAt,
        });
      }
    }
    for (const person of data.people || []) {
      peopleStore.put(person);
    }
    for (const visit of data.visits || []) {
      visitsStore.put(visit);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ importedCount: (data.people || []).length });
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAllData(): Promise<void> {
    await clearAllStores();
  },
};
