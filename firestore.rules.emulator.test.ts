/**
 * Real Firestore Security Rules Test Suite - Phase 3E
 * Executed against the real Firebase Cloud Firestore Emulator using @firebase/rules-unit-testing.
 *
 * Verifies:
 * 1. Guest Read-Only Access (Workspace metadata, People, Visits, Territories)
 * 2. Guest Write Denials (Cannot create, update, or delete shared data)
 * 3. Guest Privacy Protection (Cannot read membership records, private users, or unmapped paths)
 * 4. Authenticated Unapproved Access (Read-only shared data, can read own membership doc only, cannot write)
 * 5. Approved Member Permissions (Full read, schema-validated writes, visit deletion allowed, people/territory deletion blocked)
 * 6. System Invariants (Schema validation, server timestamps, immutable fields, relational integrity, catch-all deny)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-deaf-contact-record';

describe('Real Firebase Emulator Rules Test Suite (Phase 3E)', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });

    // Seed test data with security rules bypassed
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const now = Timestamp.now();

      // Seed workspace root
      await setDoc(doc(db, 'workspaces', 'default'), {
        id: 'default',
        name: 'Default Workspace',
        createdAt: now,
        updatedAt: now,
      });

      // Seed approved member
      await setDoc(doc(db, 'workspaces', 'default', 'members', 'user_approved'), {
        id: 'user_approved',
        workspaceId: 'default',
        userId: 'user_approved',
        email: 'approved@example.com',
        status: 'approved',
        role: 'member',
        createdAt: now,
        updatedAt: now,
      });

      // Seed pending member
      await setDoc(doc(db, 'workspaces', 'default', 'members', 'user_pending'), {
        id: 'user_pending',
        workspaceId: 'default',
        userId: 'user_pending',
        email: 'pending@example.com',
        status: 'pending',
        role: 'member',
        createdAt: now,
        updatedAt: now,
      });

      // Seed revoked member
      await setDoc(doc(db, 'workspaces', 'default', 'members', 'user_revoked'), {
        id: 'user_revoked',
        workspaceId: 'default',
        userId: 'user_revoked',
        email: 'revoked@example.com',
        status: 'revoked',
        role: 'member',
        createdAt: now,
        updatedAt: now,
      });

      // Seed territory
      await setDoc(doc(db, 'workspaces', 'default', 'territories', 'terr_1'), {
        id: 'terr_1',
        workspaceId: 'default',
        name: 'Territory 1',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        createdAt: now,
        updatedAt: now,
      });

      // Seed person
      await setDoc(doc(db, 'workspaces', 'default', 'people', 'person_seed'), {
        id: 'person_seed',
        workspaceId: 'default',
        name: 'Seed Contact',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        createdAt: now,
        updatedAt: now,
      });

      // Seed visit
      await setDoc(doc(db, 'workspaces', 'default', 'visits', 'visit_seed'), {
        id: 'visit_seed',
        workspaceId: 'default',
        personId: 'person_seed',
        visitedAt: '2026-10-09T10:00:00Z',
        remarks: 'Initial visit',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        createdAt: now,
        updatedAt: now,
      });

      // Seed private user doc
      await setDoc(doc(db, 'users', 'user_approved'), {
        id: 'user_approved',
        email: 'approved@example.com',
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // ==========================================
  // 1. Unauthenticated Guests: Read-Only Access
  // ==========================================
  it('1. Guest can get workspace metadata', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthed, 'workspaces', 'default')));
  });

  it('2. Guest can read and list shared people', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthed, 'workspaces', 'default', 'people', 'person_seed')));
    await assertSucceeds(getDocs(collection(unauthed, 'workspaces', 'default', 'people')));
  });

  it('3. Guest can read and list shared visits', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthed, 'workspaces', 'default', 'visits', 'visit_seed')));
    await assertSucceeds(getDocs(collection(unauthed, 'workspaces', 'default', 'visits')));
  });

  it('4. Guest can read and list shared territories', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthed, 'workspaces', 'default', 'territories', 'terr_1')));
    await assertSucceeds(getDocs(collection(unauthed, 'workspaces', 'default', 'territories')));
  });

  // ==========================================
  // 2. Unauthenticated Guests: Write Denials & Privacy
  // ==========================================
  it('5. Guest cannot create shared person', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(unauthed, 'workspaces', 'default', 'people', 'guest_person'), {
        id: 'guest_person',
        workspaceId: 'default',
        createdBy: 'guest',
        lastUpdatedBy: 'guest',
        name: 'Guest Contact',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('6. Guest cannot update shared person', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(unauthed, 'workspaces', 'default', 'people', 'person_seed'), {
        name: 'Defaced Name',
      })
    );
  });

  it('7. Guest cannot delete shared records (people, territories, visits)', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(deleteDoc(doc(unauthed, 'workspaces', 'default', 'people', 'person_seed')));
    await assertFails(deleteDoc(doc(unauthed, 'workspaces', 'default', 'territories', 'terr_1')));
    await assertFails(deleteDoc(doc(unauthed, 'workspaces', 'default', 'visits', 'visit_seed')));
  });

  it('8. Guest cannot read membership documents or membership lists', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthed, 'workspaces', 'default', 'members', 'user_approved')));
    await assertFails(getDocs(collection(unauthed, 'workspaces', 'default', 'members')));
  });

  it('9. Guest cannot read private user accounts (/users/{userId})', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthed, 'users', 'user_approved')));
  });

  it('10. Guest cannot mutate workspace metadata', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(unauthed, 'workspaces', 'default'), {
        name: 'Guest Mutated Workspace',
      })
    );
  });

  // ==========================================
  // 3. Authenticated Unapproved Users
  // ==========================================
  it('11. Unapproved/pending user has read-only access to shared records', async () => {
    const db = testEnv.authenticatedContext('user_pending').firestore();
    await assertSucceeds(getDocs(collection(db, 'workspaces', 'default', 'people')));
    await assertSucceeds(getDocs(collection(db, 'workspaces', 'default', 'visits')));
    await assertSucceeds(getDocs(collection(db, 'workspaces', 'default', 'territories')));
  });

  it('12. Unapproved/pending user CANNOT write shared records', async () => {
    const db = testEnv.authenticatedContext('user_pending').firestore();
    await assertFails(
      setDoc(doc(db, 'workspaces', 'default', 'people', 'pending_person'), {
        id: 'pending_person',
        workspaceId: 'default',
        createdBy: 'user_pending',
        lastUpdatedBy: 'user_pending',
        name: 'Pending Attempt',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(db, 'workspaces', 'default', 'visits', 'visit_seed')));
  });

  it('13. Unapproved user CAN read their own membership doc, but CANNOT read others or list', async () => {
    const db = testEnv.authenticatedContext('user_pending').firestore();
    await assertSucceeds(getDoc(doc(db, 'workspaces', 'default', 'members', 'user_pending')));
    await assertFails(getDoc(doc(db, 'workspaces', 'default', 'members', 'user_approved')));
    await assertFails(getDocs(collection(db, 'workspaces', 'default', 'members')));
  });

  it('14. Unapproved user cannot self-approve or mutate membership documents', async () => {
    const db = testEnv.authenticatedContext('user_pending').firestore();
    await assertFails(
      updateDoc(doc(db, 'workspaces', 'default', 'members', 'user_pending'), {
        status: 'approved',
      })
    );
  });

  // ==========================================
  // 4. Authenticated Approved Members
  // ==========================================
  it('15. Approved member can read membership documents and list members', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertSucceeds(getDoc(doc(db, 'workspaces', 'default', 'members', 'user_pending')));
    await assertSucceeds(getDocs(collection(db, 'workspaces', 'default', 'members')));
  });

  it('16. Approved member cannot mutate membership documents or workspace metadata', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(
      updateDoc(doc(db, 'workspaces', 'default', 'members', 'user_pending'), {
        status: 'approved',
      })
    );
    await assertFails(
      updateDoc(doc(db, 'workspaces', 'default'), {
        name: 'Approved Member Altering Workspace Name',
      })
    );
  });

  it('17. Approved member can create valid Person with serverTimestamp', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'workspaces', 'default', 'people', 'person_valid'), {
        id: 'person_valid',
        workspaceId: 'default',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        name: 'John Doe',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('18. Person creation with forged createdBy is rejected', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(
      setDoc(doc(db, 'workspaces', 'default', 'people', 'person_forged'), {
        id: 'person_forged',
        workspaceId: 'default',
        createdBy: 'victim_user',
        lastUpdatedBy: 'user_approved',
        name: 'Imposter Contact',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('19. Person creation with non-existent territoryId is rejected', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(
      setDoc(doc(db, 'workspaces', 'default', 'people', 'person_bad_terr'), {
        id: 'person_bad_terr',
        workspaceId: 'default',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        territoryId: 'non_existent_territory_123',
        name: 'Bad Territory Contact',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('20. Client deletion of people is strictly blocked for approved members', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(deleteDoc(doc(db, 'workspaces', 'default', 'people', 'person_seed')));
  });

  it('21. Client deletion of territories is strictly blocked for approved members', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(deleteDoc(doc(db, 'workspaces', 'default', 'territories', 'terr_1')));
  });

  it('22. Visit creation referencing existing person succeeds', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'workspaces', 'default', 'visits', 'visit_good'), {
        id: 'visit_good',
        workspaceId: 'default',
        personId: 'person_seed',
        visitedAt: '2026-10-09T11:00:00Z',
        remarks: 'Valid interaction logged',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('23. Visit creation referencing non-existent person is rejected', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertFails(
      setDoc(doc(db, 'workspaces', 'default', 'visits', 'visit_orphan'), {
        id: 'visit_orphan',
        workspaceId: 'default',
        personId: 'ghost_person_999',
        visitedAt: '2026-10-09T11:00:00Z',
        remarks: 'Orphan visit attempt',
        createdBy: 'user_approved',
        lastUpdatedBy: 'user_approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('24. Visit deletion by approved member succeeds', async () => {
    const db = testEnv.authenticatedContext('user_approved').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'workspaces', 'default', 'visits', 'visit_seed')));
  });

  it('25. Catch-all deny blocks unmapped arbitrary collections', async () => {
    const unauthed = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(unauthed, 'random_unmapped_collection')));
  });
});
