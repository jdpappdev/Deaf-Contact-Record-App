import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Person, Visit, Territory } from '../types';

// 1. Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// 2. Validate Connection to Firestore on boot as mandated
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Connected to server (even if doc is empty or denied)
    return true;
  }
}
testConnection();

// 3. Error Handling Hierarchy mandated by security guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 4. Authentication Helpers
export async function signInWithEmailAccount(email: string, password: string): Promise<FirebaseUser> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    // Sync profile metadata if possible
    ensureUserProfile(cred.user).catch((err) => console.warn('User profile sync skipped:', err));
    return cred.user;
  } catch (error) {
    console.error('Failed to sign in with email:', error);
    throw error;
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password. Please verify your credentials.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact an administrator.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      default:
        return 'Authentication failed. Please verify your credentials.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Authentication request failed.';
}

export async function signOutAccount(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Failed to sign out:', error);
    throw error;
  }
}

// Ensure user document exists under /users/{userId}
async function ensureUserProfile(user: FirebaseUser): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          displayName: user.displayName || '',
          photoURL: user.photoURL || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    // Graceful fallback for profile metadata write
    console.warn('Could not sync user profile metadata to Firestore:', err);
  }
}

// 5. Cloud Sync Helpers for Deaf Contact Record
// People Cloud Operations
export async function syncPersonToFirestore(userId: string, person: Person): Promise<void> {
  const docPath = `users/${userId}/people/${person.id}`;
  try {
    const personRef = doc(db, 'users', userId, 'people', person.id);
    const existingSnap = await getDoc(personRef);

    const payload = {
      id: person.id,
      ownerId: userId,
      name: person.name.slice(0, 100),
      photoRef: person.photoRef || null,
      latitude: person.latitude ?? null,
      longitude: person.longitude ?? null,
      territoryId: person.territoryId || null,
      messengerUrl: person.messengerUrl || null,
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(personRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deletePersonFromFirestore(userId: string, personId: string): Promise<void> {
  const docPath = `users/${userId}/people/${personId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'people', personId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// Visit Cloud Operations
export async function syncVisitToFirestore(userId: string, visit: Visit): Promise<void> {
  const docPath = `users/${userId}/visits/${visit.id}`;
  try {
    const visitRef = doc(db, 'users', userId, 'visits', visit.id);
    const existingSnap = await getDoc(visitRef);

    const payload = {
      id: visit.id,
      ownerId: userId,
      personId: visit.personId,
      visitedAt: visit.visitedAt,
      remarks: visit.remarks.slice(0, 2000),
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(visitRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteVisitFromFirestore(userId: string, visitId: string): Promise<void> {
  const docPath = `users/${userId}/visits/${visitId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'visits', visitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// Territory Cloud Operations
export async function syncTerritoryToFirestore(userId: string, territory: Territory): Promise<void> {
  const docPath = `users/${userId}/territories/${territory.id}`;
  try {
    const territoryRef = doc(db, 'users', userId, 'territories', territory.id);
    const existingSnap = await getDoc(territoryRef);

    const payload = {
      id: territory.id,
      ownerId: userId,
      name: territory.name.slice(0, 100),
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(territoryRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteTerritoryFromFirestore(userId: string, territoryId: string): Promise<void> {
  const docPath = `users/${userId}/territories/${territoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'territories', territoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// 6. Full Bidirectional Cloud Fetch
export async function fetchAllCloudData(userId: string): Promise<{
  people: Person[];
  visits: Visit[];
  territories: Territory[];
}> {
  try {
    const [peopleSnap, visitsSnap, territoriesSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'people')),
      getDocs(collection(db, 'users', userId, 'visits')),
      getDocs(collection(db, 'users', userId, 'territories')),
    ]);

    const people: Person[] = [];
    peopleSnap.forEach((d) => {
      const data = d.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString();
      people.push({
        id: data.id || d.id,
        name: data.name || '',
        photoRef: data.photoRef || null,
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        territoryId: data.territoryId || null,
        messengerUrl: data.messengerUrl || null,
        createdAt,
        updatedAt,
      });
    });

    const visits: Visit[] = [];
    visitsSnap.forEach((d) => {
      const data = d.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString();
      visits.push({
        id: data.id || d.id,
        personId: data.personId || '',
        visitedAt: data.visitedAt || new Date().toISOString(),
        remarks: data.remarks || '',
        createdAt,
        updatedAt,
      });
    });

    const territories: Territory[] = [];
    territoriesSnap.forEach((d) => {
      const data = d.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString();
      territories.push({
        id: data.id || d.id,
        name: data.name || '',
        createdAt,
        updatedAt,
      });
    });

    return { people, visits, territories };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  }
}
