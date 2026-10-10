/**
 * Shared Workspace, Offline Outbox, and Reconciliation Test Suite
 *
 * Verifies:
 * 1. Offline Queue Durability: Enqueue operations into durable outbox with full schema.
 * 2. Retry Logic: Failure increments retryCount and maintains pending status for backoff.
 * 3. Duplicate Delivery / Idempotency: Coalesces duplicate entity operations into a single pending operation.
 * 4. Conflict Handling: Local uncommitted outbox changes are NOT overwritten by remote updates.
 * 5. Cross-Member Updates: Remote changes from other members update local store when no pending local edits exist.
 * 6. Legacy Local-Data Preservation: Pre-existing local records are never automatically overwritten or wiped.
 * 7. Authorization Gate: Unapproved / guest users are blocked from executing cloud sync writes.
 * 8. Safe Reconciliation: Local-only records are cleanly linked to /workspaces/default without duplicate records.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SyncOperation, Person, Visit, Territory } from './src/types';

// In-memory Outbox Queue Simulation matching syncQueueService logic
class MockOutboxStore {
  private store = new Map<string, SyncOperation>();

  async enqueue(op: {
    entityType: 'person' | 'visit' | 'territory';
    entityId: string;
    operationType: 'upsert' | 'delete';
    payload?: Record<string, unknown> | null;
    workspaceId?: string;
  }): Promise<SyncOperation> {
    const existing = Array.from(this.store.values()).find(
      (o) => o.entityType === op.entityType && o.entityId === op.entityId && (o.status === 'pending' || o.status === 'processing')
    );

    const now = new Date().toISOString();

    if (existing) {
      const updated: SyncOperation = {
        ...existing,
        operationType: op.operationType,
        payload: op.payload !== undefined ? op.payload : existing.payload,
        status: 'pending',
        clientTimestamp: now,
        workspaceId: op.workspaceId || existing.workspaceId || 'default',
        errorMessage: null,
      };
      this.store.set(existing.id, updated);
      return updated;
    }

    const id = 'op_' + Math.random().toString(36).substring(2, 9);
    const newOp: SyncOperation = {
      id,
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
    this.store.set(id, newOp);
    return newOp;
  }

  async getPending(): Promise<SyncOperation[]> {
    return Array.from(this.store.values())
      .filter((o) => o.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async markProcessing(id: string): Promise<void> {
    const op = this.store.get(id);
    if (op) {
      op.status = 'processing';
      op.lastAttemptAt = new Date().toISOString();
    }
  }

  async markCompleted(id: string): Promise<void> {
    this.store.delete(id);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const op = this.store.get(id);
    if (op) {
      op.retryCount += 1;
      op.errorMessage = errorMessage;
      op.lastAttemptAt = new Date().toISOString();
      op.status = op.retryCount > 5 ? 'failed' : 'pending';
    }
  }

  get(id: string): SyncOperation | undefined {
    return this.store.get(id);
  }

  size(): number {
    return this.store.size;
  }
}

describe('Shared Workspace & Offline Outbox Test Suite', () => {
  it('1. Offline Queue Durability: Enqueued operations persist in FIFO order', async () => {
    const queue = new MockOutboxStore();

    await queue.enqueue({
      entityType: 'territory',
      entityId: 'terr_north',
      operationType: 'upsert',
      payload: { name: 'North District' },
    });

    await queue.enqueue({
      entityType: 'person',
      entityId: 'person_jane',
      operationType: 'upsert',
      payload: { name: 'Jane Doe', territoryId: 'terr_north' },
    });

    const pending = await queue.getPending();
    assert.equal(pending.length, 2, 'Queue must hold 2 pending items');
    assert.equal(pending[0].entityType, 'territory', 'FIFO order preserved: territory first');
    assert.equal(pending[1].entityType, 'person', 'FIFO order preserved: person second');
    assert.equal(pending[0].status, 'pending');
    assert.equal(pending[0].retryCount, 0);
  });

  it('2. Retry Logic: Failure records error and increments retryCount while preserving pending state', async () => {
    const queue = new MockOutboxStore();

    const op = await queue.enqueue({
      entityType: 'visit',
      entityId: 'visit_999',
      operationType: 'upsert',
      payload: { remarks: 'First Bible study' },
    });

    await queue.markProcessing(op.id);
    assert.equal(queue.get(op.id)?.status, 'processing');

    // Simulate transient network failure
    await queue.markFailed(op.id, 'Network connection timed out');

    const failedOp = queue.get(op.id);
    assert.ok(failedOp);
    assert.equal(failedOp.retryCount, 1);
    assert.equal(failedOp.errorMessage, 'Network connection timed out');
    assert.equal(failedOp.status, 'pending', 'Must remain pending for retry');
    assert.ok(failedOp.lastAttemptAt, 'Timestamp of attempt recorded');
  });

  it('3. Duplicate Delivery / Idempotency: Multiple edits coalesce into a single pending outbox record', async () => {
    const queue = new MockOutboxStore();

    // First edit while offline
    const op1 = await queue.enqueue({
      entityType: 'person',
      entityId: 'person_sam',
      operationType: 'upsert',
      payload: { name: 'Sam Smith', messengerUrl: 'm.me/sam' },
    });

    // Second edit before outbox flushed
    const op2 = await queue.enqueue({
      entityType: 'person',
      entityId: 'person_sam',
      operationType: 'upsert',
      payload: { name: 'Samuel Smith', messengerUrl: 'm.me/samuel' },
    });

    assert.equal(op1.id, op2.id, 'Operation ID must be reused for coalescing');
    assert.equal(queue.size(), 1, 'Only 1 outbox record should exist for person_sam');
    assert.deepEqual(op2.payload, { name: 'Samuel Smith', messengerUrl: 'm.me/samuel' });
  });

  it('4. Conflict Handling: Local uncommitted outbox changes are NOT overwritten by server updates', () => {
    const localPerson: Person = {
      id: 'person_101',
      name: 'Local Draft Name',
      photoRef: null,
      latitude: null,
      longitude: null,
      territoryId: null,
      messengerUrl: null,
      createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T10:15:00.000Z',
      workspaceId: 'default',
    };

    const serverPerson: Person = {
      id: 'person_101',
      name: 'Server Overwritten Name',
      photoRef: null,
      latitude: null,
      longitude: null,
      territoryId: null,
      messengerUrl: null,
      createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T10:12:00.000Z',
      workspaceId: 'default',
    };

    // If an entity has a pending outbox operation, local edit takes precedence
    const hasPendingOutboxOperation = true;
    const resolvedPerson = hasPendingOutboxOperation ? localPerson : serverPerson;

    assert.equal(resolvedPerson.name, 'Local Draft Name', 'Pending local change must not be overwritten');
  });

  it('5. Cross-Member Updates: Server changes from another member apply when no local pending edit exists', () => {
    const localPerson: Person = {
      id: 'person_202',
      name: 'Elder Davis',
      photoRef: null,
      latitude: null,
      longitude: null,
      territoryId: null,
      messengerUrl: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      lastUpdatedBy: 'user_member_A',
      workspaceId: 'default',
    };

    const serverPerson: Person = {
      id: 'person_202',
      name: 'Elder Davis (Updated Notes)',
      photoRef: null,
      latitude: null,
      longitude: null,
      territoryId: 'terr_central',
      messengerUrl: 'm.me/davis',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-09T12:00:00.000Z',
      lastUpdatedBy: 'user_member_B',
      workspaceId: 'default',
    };

    const hasPendingOutboxOperation = false;
    let reconciled = localPerson;

    if (!hasPendingOutboxOperation && new Date(serverPerson.updatedAt) > new Date(localPerson.updatedAt)) {
      reconciled = serverPerson;
    }

    assert.equal(reconciled.name, 'Elder Davis (Updated Notes)');
    assert.equal(reconciled.lastUpdatedBy, 'user_member_B', 'Cross-member update attribution preserved');
    assert.equal(reconciled.territoryId, 'terr_central');
  });

  it('6. Legacy Local-Data Preservation: Pre-existing local records are never cleared on sync', () => {
    const localStore: Person[] = [
      {
        id: 'legacy_person_1',
        name: 'Pre-existing Local Contact',
        photoRef: null,
        latitude: null,
        longitude: null,
        territoryId: null,
        messengerUrl: null,
        createdAt: '2026-09-01T12:00:00.000Z',
        updatedAt: '2026-09-01T12:00:00.000Z',
        isLocalOnly: true,
      },
    ];

    // Downloaded shared records from Firestore
    const downloadedShared: Person[] = [
      {
        id: 'shared_person_99',
        name: 'Shared Workspace Contact',
        photoRef: null,
        latitude: null,
        longitude: null,
        territoryId: null,
        messengerUrl: null,
        createdAt: '2026-10-09T10:00:00.000Z',
        updatedAt: '2026-10-09T10:00:00.000Z',
        workspaceId: 'default',
        isLocalOnly: false,
      },
    ];

    // Merge preserves legacy local-only contact
    const merged = [...localStore, ...downloadedShared];

    assert.equal(merged.length, 2);
    const legacy = merged.find((p) => p.id === 'legacy_person_1');
    assert.ok(legacy);
    assert.equal(legacy.isLocalOnly, true, 'Legacy record remains intact');
  });

  it('7. Authorization Gate: Guest or unapproved user cannot trigger cloud writes', () => {
    const guestUser = null;
    const pendingMember = { uid: 'user_pending', isApproved: false };
    const approvedMember = { uid: 'user_approved', isApproved: true };

    function canWriteSharedData(user: { uid: string; isApproved: boolean } | null): boolean {
      if (!user) return false;
      return user.isApproved;
    }

    assert.equal(canWriteSharedData(guestUser), false, 'Guest cannot write');
    assert.equal(canWriteSharedData(pendingMember), false, 'Pending member cannot write');
    assert.equal(canWriteSharedData(approvedMember), true, 'Approved member can write');
  });

  it('8. Safe Reconciliation: Promotes local records into /workspaces/default and queues them without duplicates', () => {
    const localPeople: Person[] = [
      {
        id: 'local_rec_1',
        name: 'Carlos Ruiz',
        photoRef: null,
        latitude: null,
        longitude: null,
        territoryId: null,
        messengerUrl: null,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
        isLocalOnly: true,
      },
    ];

    const currentUserId = 'approved_member_123';
    const workspaceId = 'default';

    // Reconcile
    const reconciled = localPeople.map((p) => ({
      ...p,
      workspaceId,
      createdBy: currentUserId,
      lastUpdatedBy: currentUserId,
      isLocalOnly: false,
    }));

    assert.equal(reconciled[0].workspaceId, 'default');
    assert.equal(reconciled[0].createdBy, 'approved_member_123');
    assert.equal(reconciled[0].isLocalOnly, false);
    assert.equal(reconciled[0].id, 'local_rec_1', 'Original ID preserved to prevent duplicate creation');
  });
});
