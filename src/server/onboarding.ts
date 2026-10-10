import { getApp, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export interface MemberRecord {
  id: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName?: string;
  status: 'approved' | 'pending' | 'revoked';
  role: 'member' | 'admin';
  createdAt: FieldValue | Timestamp | string;
  updatedAt: FieldValue | Timestamp | string;
}

export interface OnboardingResult {
  success: boolean;
  action: 'created' | 'existing_preserved' | 'rejected';
  member?: MemberRecord;
  isApproved: boolean;
  message: string;
}

/**
 * Initializes and returns the Firebase Admin App.
 * Uses default credentials or applet configuration.
 */
export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

/**
 * Gets the Admin Firestore instance pointing to the specific workspace database.
 */
export function getAdminFirestore(customDb?: Firestore): Firestore {
  if (customDb) return customDb;
  const app = getAdminApp();
  const dbId = firebaseConfig.firestoreDatabaseId;
  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

/**
 * Trusted server-side idempotent onboarding logic.
 *
 * Requirements enforced:
 * 1. Only provisioned, authenticated users may onboard.
 * 2. Writes directly to /workspaces/default/members/{uid}.
 * 3. Populates required schema: id, userId, workspaceId ('default'), email, status ('approved'), role ('member'), createdAt, updatedAt.
 * 4. Idempotency: Repeated logins DO NOT overwrite existing status, role, or administrative decisions.
 * 5. Safety: NEVER automatically re-approves an existing membership whose status is 'pending', 'revoked', or non-approved.
 * 6. Protection: NEVER demotes an existing 'admin' to 'member'.
 */
export async function onboardMemberRecord(
  firestore: Firestore,
  user: { uid: string; email: string; displayName?: string },
  workspaceId: string = 'default'
): Promise<OnboardingResult> {
  const { uid, email, displayName } = user;

  if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
    return {
      success: false,
      action: 'rejected',
      isApproved: false,
      message: 'Invalid user ID. Authentication identity required.',
    };
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return {
      success: false,
      action: 'rejected',
      isApproved: false,
      message: 'Invalid user email.',
    };
  }

  const memberRef = firestore
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid);

  const docSnap = await memberRef.get();

  if (docSnap.exists) {
    const existing = docSnap.data() as MemberRecord;
    const isApproved = existing.status === 'approved';

    // Idempotent: preserve existing record and all administrative settings
    return {
      success: true,
      action: 'existing_preserved',
      member: existing,
      isApproved,
      message: isApproved
        ? `Member ${uid} is already registered and approved.`
        : `Member ${uid} exists with status "${existing.status}". Administrative status preserved.`,
    };
  }

  // First-time onboarding for this authenticated account
  const newMember: MemberRecord = {
    id: uid,
    userId: uid,
    workspaceId,
    email: email.trim().toLowerCase(),
    ...(displayName ? { displayName: displayName.trim().slice(0, 100) } : {}),
    status: 'approved',
    role: 'member',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await memberRef.set(newMember);

  return {
    success: true,
    action: 'created',
    member: newMember,
    isApproved: true,
    message: `Successfully provisioned approved membership for ${email}.`,
  };
}

/**
 * Server-side token validation and onboarding.
 * Validates the caller's Firebase Auth ID token and runs onboarding.
 */
export async function onboardWithIdToken(
  idToken: string,
  customDb?: Firestore,
  workspaceId: string = 'default'
): Promise<OnboardingResult> {
  if (!idToken || typeof idToken !== 'string') {
    return {
      success: false,
      action: 'rejected',
      isApproved: false,
      message: 'Missing or invalid authentication token.',
    };
  }

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);

    if (!decodedToken.uid || !decodedToken.email) {
      return {
        success: false,
        action: 'rejected',
        isApproved: false,
        message: 'Token does not contain required user identity.',
      };
    }

    const firestore = getAdminFirestore(customDb);
    return await onboardMemberRecord(
      firestore,
      {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
      },
      workspaceId
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      action: 'rejected',
      isApproved: false,
      message: `Authentication token verification failed: ${errMessage}`,
    };
  }
}
