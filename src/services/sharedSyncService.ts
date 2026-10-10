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
import { db, handleFirestoreError, OperationType } from './firebase';
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
 * Pushes a single Person upsert to /workspaces/{workspaceId}/people/{personId}.
 * Complies with firestore.rules:
 * - createdBy & createdAt immutable on update
 * - lastUpdatedBy & updatedAt set to request.auth.uid & serverTimestamp()
 */
export async function pushPersonToFirestore(
  workspaceId: string,
  person: Person,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'people', person.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    // Document creation
    await setDoc(docRef, {
      id: person.id,
      workspaceId,
      createdBy: person.createdBy || userId,
      lastUpdatedBy: userId,
      name: person.name.slice(0, 100),
      photoRef: person.photoRef || null,
      latitude: person.latitude ?? null,
      longitude: person.longitude ?? null,
      territoryId: person.territoryId || null,
      messengerUrl: person.messengerUrl || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Document update: only affect mutable fields
    await updateDoc(docRef, {
      name: person.name.slice(0, 100),
      photoRef: person.photoRef || null,
      latitude: person.latitude ?? null,
      longitude: person.longitude ?? null,
      territoryId: person.territoryId || null,
      messengerUrl: person.messengerUrl || null,
      lastUpdatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Pushes a single Territory upsert to /workspaces/{workspaceId}/territories/{territoryId}.
 */
export async function pushTerritoryToFirestore(
  workspaceId: string,
  territory: Territory,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'territories', territory.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: territory.id,
      workspaceId,
      name: territory.name.slice(0, 100),
      createdBy: territory.createdBy || userId,
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
 * Pushes a single Visit upsert to /workspaces/{workspaceId}/visits/{visitId}.
 * Requires parent person to exist in Firestore per security rules.
 */
export async function pushVisitToFirestore(
  workspaceId: string,
  visit: Visit,
  userId: string
): Promise<void> {
  // Verify parent person exists in Firestore
  const personRef = doc(db, 'workspaces', workspaceId, 'people', visit.personId);
  const personSnap = await getDoc(personRef);
  if (!personSnap.exists()) {
    // If person is locally available, ensure person is pushed first
    const localPerson = await personService.getById(visit.personId);
    if (localPerson) {
      await pushPersonToFirestore(workspaceId, localPerson, userId);
    } else {
      throw new Error(`Referenced person "${visit.personId}" does not exist in workspace.`);
    }
  }

  const docRef = doc(db, 'workspaces', workspaceId, 'visits', visit.id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: visit.id,
      workspaceId,
      personId: visit.personId,
      visitedAt: visit.visitedAt.slice(0, 50),
      remarks: (visit.remarks || '').slice(0, 2000),
      createdBy: visit.createdBy || userId,
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
 * Deletes a Visit from /workspaces/{workspaceId}/visits/{visitId}.
 * Note: Only visits allow deletion under deployed security rules.
 */
export async function deleteVisitFromFirestore(
  workspaceId: string,
  visitId: string
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'visits', visitId);
  await deleteDoc(docRef);
}

/**
 * Processes the durable IndexedDB outbox queue.
 * Safely handles retries, ordering, network outages, and rule validation.
 */
export async function processOutboxQueue(
  user: FirebaseUser | null,
  isApproved: boolean,
  workspaceId = 'default'
): Promise<PushResult> {
  if (isSyncRunning) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Sync is already running.',
    };
  }

  // Safety gate: Guest and unapproved users must not write shared data
  if (!user) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Sign in with an authorized account to push changes to the cloud.',
    };
  }

  if (!isApproved) {
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      errorMessage: 'Account is not an approved workspace member. Pushing shared records is blocked.',
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

    // Sort operations topologically for relational rule integrity:
    // 1. Territories upsert (parent for people)
    // 2. People upsert (parent for visits)
    // 3. Visits upsert
    // 4. Deletes (visits delete)
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
              await pushTerritoryToFirestore(workspaceId, territory, user.uid);
            }
          } else if (op.entityType === 'person') {
            const person = (op.payload as unknown as Person) || (await personService.getById(op.entityId));
            if (person) {
              await pushPersonToFirestore(workspaceId, person, user.uid);
            }
          } else if (op.entityType === 'visit') {
            const visit = (op.payload as unknown as Visit) || (await visitService.getAll()).find((v) => v.id === op.entityId);
            if (visit) {
              await pushVisitToFirestore(workspaceId, visit, user.uid);
            }
          }
        } else if (op.operationType === 'delete') {
          if (op.entityType === 'visit') {
            await deleteVisitFromFirestore(workspaceId, op.entityId);
          } else {
            console.info(`[Sync Engine] Cloud delete skipped for ${op.entityType} "${op.entityId}" per security policy.`);
          }
        }

        await syncQueueService.markCompleted(op.id);
        processedCount++;
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        console.warn(`[Sync Outbox] Operation ${op.id} (${op.entityType} ${op.entityId}) failed:`, msg);
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
 * Fetches all shared records from /workspaces/{workspaceId} and reconciles them into local IndexedDB.
 * Respects local pending uncommitted changes in sync_queue.
 * Returns exact counts for added, updated, unchanged, and skipped records.
 */
export async function pullAndReconcileSharedData(
  workspaceId = 'default'
): Promise<PullResult> {
  let peopleSnap;
  let visitsSnap;
  let territoriesSnap;
  let isPartial = false;
  let errorMsg: string | null = null;

  try {
    const results = await Promise.allSettled([
      getDocs(collection(db, 'workspaces', workspaceId, 'people')),
      getDocs(collection(db, 'workspaces', workspaceId, 'visits')),
      getDocs(collection(db, 'workspaces', workspaceId, 'territories')),
    ]);

    if (results[0].status === 'fulfilled') peopleSnap = results[0].value;
    else { isPartial = true; errorMsg = String(results[0].reason); }

    if (results[1].status === 'fulfilled') visitsSnap = results[1].value;
    else { isPartial = true; errorMsg = String(results[1].reason); }

    if (results[2].status === 'fulfilled') territoriesSnap = results[2].value;
    else { isPartial = true; errorMsg = String(results[2].reason); }
  } catch (err) {
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
      errorMessage: err instanceof Error ? err.message : 'Network error pulling shared records.',
    };
  }

  const pendingOps = await syncQueueService.getPending();
  const pendingEntityKeys = new Set(pendingOps.map((o) => `${o.entityType}_${o.entityId}`));

  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;
  let peopleCount = 0;
  let visitsCount = 0;
  let territoriesCount = 0;

  // 1. Reconcile Territories
  if (territoriesSnap) {
    for (const docSnap of territoriesSnap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      territoriesCount++;

      if (pendingEntityKeys.has(`territory_${id}`)) {
        skippedCount++;
        continue;
      }

      const localTerritory = await territoryService.getById(id);
      const remoteUpdatedAt = timestampToISO(data.updatedAt);

      if (!localTerritory) {
        await territoryService.save({
          id,
          name: data.name || '',
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        addedCount++;
      } else if (new Date(remoteUpdatedAt).getTime() > new Date(localTerritory.updatedAt).getTime()) {
        await territoryService.save({
          id,
          name: data.name || '',
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  // 2. Reconcile People
  if (peopleSnap) {
    for (const docSnap of peopleSnap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      peopleCount++;

      if (pendingEntityKeys.has(`person_${id}`)) {
        skippedCount++;
        continue;
      }

      const localPerson = await personService.getById(id);
      const remoteUpdatedAt = timestampToISO(data.updatedAt);

      if (!localPerson) {
        await personService.save({
          id,
          name: data.name || '',
          photoRef: data.photoRef || null,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          territoryId: data.territoryId || null,
          messengerUrl: data.messengerUrl || null,
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        addedCount++;
      } else if (new Date(remoteUpdatedAt).getTime() > new Date(localPerson.updatedAt).getTime()) {
        await personService.save({
          id,
          name: data.name || '',
          photoRef: data.photoRef || null,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          territoryId: data.territoryId || null,
          messengerUrl: data.messengerUrl || null,
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  // 3. Reconcile Visits
  if (visitsSnap) {
    const allLocalVisits = await visitService.getAll();
    const localVisitsMap = new Map(allLocalVisits.map((v) => [v.id, v]));

    for (const docSnap of visitsSnap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      visitsCount++;

      if (pendingEntityKeys.has(`visit_${id}`)) {
        skippedCount++;
        continue;
      }

      const localVisit = localVisitsMap.get(id);
      const remoteUpdatedAt = timestampToISO(data.updatedAt);

      if (!localVisit) {
        await visitService.save({
          id,
          personId: data.personId || '',
          visitedAt: data.visitedAt || new Date().toISOString(),
          remarks: data.remarks || '',
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        addedCount++;
      } else if (new Date(remoteUpdatedAt).getTime() > new Date(localVisit.updatedAt).getTime()) {
        await visitService.save({
          id,
          personId: data.personId || '',
          visitedAt: data.visitedAt || new Date().toISOString(),
          remarks: data.remarks || '',
          createdAt: timestampToISO(data.createdAt),
          updatedAt: remoteUpdatedAt,
          workspaceId,
          createdBy: data.createdBy,
          lastUpdatedBy: data.lastUpdatedBy,
          isLocalOnly: false,
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  const totalRemoteCount = peopleCount + visitsCount + territoriesCount;

  return {
    success: !isPartial,
    addedCount,
    updatedCount,
    unchangedCount,
    skippedCount,
    totalRemoteCount,
    peopleCount,
    visitsCount,
    territoriesCount,
    isPartial,
    errorMessage: isPartial ? (errorMsg || 'Some collections could not be fetched.') : null,
  };
}

/**
 * Sets up real-time listener for shared workspace updates.
 */
export function subscribeToSharedWorkspace(
  workspaceId: string,
  onRemoteChange: () => void
): Unsubscribe {
  let initialLoaded = false;
  const unsubs: Unsubscribe[] = [];

  const handleRemoteSnapshot = () => {
    if (!initialLoaded) return;
    pullAndReconcileSharedData(workspaceId)
      .then(() => onRemoteChange())
      .catch((err) => console.warn('[Realtime Sync] Reconcile error:', err));
  };

  try {
    const un1 = onSnapshot(collection(db, 'workspaces', workspaceId, 'people'), handleRemoteSnapshot);
    const un2 = onSnapshot(collection(db, 'workspaces', workspaceId, 'territories'), handleRemoteSnapshot);
    const un3 = onSnapshot(collection(db, 'workspaces', workspaceId, 'visits'), handleRemoteSnapshot);
    unsubs.push(un1, un2, un3);
    setTimeout(() => {
      initialLoaded = true;
    }, 1200);
  } catch (err) {
    console.warn('[Realtime Sync] Listener registration failed:', err);
  }

  return () => {
    unsubs.forEach((un) => un());
  };
}

/**
 * Safe reconciliation path for existing local-only data.
 * Protects pre-existing records and never automatically uploads them without explicit member action.
 * Avoids duplicate records and preserves local history.
 */
export async function reconcileLocalOnlyData(
  user: FirebaseUser,
  workspaceId = 'default'
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

  // Identify records that have never been linked to a workspace
  const localPeople = allPeople.filter((p) => p.isLocalOnly === true || !p.workspaceId);
  const localTerritories = allTerritories.filter((t) => t.isLocalOnly === true || !t.workspaceId);
  const localVisits = allVisits.filter((v) => v.isLocalOnly === true || !v.workspaceId);

  // 1. Promote territories to shared workspace and enqueue
  for (const terr of localTerritories) {
    const updated = await territoryService.save({
      ...terr,
      workspaceId,
      createdBy: terr.createdBy || user.uid,
      lastUpdatedBy: user.uid,
      isLocalOnly: false,
    });
    await syncQueueService.enqueue({
      entityType: 'territory',
      entityId: updated.id,
      operationType: 'upsert',
      payload: updated as unknown as Record<string, unknown>,
      workspaceId,
    });
  }

  // 2. Promote people to shared workspace and enqueue
  for (const person of localPeople) {
    const updated = await personService.save({
      ...person,
      workspaceId,
      createdBy: person.createdBy || user.uid,
      lastUpdatedBy: user.uid,
      isLocalOnly: false,
    });
    await syncQueueService.enqueue({
      entityType: 'person',
      entityId: updated.id,
      operationType: 'upsert',
      payload: updated as unknown as Record<string, unknown>,
      workspaceId,
    });
  }

  // 3. Promote visits to shared workspace and enqueue
  for (const visit of localVisits) {
    const updated = await visitService.save({
      ...visit,
      workspaceId,
      createdBy: visit.createdBy || user.uid,
      lastUpdatedBy: user.uid,
      isLocalOnly: false,
    });
    await syncQueueService.enqueue({
      entityType: 'visit',
      entityId: updated.id,
      operationType: 'upsert',
      payload: updated as unknown as Record<string, unknown>,
      workspaceId,
    });
  }

  // Trigger outbox processing
  await processOutboxQueue(user, true, workspaceId);

  return {
    reconciledPeople: localPeople.length,
    reconciledVisits: localVisits.length,
    reconciledTerritories: localTerritories.length,
  };
}
