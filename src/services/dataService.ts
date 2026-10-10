import {
  Person,
  Visit,
  Territory,
  PhotoAsset,
  BackupData,
  PersonInput,
  VisitInput,
  TerritoryInput,
  SyncOperation,
  SyncEntityType,
  SyncOperationType,
} from '../types';
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
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
    throw new Error('Invalid photo asset: missing base64 data separator.');
  }
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  if (!mime.startsWith('image/')) {
    throw new Error(`Invalid photo asset: unsupported MIME type "${mime}".`);
  }
  try {
    const binary = atob(base64.trim());
    const len = binary.length;
    if (len === 0) {
      throw new Error('Photo payload contains zero bytes.');
    }
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to decode photo image payload: ${msg}`);
  }
}

/**
 * Validates the entire backup structure and required record fields before modifying existing data.
 * Throws a descriptive Error if any structure or field is invalid.
 */
export function validateBackupData(data: unknown): BackupData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid backup file: root must be a JSON object.');
  }

  const raw = data as Record<string, unknown>;

  if (raw.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(raw.version)}. Expected version 1.`);
  }

  if (typeof raw.exportedAt !== 'string' || !raw.exportedAt.trim()) {
    throw new Error('Invalid backup format: missing or invalid "exportedAt" timestamp.');
  }

  if (!Array.isArray(raw.people)) {
    throw new Error('Invalid backup format: "people" must be an array.');
  }

  if (!Array.isArray(raw.visits)) {
    throw new Error('Invalid backup format: "visits" must be an array.');
  }

  if (raw.territories !== undefined && !Array.isArray(raw.territories)) {
    throw new Error('Invalid backup format: "territories" must be an array.');
  }

  if (raw.photos !== undefined && !Array.isArray(raw.photos)) {
    throw new Error('Invalid backup format: "photos" must be an array.');
  }

  const now = new Date().toISOString();
  const exportedAt = String(raw.exportedAt);

  // Validate and normalize people
  const validatedPeople: Person[] = [];
  for (let i = 0; i < raw.people.length; i++) {
    const p = raw.people[i] as Record<string, unknown>;
    if (!p || typeof p !== 'object') {
      throw new Error(`Invalid contact record at index ${i}: not an object.`);
    }
    if (typeof p.id !== 'string' || !p.id.trim()) {
      throw new Error(`Contact at index ${i} is missing a valid "id".`);
    }
    if (typeof p.name !== 'string' || !p.name.trim()) {
      throw new Error(`Contact "${String(p.id)}" is missing a valid "name".`);
    }
    if (p.latitude !== null && p.latitude !== undefined && (typeof p.latitude !== 'number' || isNaN(p.latitude))) {
      throw new Error(`Contact "${String(p.id)}" has invalid "latitude".`);
    }
    if (p.longitude !== null && p.longitude !== undefined && (typeof p.longitude !== 'number' || isNaN(p.longitude))) {
      throw new Error(`Contact "${String(p.id)}" has invalid "longitude".`);
    }
    validatedPeople.push({
      id: String(p.id).trim(),
      name: String(p.name).trim(),
      photoRef: typeof p.photoRef === 'string' && p.photoRef.trim() ? p.photoRef.trim() : null,
      latitude: typeof p.latitude === 'number' && !isNaN(p.latitude) ? p.latitude : null,
      longitude: typeof p.longitude === 'number' && !isNaN(p.longitude) ? p.longitude : null,
      territoryId: typeof p.territoryId === 'string' && p.territoryId.trim() ? p.territoryId.trim() : null,
      messengerUrl: typeof p.messengerUrl === 'string' && p.messengerUrl.trim() ? p.messengerUrl.trim() : null,
      createdAt: typeof p.createdAt === 'string' && p.createdAt.trim() ? p.createdAt : exportedAt,
      updatedAt: typeof p.updatedAt === 'string' && p.updatedAt.trim() ? p.updatedAt : now,
    });
  }

  // Validate and normalize visits
  const validatedVisits: Visit[] = [];
  for (let i = 0; i < raw.visits.length; i++) {
    const v = raw.visits[i] as Record<string, unknown>;
    if (!v || typeof v !== 'object') {
      throw new Error(`Invalid visit record at index ${i}: not an object.`);
    }
    if (typeof v.id !== 'string' || !v.id.trim()) {
      throw new Error(`Visit at index ${i} is missing a valid "id".`);
    }
    if (typeof v.personId !== 'string' || !v.personId.trim()) {
      throw new Error(`Visit "${String(v.id)}" is missing a valid "personId".`);
    }
    if (typeof v.visitedAt !== 'string' || !v.visitedAt.trim()) {
      throw new Error(`Visit "${String(v.id)}" is missing a valid "visitedAt" timestamp.`);
    }
    validatedVisits.push({
      id: String(v.id).trim(),
      personId: String(v.personId).trim(),
      visitedAt: String(v.visitedAt).trim(),
      remarks: typeof v.remarks === 'string' ? v.remarks : '',
      createdAt: typeof v.createdAt === 'string' && v.createdAt.trim() ? v.createdAt : exportedAt,
      updatedAt: typeof v.updatedAt === 'string' && v.updatedAt.trim() ? v.updatedAt : now,
    });
  }

  // Validate and normalize territories
  const rawTerritories = (raw.territories || []) as unknown[];
  const validatedTerritories: Territory[] = [];
  for (let i = 0; i < rawTerritories.length; i++) {
    const t = rawTerritories[i] as Record<string, unknown>;
    if (!t || typeof t !== 'object') {
      throw new Error(`Invalid territory record at index ${i}: not an object.`);
    }
    if (typeof t.id !== 'string' || !t.id.trim()) {
      throw new Error(`Territory at index ${i} is missing a valid "id".`);
    }
    if (typeof t.name !== 'string' || !t.name.trim()) {
      throw new Error(`Territory "${String(t.id)}" is missing a valid "name".`);
    }
    validatedTerritories.push({
      id: String(t.id).trim(),
      name: String(t.name).trim(),
      createdAt: typeof t.createdAt === 'string' && t.createdAt.trim() ? t.createdAt : exportedAt,
      updatedAt: typeof t.updatedAt === 'string' && t.updatedAt.trim() ? t.updatedAt : now,
    });
  }

  // Validate and normalize photos
  const rawPhotos = (raw.photos || []) as unknown[];
  const validatedPhotos: PhotoAsset[] = [];
  for (let i = 0; i < rawPhotos.length; i++) {
    const ph = rawPhotos[i] as Record<string, unknown>;
    if (!ph || typeof ph !== 'object') {
      throw new Error(`Invalid photo asset at index ${i}: not an object.`);
    }
    if (typeof ph.id !== 'string' || !ph.id.trim()) {
      throw new Error(`Photo at index ${i} is missing a valid "id".`);
    }
    if (typeof ph.mimeType !== 'string' || !ph.mimeType.startsWith('image/')) {
      throw new Error(`Photo "${String(ph.id)}" has an invalid or missing image "mimeType".`);
    }
    if (!ph.blob && (!ph.dataUrl || typeof ph.dataUrl !== 'string')) {
      throw new Error(`Photo "${String(ph.id)}" does not contain valid image binary or dataUrl.`);
    }
    validatedPhotos.push({
      id: String(ph.id).trim(),
      blob: ph.blob instanceof Blob ? ph.blob : undefined,
      dataUrl: typeof ph.dataUrl === 'string' ? ph.dataUrl : undefined,
      mimeType: String(ph.mimeType).trim(),
      createdAt: typeof ph.createdAt === 'string' && ph.createdAt.trim() ? ph.createdAt : exportedAt,
    });
  }

  return {
    version: 1,
    exportedAt,
    people: validatedPeople,
    visits: validatedVisits,
    territories: validatedTerritories,
    photos: validatedPhotos,
  };
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
      createdAt: data.createdAt || (existing ? existing.createdAt : now),
      updatedAt: data.updatedAt || now,
      workspaceId: data.workspaceId || existing?.workspaceId || undefined,
      createdBy: data.createdBy || existing?.createdBy || undefined,
      lastUpdatedBy: data.lastUpdatedBy || existing?.lastUpdatedBy || undefined,
      isLocalOnly: data.isLocalOnly !== undefined ? data.isLocalOnly : (existing?.isLocalOnly ?? (data.workspaceId ? false : true)),
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
      createdAt: data.createdAt || (existing ? existing.createdAt : now),
      updatedAt: data.updatedAt || now,
      workspaceId: data.workspaceId || existing?.workspaceId || undefined,
      createdBy: data.createdBy || existing?.createdBy || undefined,
      lastUpdatedBy: data.lastUpdatedBy || existing?.lastUpdatedBy || undefined,
      isLocalOnly: data.isLocalOnly !== undefined ? data.isLocalOnly : (existing?.isLocalOnly ?? (data.workspaceId ? false : true)),
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
      createdAt: data.createdAt || (existing ? existing.createdAt : now),
      updatedAt: data.updatedAt || now,
      workspaceId: data.workspaceId || existing?.workspaceId || undefined,
      createdBy: data.createdBy || existing?.createdBy || undefined,
      lastUpdatedBy: data.lastUpdatedBy || existing?.lastUpdatedBy || undefined,
      isLocalOnly: data.isLocalOnly !== undefined ? data.isLocalOnly : (existing?.isLocalOnly ?? (data.workspaceId ? false : true)),
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
  // Keeps track of the last in-memory pre-restore safety snapshot
  _lastPreRestoreSnapshot: null as BackupData | null,

  getLastSafetySnapshot(): BackupData | null {
    return this._lastPreRestoreSnapshot;
  },

  async exportData(): Promise<BackupData> {
    const [people, visits, territories, rawPhotos] = await Promise.all([
      getAllFromStore<Person>(STORES.PEOPLE),
      getAllFromStore<Visit>(STORES.VISITS),
      getAllFromStore<Territory>(STORES.TERRITORIES),
      getAllFromStore<PhotoAsset>(STORES.PHOTOS),
    ]);

    // Serialize Blobs to base64 dataUrl string solely for JSON portability with fault-tolerant asset reporting
    const failedPhotoIds: string[] = [];
    const photos: PhotoAsset[] = [];
    for (const p of rawPhotos) {
      if (p.blob) {
        try {
          const dataUrl = await blobToDataUrl(p.blob);
          photos.push({
            id: p.id,
            dataUrl,
            mimeType: p.mimeType,
            createdAt: p.createdAt,
          });
        } catch (err) {
          failedPhotoIds.push(p.id);
          console.warn(`[Fault-Tolerant Export] Failed to serialize photo asset "${p.id}" to dataUrl:`, err);
          photos.push({
            id: p.id,
            mimeType: p.mimeType,
            createdAt: p.createdAt,
          });
        }
      } else {
        photos.push(p);
      }
    }
    if (failedPhotoIds.length > 0) {
      console.warn(`[Fault-Tolerant Export] Completed with warnings: ${failedPhotoIds.length} photo asset(s) failed serialization and were exported as metadata-only placeholders:`, failedPhotoIds);
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      people,
      visits,
      territories,
      photos,
    };
  },

  async importData(data: unknown, mode: 'merge' | 'replace' = 'replace'): Promise<{ importedCount: number }> {
    // 1. Strictly validate and normalize the entire backup structure before touching storage
    const validData = validateBackupData(data);

    // 2. Pre-process and convert photos prior to opening the database transaction
    // If any base64 payload fails to decode, it fails safely before touching IndexedDB
    const preparedPhotos: { id: string; blob: Blob; mimeType: string; createdAt: string }[] = [];
    for (const photo of validData.photos || []) {
      const blob = photo.blob || (photo.dataUrl ? dataUrlToBlob(photo.dataUrl) : undefined);
      if (blob) {
        preparedPhotos.push({
          id: photo.id,
          blob,
          mimeType: photo.mimeType,
          createdAt: photo.createdAt,
        });
      }
    }

    // 3. Take an automatic in-memory safety snapshot before replacing existing data
    if (mode === 'replace') {
      try {
        this._lastPreRestoreSnapshot = await this.exportData();
      } catch (snapErr) {
        console.warn('Could not take pre-restore safety snapshot:', snapErr);
      }
    }

    // 4. Perform clear (if replace mode) AND puts within a single atomic IndexedDB transaction
    // If any error occurs or the transaction is aborted, the entire operation rolls back atomically.
    const db = await getDatabase();
    const tx = db.transaction([STORES.PEOPLE, STORES.VISITS, STORES.TERRITORIES, STORES.PHOTOS], 'readwrite');

    const peopleStore = tx.objectStore(STORES.PEOPLE);
    const visitsStore = tx.objectStore(STORES.VISITS);
    const territoriesStore = tx.objectStore(STORES.TERRITORIES);
    const photosStore = tx.objectStore(STORES.PHOTOS);

    if (mode === 'replace') {
      peopleStore.clear();
      visitsStore.clear();
      territoriesStore.clear();
      photosStore.clear();
    }

    for (const terr of validData.territories || []) {
      territoriesStore.put(terr);
    }
    for (const photo of preparedPhotos) {
      photosStore.put(photo);
    }
    for (const person of validData.people || []) {
      peopleStore.put(person);
    }
    for (const visit of validData.visits || []) {
      visitsStore.put(visit);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ importedCount: (validData.people || []).length });
      tx.onerror = () => reject(tx.error || new Error('Transaction failed during data import.'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted during data import. Existing data preserved.'));
    });
  },

  async clearAllData(): Promise<void> {
    await clearAllStores();
  },
};

