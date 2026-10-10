import * as functions from 'firebase-functions/v1';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';

// Initialize Admin SDK
if (getApps().length === 0) {
  initializeApp();
}

// Target Workspace & Named Database ID
const WORKSPACE_ID = 'default';
const FIRESTORE_DATABASE_ID = 'ai-studio-deafcontactrecor-7feed59b-c85a-4db4-96e3-76e702d18fd6';

function getWorkspaceFirestore(): Firestore {
  return FIRESTORE_DATABASE_ID
    ? getFirestore(FIRESTORE_DATABASE_ID)
    : getFirestore();
}

/**
 * 1. Automatic Onboarding on Firebase Auth User Creation Trigger
 *
 * Triggered automatically when the administrator manually creates an account
 * in Firebase Console -> Authentication -> Users.
 *
 * Provisions an approved membership record under /workspaces/default/members/{uid}.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const db = getWorkspaceFirestore();
  const uid = user.uid;
  const email = (user.email || '').trim().toLowerCase();
  const displayName = user.displayName || email.split('@')[0] || 'Member';

  if (!uid || !email) {
    functions.logger.warn(`Skipping onboarding for user ${uid}: missing email.`);
    return;
  }

  const memberRef = db.collection('workspaces').doc(WORKSPACE_ID).collection('members').doc(uid);

  try {
    const existing = await memberRef.get();
    if (existing.exists) {
      functions.logger.info(`Member record for ${uid} already exists. Preserving existing record.`);
      return;
    }

    const newMember = {
      id: uid,
      userId: uid,
      workspaceId: WORKSPACE_ID,
      email,
      displayName: displayName.slice(0, 100),
      status: 'approved',
      role: 'member',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await memberRef.set(newMember);
    functions.logger.info(`Successfully onboarded and approved member ${uid} (${email}) for workspace ${WORKSPACE_ID}.`);
  } catch (error) {
    functions.logger.error(`Error during onboarding trigger for user ${uid}:`, error);
    throw error;
  }
});

/**
 * 2. Onboard Member Callable Function
 *
 * Can be called securely from the client upon successful email/password sign-in.
 * Validates the caller's Firebase Auth token automatically via context.auth.
 *
 * Idempotent:
 * - If document exists: returns current membership without overwriting status or role.
 * - Never re-approves a pending, revoked, or non-approved account.
 * - If document does not exist: creates approved member document.
 */
export const onboardMember = functions.https.onCall(async (_data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated with Firebase Authentication.'
    );
  }

  const uid = context.auth.uid;
  const email = (context.auth.token.email || '').trim().toLowerCase();
  const displayName = (context.auth.token.name || email.split('@')[0] || 'Member').trim();

  if (!email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Authenticated account must have a valid email address.'
    );
  }

  const db = getWorkspaceFirestore();
  const memberRef = db.collection('workspaces').doc(WORKSPACE_ID).collection('members').doc(uid);

  try {
    const existingSnap = await memberRef.get();

    if (existingSnap.exists) {
      const existingData = existingSnap.data() || {};
      const isApproved = existingData.status === 'approved';

      return {
        success: true,
        action: 'existing_preserved',
        status: existingData.status,
        role: existingData.role,
        isApproved,
        message: isApproved
          ? `Welcome back. Workspace access is approved.`
          : `Membership exists with status "${existingData.status}". Administrative status preserved.`,
      };
    }

    const newMember = {
      id: uid,
      userId: uid,
      workspaceId: WORKSPACE_ID,
      email,
      displayName: displayName.slice(0, 100),
      status: 'approved',
      role: 'member',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await memberRef.set(newMember);

    return {
      success: true,
      action: 'created',
      status: 'approved',
      role: 'member',
      isApproved: true,
      message: `Successfully onboarded and approved for workspace ${WORKSPACE_ID}.`,
    };
  } catch (error) {
    functions.logger.error(`Failed to onboard member ${uid}:`, error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to complete member onboarding in workspace.'
    );
  }
});
