import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from './firebase';
import {
  Person,
  Visit,
  Territory,
  SyncOperation,
} from '../types';
import {
  personService,
  visitService,
  territoryService,
  photoService,
  syncQueueService,
} from './dataService';

export interface PullResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  totalRemoteCount: number;
  peopleCount: number;
  visitsCount: number;
  territoriesCount: number;
  errorMessage?: string | null;
  isPartial?: boolean;
}

export interface PushResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errorMessage?: string | null;
}

let isSyncRunning = false;

function timestampToISO(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString();
}

/**
 * Pushes a single Person upsert to /people/{personId}.
 */
export async function pushPersonToFirestore(
  userId: string,
  person: Person
): Promise<void> {
  let safeTerritoryId: string | null = person.territoryId || null;
  if (safeTerritoryId) {
    const terrRef = doc(db, 'territories', safeTerritoryId);
    const terrSnap = await getDoc(terrRef);
    if (!terrSnap.exists()) {
      const localTerritory = await territoryService.getById(safeTerritoryId);
      if (localTerritory) {
        await pushTerritoryToFirestore(userId, localTerritory);
      } else {
        safeTerritoryId = null;
      }
    }
  }

  const safeName = (person.name && person.name.trim() ? person.name.trim() : 'Unnamed').slice(0, 100);
  const safePhotoRef = person.photoRef && person.photoRef.length <= 128 ? person.photoRef : null;
  let safePhotoDataUrl = person.photoDataUrl && person.photoDataUrl.length <= 400000 ? person.photoDataUrl : null;

  if (!safePhotoDataUrl && safePhotoRef) {
    try {
      const photoAsset = await photoService.getPhoto(safePhotoRef);
      if (photoAsset && photoAsset.blob) {
        const blobObj: Blob = photoAsset.blob;
        const reader = new FileReader();
        safePhotoDataUrl = await new Promise<string | null>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blobObj);
        });
      }
    } catch {
      // ignore
    }
  }

  const safeMessengerUrl = person.messengerUrl && person.messengerUrl.trim() ? person.messengerUrl.trim().slice(0, 500) : null;
  const safeLat = typeof person.latitude === 'number' && !isNaN(person.latitude) && person.latitude >= -90 && person.latitude <= 90 ? person.latitude : null;
  const safeLng = typeof person.longitude === 'number' && !isNaN(person.longitude) && person.longitude >= -180 && person.longitude <= 180 ? person.longitude : null;

  const docRef = doc(db, 'people', person.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: person.id,
      createdBy: userId,
      lastUpdatedBy: userId,
      name: safeName,
      photoRef: safePhotoRef,
      photoDataUrl: safePhotoDataUrl,
      latitude: safeLat,
      longitude: safeLng,
      territoryId: safeTerritoryId,
      messengerUrl: safeMessengerUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(docRef, {
      name: safeName,
      photoRef: safePhotoRef,
      photoDataUrl: safePhotoDataUrl,
      latitude: safeLat,
      longitude: safeLng,
      territoryId: safeTerritoryId,
      messengerUrl: safeMessengerUrl,
      lastUpdatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Pushes a single Territory upsert to /territories/{territoryId}.
 */
export async function pushTerritoryToFirestore(
  userId: string,
  territory: Territory
): Promise<void> {
  const docRef = doc(db, 'territories', territory.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: territory.id,
      name: territory.name.slice(0, 100),
      createdBy: userId,
      lastUpdatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(docRef, {
      name: territory.name.slice(0, 100),
      lastUpdatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Pushes a single Visit upsert to /visits/{visitId}.
 */
export async function pushVisitToFirestore(
  userId: string,
  visit: Visit
): Promise<void> {
  const personRef = doc(db, 'people', visit.personId);
  const personSnap = await getDoc(personRef);
  if (!personSnap.exists()) {
    const localPerson = await personService.getById(visit.personId);
    if (localPerson) {
      await pushPersonToFirestore(userId, localPerson);
    } else {
      const stubPerson: Person = {
        id: visit.personId,
        name: 'Contact ' + visit.personId.substring(0, 6),
        photoRef: null,
        latitude: null,
        longitude: null,
        territoryId: null,
        messengerUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await personService.save(stubPerson);
        await pushPersonToFirestore(userId, stubPerson);
      } catch (err) {
        console.warn('[Sync] Failed to create stub person for visit:', err);
      }
    }
  }

  const docRef = doc(db, 'visits', visit.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: visit.id,
      personId: visit.personId,
      visitedAt: visit.visitedAt.slice(0, 50),
      remarks: (visit.remarks || '').slice(0, 2000),
      createdBy: userId,
      lastUpdatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(docRef, {
      visitedAt: visit.visitedAt.slice(0, 50),
      remarks: (visit.remarks || '').slice(0, 2000),
      lastUpdatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Deletes a Visit from /visits/{visitId}.
 */
export async function deleteVisitFromFirestore(
  userId: string,
  visitId: string
): Promise<void> {
  const docRef = doc(db, 'visits', visitId);
  await deleteDoc(docRef);
}

/**
 * Processes the durable IndexedDB outbox queue.
 */
export async function processOutboxQueue(
  user: FirebaseUser | null
): Promise<PushResult> {
  if (isSyncRunning) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Sync is already running.',
    };
  }

  if (!user) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Sign in to push changes to the cloud.',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Device is currently offline. Pending changes are safely preserved in the outbox.',
    };
  }

  isSyncRunning = true;
  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  try {
    const pendingOps = await syncQueueService.getPending();
    if (pendingOps.length === 0) {
      return { success: true, processedCount: 0, failedCount: 0 };
    }

    const priorityWeight = (op: SyncOperation): number => {
      if (op.operationType === 'delete') return 10;
      if (op.entityType === 'territory') return 1;
      if (op.entityType === 'person') return 2;
      return 3;
    };

    const sortedOps = [...pendingOps].sort((a, b) => priorityWeight(a) - priorityWeight(b));

    for (const op of sortedOps) {
      await syncQueueService.markProcessing(op.id);
      try {
        if (op.operationType === 'upsert') {
          if (op.entityType === 'territory') {
            const territory = (op.payload as unknown as Territory) || (await territoryService.getById(op.entityId));
            if (territory) {
              await pushTerritoryToFirestore(user.uid, territory);
            }
          } else if (op.entityType === 'person') {
            const person = (op.payload as unknown as Person) || (await personService.getById(op.entityId));
            if (person) {
              await pushPersonToFirestore(user.uid, person);
            }
          } else if (op.entityType === 'visit') {
            const visitsList = await visitService.getAll();
            const visit = (op.payload as unknown as Visit) || visitsList.find((v: Visit) => v.id === op.entityId);
            if (visit) {
              await pushVisitToFirestore(user.uid, visit);
            }
          }
        } else if (op.operationType === 'delete') {
          if (op.entityType === 'visit') {
            await deleteDoc(doc(db, 'visits', op.entityId));
          } else if (op.entityType === 'person') {
            await deleteDoc(doc(db, 'people', op.entityId));
          } else if (op.entityType === 'territory') {
            await deleteDoc(doc(db, 'territories', op.entityId));
          }
        }

        await syncQueueService.markCompleted(op.id);
        processedCount++;
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        const sanitizedError = msg.substring(0, 50);
        lastError = msg;
        console.warn(`[Sync Engine] Failure | Op: ${op.operationType} | Type: ${op.entityType} | ID: ${op.entityId} | Error: ${sanitizedError}`);
        await syncQueueService.markFailed(op.id, msg);
      }
    }
  } finally {
    isSyncRunning = false;
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    errorMessage: failedCount > 0 ? (lastError || `${failedCount} operation(s) failed and remain in outbox.`) : null,
  };
}

/**
 * Fetches all shared records from root collections (/people, /visits, /territories) and reconciles them into local IndexedDB.
 */
export async function pullAndReconcileUserData(
  userId?: string | null
): Promise<PullResult> {
  let peopleSnap;
  let visitsSnap;
  let territoriesSnap;
  let isPartial = false;
  let errorMsg: string | null = null;

  try {
    const results = await Promise.allSettled([
      getDocs(collection(db, 'people')),
      getDocs(collection(db, 'visits')),
      getDocs(collection(db, 'territories')),
    ]);

    if (results[0].status === 'fulfilled') {
      peopleSnap = results[0].value;
    } else {
      isPartial = true;
      errorMsg = results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
      visitsSnap = results[1].value;
    } else {
      isPartial = true;
      if (!errorMsg) errorMsg = results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason);
    }

    if (results[2].status === 'fulfilled') {
      territoriesSnap = results[2].value;
    } else {
      isPartial = true;
      if (!errorMsg) errorMsg = results[2].reason instanceof Error ? results[2].reason.message : String(results[2].reason);
    }
  } catch (err: unknown) {
    return {
      success: false,
      addedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
      totalRemoteCount: 0,
      peopleCount: 0,
      visitsCount: 0,
      territoriesCount: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const skippedCount = 0;

  // Gather any pending local delete operations to prevent deleted entities from reappearing
  const allSyncOps = await syncQueueService.getAll();
  const deletedEntityIds = new Set(
    allSyncOps
      .filter((op) => op.operationType === 'delete' && (op.status === 'pending' || op.status === 'processing'))
      .map((op) => op.entityId)
  );

  // 1. Reconcile Territories
  const remoteTerritoriesMap = new Map<string, Territory>();
  if (territoriesSnap) {
    for (const docSnap of territoriesSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const terr: Territory = {
        id: String(data.id || docSnap.id),
        name: String(data.name || 'Untitled Territory'),
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt),
      };
      if (!deletedEntityIds.has(terr.id)) {
        remoteTerritoriesMap.set(terr.id, terr);
      }
    }
  }

  const localTerritories = await territoryService.getAll();
  const localTerritoriesMap = new Map<string, Territory>(localTerritories.map((t: Territory) => [t.id, t]));

  for (const [id, remoteTerr] of remoteTerritoriesMap.entries() as IterableIterator<[string, Territory]>) {
    if (deletedEntityIds.has(id)) continue;
    const localTerr = localTerritoriesMap.get(id);
    if (!localTerr) {
      await territoryService.save(remoteTerr);
      addedCount++;
    } else {
      const remoteTime = new Date(remoteTerr.updatedAt).getTime();
      const localTime = new Date(localTerr.updatedAt).getTime();
      if (remoteTime > localTime) {
        await territoryService.save(remoteTerr);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  // 2. Reconcile People & Photos
  const remotePeopleMap = new Map<string, Person & { photoDataUrl?: string | null }>();
  if (peopleSnap) {
    for (const docSnap of peopleSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const person: Person & { photoDataUrl?: string | null } = {
        id: String(data.id || docSnap.id),
        name: String(data.name || 'Unnamed'),
        photoRef: typeof data.photoRef === 'string' ? data.photoRef : null,
        photoDataUrl: typeof data.photoDataUrl === 'string' ? data.photoDataUrl : null,
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        territoryId: typeof data.territoryId === 'string' ? data.territoryId : null,
        messengerUrl: typeof data.messengerUrl === 'string' ? data.messengerUrl : null,
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt),
      };
      if (!deletedEntityIds.has(person.id)) {
        remotePeopleMap.set(person.id, person);
      }

      if (person.photoRef && person.photoDataUrl && !deletedEntityIds.has(person.id)) {
        try {
          const existingPhoto = await photoService.getPhoto(person.photoRef);
          if (!existingPhoto) {
            await photoService.savePhotoDataUrlExplicit(person.photoRef, person.photoDataUrl);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const localPeople = await personService.getAll();
  const localPeopleMap = new Map<string, Person>(localPeople.map((p: Person) => [p.id, p]));

  for (const [id, remotePerson] of remotePeopleMap.entries() as IterableIterator<[string, Person & { photoDataUrl?: string | null }]>) {
    if (deletedEntityIds.has(id)) continue;
    const localPerson = localPeopleMap.get(id);
    if (!localPerson) {
      await personService.save(remotePerson);
      addedCount++;
    } else {
      const remoteTime = new Date(remotePerson.updatedAt).getTime();
      const localTime = new Date(localPerson.updatedAt).getTime();
      if (remoteTime > localTime) {
        await personService.save(remotePerson);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  // 3. Reconcile Visits
  const remoteVisitsMap = new Map<string, Visit>();
  if (visitsSnap) {
    for (const docSnap of visitsSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const visit: Visit = {
        id: String(data.id || docSnap.id),
        personId: String(data.personId || ''),
        visitedAt: String(data.visitedAt || new Date().toISOString()),
        remarks: String(data.remarks || ''),
        createdAt: timestampToISO(data.createdAt),
        updatedAt: timestampToISO(data.updatedAt),
      };
      if (visit.personId && !deletedEntityIds.has(visit.id)) {
        remoteVisitsMap.set(visit.id, visit);
      }
    }
  }

  const localVisits = await visitService.getAll();
  const localVisitsMap = new Map<string, Visit>(localVisits.map((v: Visit) => [v.id, v]));

  for (const [id, remoteVisit] of remoteVisitsMap.entries() as IterableIterator<[string, Visit]>) {
    if (deletedEntityIds.has(id)) continue;
    const localVisit = localVisitsMap.get(id);
    if (!localVisit) {
      await visitService.save(remoteVisit);
      addedCount++;
    } else {
      const remoteTime = new Date(remoteVisit.updatedAt).getTime();
      const localTime = new Date(localVisit.updatedAt).getTime();
      if (remoteTime > localTime) {
        await visitService.save(remoteVisit);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  const totalPeople = peopleSnap ? peopleSnap.size : 0;
  const totalVisits = visitsSnap ? visitsSnap.size : 0;
  const totalTerritories = territoriesSnap ? territoriesSnap.size : 0;
  const totalRemoteCount = totalPeople + totalVisits + totalTerritories;

  return {
    success: true,
    addedCount,
    updatedCount,
    unchangedCount,
    skippedCount,
    totalRemoteCount,
    peopleCount: totalPeople,
    visitsCount: totalVisits,
    territoriesCount: totalTerritories,
    isPartial,
    errorMessage: isPartial ? (errorMsg || 'Some collections could not be fetched.') : null,
  };
}

/**
 * Sets up real-time listener for shared record updates.
 */
export function subscribeToUserSync(
  userId?: string | null,
  onRemoteChange: () => void = () => {}
): Unsubscribe {
  let initialLoaded = false;
  const unsubs: Unsubscribe[] = [];

  const handleRemoteSnapshot = () => {
    if (!initialLoaded) return;
    pullAndReconcileUserData(userId)
      .then(() => onRemoteChange())
      .catch((err) => console.warn('[Realtime Sync] Reconcile error:', err));
  };

  const handleError = (err: unknown) => {
    console.debug('[Realtime Sync] Snapshot disconnected or offline:', err);
  };

  try {
    const un1 = onSnapshot(collection(db, 'people'), handleRemoteSnapshot, handleError);
    const un2 = onSnapshot(collection(db, 'territories'), handleRemoteSnapshot, handleError);
    const un3 = onSnapshot(collection(db, 'visits'), handleRemoteSnapshot, handleError);
    unsubs.push(un1, un2, un3);
    setTimeout(() => {
      initialLoaded = true;
    }, 1200);
  } catch (err) {
    console.warn('[Realtime Sync] Listener registration failed:', err);
  }

  return () => {
    unsubs.forEach((un) => {
      try {
        un();
      } catch {
        // ignore cleanup errors
      }
    });
  };
}

/**
 * Promotes local records to shared cloud storage.
 */
export async function promoteLocalDataToCloud(
  user: FirebaseUser
): Promise<{
  reconciledPeople: number;
  reconciledVisits: number;
  reconciledTerritories: number;
}> {
  const [allPeople, allVisits, allTerritories] = await Promise.all([
    personService.getAll(),
    visitService.getAll(),
    territoryService.getAll(),
  ]);

  let reconciledPeople = 0;
  let reconciledVisits = 0;
  let reconciledTerritories = 0;

  for (const terr of allTerritories) {
    try {
      await pushTerritoryToFirestore(user.uid, terr);
      reconciledTerritories++;
    } catch (err) {
      console.warn('[Sync] Failed to promote territory:', terr.id, err);
    }
  }

  for (const person of allPeople) {
    try {
      await pushPersonToFirestore(user.uid, person);
      reconciledPeople++;
    } catch (err) {
      console.warn('[Sync] Failed to promote person:', person.id, err);
    }
  }

  for (const visit of allVisits) {
    try {
      await pushVisitToFirestore(user.uid, visit);
      reconciledVisits++;
    } catch (err) {
      console.warn('[Sync] Failed to promote visit:', visit.id, err);
    }
  }

  await processOutboxQueue(user);

  return {
    reconciledPeople,
    reconciledVisits,
    reconciledTerritories,
  };
}