// Sync Queue Service - durable outbox queue management for reliable offline sync
export const syncQueueService = {
  async getAll(): Promise<SyncOperation[]> {
    return getAllFromStore<SyncOperation>(STORES.SYNC_QUEUE);
  },

  async getPending(): Promise<SyncOperation[]> {
    const pending = await getByIndex<SyncOperation>(STORES.SYNC_QUEUE, 'status', 'pending');
    // Sort oldest first (FIFO order)
    return pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async getById(id: string): Promise<SyncOperation | null> {
    return getFromStore<SyncOperation>(STORES.SYNC_QUEUE, id);
  },

  async getByEntity(entityType: SyncEntityType, entityId: string): Promise<SyncOperation[]> {
    return getByIndex<SyncOperation>(STORES.SYNC_QUEUE, 'entityType_entityId', [entityType, entityId]);
  },

  async countPending(): Promise<number> {
    const pending = await this.getPending();
    return pending.length;
  },

  /**
   * Enqueues an operation into the durable IndexedDB outbox.
   * Handles deduplication safely: if an operation is already pending for this entity,
   * updates it rather than duplicating writes.
   */
  async enqueue(op: {
    entityType: SyncEntityType;
    entityId: string;
    operationType: SyncOperationType;
    payload?: Record<string, unknown> | null;
    workspaceId?: string;
  }): Promise<SyncOperation> {
    const existingOps = await this.getByEntity(op.entityType, op.entityId);
    const pendingOp = existingOps.find((o) => o.status === 'pending' || o.status === 'processing');

    const now = new Date().toISOString();

    if (pendingOp) {
      // Coalesce / deduplicate into existing pending operation
      const updatedOp: SyncOperation = {
        ...pendingOp,
        operationType: op.operationType,
        payload: op.payload !== undefined ? op.payload : pendingOp.payload,
        status: 'pending',
        clientTimestamp: now,
        workspaceId: op.workspaceId || pendingOp.workspaceId || 'default',
        errorMessage: null,
      };
      await putInStore(STORES.SYNC_QUEUE, updatedOp);
      return updatedOp;
    }

    const newOp: SyncOperation = {
      id: generateId(),
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      payload: op.payload || null,
      createdAt: now,
      status: 'pending',
      retryCount: 0,
      lastAttemptAt: null,
      errorMessage: null,
      clientTimestamp: now,
      workspaceId: op.workspaceId || 'default',
    };

    await putInStore(STORES.SYNC_QUEUE, newOp);
    return newOp;
  },

  async markProcessing(id: string): Promise<void> {
    const op = await this.getById(id);
    if (op) {
      op.status = 'processing';
      op.lastAttemptAt = new Date().toISOString();
      await putInStore(STORES.SYNC_QUEUE, op);
    }
  },

  async markCompleted(id: string): Promise<void> {
    // Remove completed operations from queue to keep outbox clean and performant
    await deleteFromStore(STORES.SYNC_QUEUE, id);
  },

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const op = await this.getById(id);
    if (op) {
      op.retryCount += 1;
      op.errorMessage = errorMessage;
      op.lastAttemptAt = new Date().toISOString();
      // Keep in 'pending' status so subsequent sync attempts pick it up with exponential backoff
      op.status = op.retryCount > 10 ? 'failed' : 'pending';
      await putInStore(STORES.SYNC_QUEUE, op);
    }
  },

  async remove(id: string): Promise<void> {
    await deleteFromStore(STORES.SYNC_QUEUE, id);
  },

  async clearCompleted(): Promise<void> {
    const all = await this.getAll();
    for (const op of all) {
      if (op.status === 'completed') {
        await deleteFromStore(STORES.SYNC_QUEUE, op.id);
      }
    }
  },
};
