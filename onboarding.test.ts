/**
 * Automatic Member Onboarding Unit & Integration Test Suite
 *
 * Verifies server-side onboarding logic:
 * 1. First-time login / provisioning creates an approved member document in /workspaces/default/members/{uid}.
 * 2. Populates all required fields matching schema: id, userId, workspaceId ('default'), email, status ('approved'), role ('member'), createdAt, updatedAt.
 * 3. Idempotency: repeated logins do NOT overwrite existing documents or reset timestamps/roles.
 * 4. Safety: existing pending or revoked members are NEVER automatically approved.
 * 5. Role preservation: existing admin accounts are NEVER demoted to member.
 * 6. Identity validation & anti-spoofing: unauthenticated or invalid callers are rejected.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onboardMemberRecord, MemberRecord } from './src/server/onboarding';

// Mock In-Memory Firestore implementation matching Firestore Admin interface
class MockDocumentReference {
  constructor(private path: string, private store: Map<string, Record<string, unknown>>) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: !!data,
      data: () => (data ? { ...data } : undefined),
    };
  }

  async set(data: Record<string, unknown>) {
    this.store.set(this.path, { ...data });
  }
}

class MockCollectionReference {
  constructor(private path: string, private store: Map<string, Record<string, unknown>>) {}

  doc(id: string) {
    return new MockDocumentReference(`${this.path}/${id}`, this.store);
  }
}

class MockFirestore {
  public store = new Map<string, Record<string, unknown>>();

  collection(name: string) {
    if (name === 'workspaces') {
      return {
        doc: (workspaceId: string) => ({
          collection: (subName: string) => {
            if (subName === 'members') {
              return new MockCollectionReference(`workspaces/${workspaceId}/members`, this.store);
            }
            throw new Error(`Unexpected subcollection ${subName}`);
          },
        }),
      };
    }
    throw new Error(`Unexpected root collection ${name}`);
  }
}

describe('Deaf Contact Record — Automatic Member Onboarding Suite', () => {
  it('1. First login: creates approved member document with full schema in /workspaces/default/members/{uid}', async () => {
    const firestore = new MockFirestore();
    const newUser = {
      uid: 'auth-user-101',
      email: 'brother.smith@example.org',
      displayName: 'Brother Smith',
    };

    const result = await onboardMemberRecord(firestore as any, newUser, 'default');

    assert.equal(result.success, true);
    assert.equal(result.action, 'created');
    assert.equal(result.isApproved, true);

    // Verify stored document
    const stored = firestore.store.get('workspaces/default/members/auth-user-101') as unknown as MemberRecord;
    assert.ok(stored, 'Member document must exist in Firestore');
    assert.equal(stored.id, 'auth-user-101');
    assert.equal(stored.userId, 'auth-user-101');
    assert.equal(stored.workspaceId, 'default');
    assert.equal(stored.email, 'brother.smith@example.org');
    assert.equal(stored.displayName, 'Brother Smith');
    assert.equal(stored.status, 'approved');
    assert.equal(stored.role, 'member');
    assert.ok(stored.createdAt, 'createdAt timestamp must be set');
    assert.ok(stored.updatedAt, 'updatedAt timestamp must be set');
  });

  it('2. Repeat login (idempotency): preserves existing approved member without overwriting', async () => {
    const firestore = new MockFirestore();
    const existingCreatedAt = '2026-10-01T10:00:00.000Z';
    const existingUpdatedAt = '2026-10-01T10:00:00.000Z';

    // Pre-populate existing member
    firestore.store.set('workspaces/default/members/auth-user-101', {
      id: 'auth-user-101',
      userId: 'auth-user-101',
      workspaceId: 'default',
      email: 'brother.smith@example.org',
      displayName: 'Brother Smith',
      status: 'approved',
      role: 'member',
      createdAt: existingCreatedAt,
      updatedAt: existingUpdatedAt,
    });

    const repeatUser = {
      uid: 'auth-user-101',
      email: 'brother.smith@example.org',
      displayName: 'Brother Smith (Updated)',
    };

    const result = await onboardMemberRecord(firestore as any, repeatUser, 'default');

    assert.equal(result.success, true);
    assert.equal(result.action, 'existing_preserved');
    assert.equal(result.isApproved, true);

    // Verify stored document was NOT overwritten
    const stored = firestore.store.get('workspaces/default/members/auth-user-101') as unknown as MemberRecord;
    assert.equal(stored.createdAt, existingCreatedAt, 'Original createdAt must be preserved');
    assert.equal(stored.updatedAt, existingUpdatedAt, 'Original updatedAt must be preserved');
    assert.equal(stored.displayName, 'Brother Smith', 'Existing fields must not be altered');
  });

  it('3. Protection of pending members: repeat login NEVER auto-approves a pending membership', async () => {
    const firestore = new MockFirestore();

    // Pre-populate a member whose status is pending
    firestore.store.set('workspaces/default/members/auth-pending-202', {
      id: 'auth-pending-202',
      userId: 'auth-pending-202',
      workspaceId: 'default',
      email: 'pending.user@example.org',
      status: 'pending',
      role: 'member',
      createdAt: '2026-10-05T08:00:00.000Z',
      updatedAt: '2026-10-05T08:00:00.000Z',
    });

    const pendingUser = {
      uid: 'auth-pending-202',
      email: 'pending.user@example.org',
    };

    const result = await onboardMemberRecord(firestore as any, pendingUser, 'default');

    assert.equal(result.success, true);
    assert.equal(result.action, 'existing_preserved');
    assert.equal(result.isApproved, false, 'Pending user must NOT be reported as approved');

    const stored = firestore.store.get('workspaces/default/members/auth-pending-202') as unknown as MemberRecord;
    assert.equal(stored.status, 'pending', 'Stored status MUST remain pending');
  });

  it('4. Protection of revoked members: repeat login NEVER re-approves a revoked membership', async () => {
    const firestore = new MockFirestore();

    firestore.store.set('workspaces/default/members/auth-revoked-303', {
      id: 'auth-revoked-303',
      userId: 'auth-revoked-303',
      workspaceId: 'default',
      email: 'revoked.user@example.org',
      status: 'revoked',
      role: 'member',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    });

    const revokedUser = {
      uid: 'auth-revoked-303',
      email: 'revoked.user@example.org',
    };

    const result = await onboardMemberRecord(firestore as any, revokedUser, 'default');

    assert.equal(result.success, true);
    assert.equal(result.action, 'existing_preserved');
    assert.equal(result.isApproved, false, 'Revoked user must NOT be reported as approved');

    const stored = firestore.store.get('workspaces/default/members/auth-revoked-303') as unknown as MemberRecord;
    assert.equal(stored.status, 'revoked', 'Stored status MUST remain revoked');
  });

  it('5. Protection of administrator roles: admin account is NEVER demoted to member', async () => {
    const firestore = new MockFirestore();

    firestore.store.set('workspaces/default/members/auth-admin-404', {
      id: 'auth-admin-404',
      userId: 'auth-admin-404',
      workspaceId: 'default',
      email: 'overseer@example.org',
      status: 'approved',
      role: 'admin',
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-01T08:00:00.000Z',
    });

    const adminUser = {
      uid: 'auth-admin-404',
      email: 'overseer@example.org',
    };

    const result = await onboardMemberRecord(firestore as any, adminUser, 'default');

    assert.equal(result.success, true);
    assert.equal(result.isApproved, true);

    const stored = firestore.store.get('workspaces/default/members/auth-admin-404') as unknown as MemberRecord;
    assert.equal(stored.role, 'admin', 'Admin role must NEVER be demoted to member');
  });

  it('6. Unauthenticated / invalid identity rejection: invalid UID or email is rejected', async () => {
    const firestore = new MockFirestore();

    const emptyUidResult = await onboardMemberRecord(
      firestore as any,
      { uid: '', email: 'valid@example.org' },
      'default'
    );
    assert.equal(emptyUidResult.success, false);
    assert.equal(emptyUidResult.action, 'rejected');

    const invalidEmailResult = await onboardMemberRecord(
      firestore as any,
      { uid: 'some-uid', email: 'not-an-email' },
      'default'
    );
    assert.equal(invalidEmailResult.success, false);
    assert.equal(invalidEmailResult.action, 'rejected');
  });

  it('7. Multi-workspace isolation: members are isolated to the specified workspace ID', async () => {
    const firestore = new MockFirestore();
    const user = {
      uid: 'isolated-user-505',
      email: 'isolated@example.org',
    };

    await onboardMemberRecord(firestore as any, user, 'workspace-alpha');

    assert.ok(
      firestore.store.get('workspaces/workspace-alpha/members/isolated-user-505'),
      'Member must be in workspace-alpha'
    );
    assert.equal(
      firestore.store.get('workspaces/default/members/isolated-user-505'),
      undefined,
      'Member must NOT leak into default workspace'
    );
  });
});
