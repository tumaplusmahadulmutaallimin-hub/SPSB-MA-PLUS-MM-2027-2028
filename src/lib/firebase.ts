import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const ADMIN_AUTHORIZED_EMAIL = 'tumaplusmahadulmutaallimin@gmail.com';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Pass firebaseConfig.firestoreDatabaseId so Enterprise Firestore database is targeted
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: ADMIN_AUTHORIZED_EMAIL,
});

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTHORIZED_DOMAINS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
export const AISTUDIO_SHARED_APP_URL = 'https://ais-pre-jt62kfclsxtk3jywylemyc-716737754835.asia-southeast1.run.app';

export function isAuthorizedFirebaseAdmin(user: FirebaseUser | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.toLowerCase() === ADMIN_AUTHORIZED_EMAIL.toLowerCase();
}

export async function signInAdminWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = err?.code || '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (code === 'auth/unauthorized-domain' || String(err?.message || '').includes('auth/unauthorized-domain')) {
      const wrapped = new Error(
        `Domain "${hostname}" belum didaftarkan di Authorized domains Firebase Authentication (${FIREBASE_PROJECT_ID}).`
      ) as Error & { code?: string; unauthorizedDomain?: string };
      wrapped.code = 'auth/unauthorized-domain';
      wrapped.unauthorizedDomain = hostname;
      throw wrapped;
    }
    if (code === 'auth/popup-blocked') {
      const wrapped = new Error(
        'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini lalu coba kembali.'
      ) as Error & { code?: string };
      wrapped.code = code;
      throw wrapped;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      const wrapped = new Error('Jendela login Google ditutup sebelum proses selesai.') as Error & { code?: string };
      wrapped.code = code;
      throw wrapped;
    }
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function onFirebaseAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
