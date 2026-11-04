/**
 * Standalone, isolated Firebase Client for read-only scripting.
 * Avoids any browser-specific APIs (e.g. browserLocalPersistence).
 */

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import type { Auth } from "firebase/auth";


export interface FirebaseCredentials {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export function getFirebaseCredentials(): FirebaseCredentials {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

export interface InitializedFirebaseClient {
  db: Firestore;
  auth: Auth;
  projectId: string;
}

export function initializeReadOnlyFirestore(): InitializedFirebaseClient {
  const credentials = getFirebaseCredentials();

  if (!credentials.projectId || !credentials.apiKey) {
    throw new Error(
      `Missing required Firebase configuration in environment.\n` +
      `Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_API_KEY are defined in .env.local`
    );
  }

  const appName = "ledgerflow-export-client";
  const existingApp = getApps().find((app) => app.name === appName);
  const app = existingApp || initializeApp(credentials, appName);
  const db = getFirestore(app);
  const auth = getAuth(app);

  return { db, auth, projectId: credentials.projectId };
}

export async function authenticateIfCredentialsProvided(
  auth: Auth,
  email?: string,
  password?: string
): Promise<string | null> {
  const userEmail = email || process.env.EXPORT_AUTH_EMAIL;
  const userPassword = password || process.env.EXPORT_AUTH_PASSWORD;

  if (userEmail && userPassword) {
    const userCredential = await signInWithEmailAndPassword(auth, userEmail, userPassword);
    return userCredential.user.email;
  }

  return null;
}

