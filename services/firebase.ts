import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Safely load local config for AI Studio Preview without breaking builds if missing
let fallbackConfig: any = {};
try {
  const localConfigs = (import.meta as any).glob(['../firebase-applet-config.json', '/firebase-applet-config.json', './firebase-applet-config.json'], { eager: true });
  fallbackConfig = (localConfigs['../firebase-applet-config.json'] as any)?.default 
    || (localConfigs['/firebase-applet-config.json'] as any)?.default 
    || (localConfigs['./firebase-applet-config.json'] as any)?.default 
    || {};
} catch (err) {
  console.warn("Could not load local firebase config file:", err);
}

const envApiKey = (import.meta as any).env.VITE_FIREBASE_API_KEY;
const envProjectId = (import.meta as any).env.VITE_FIREBASE_PROJECT_ID;

const resolvedApiKey = envApiKey || fallbackConfig.apiKey || "AIzaSyFakeKeyForPreviewEnvironmentOnly123";
const resolvedProjectId = envProjectId || fallbackConfig.projectId || "retriva-preview";

const firebaseConfig = {
  apiKey: resolvedApiKey,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain || `${resolvedProjectId}.firebaseapp.com`,
  projectId: resolvedProjectId,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket || `${resolvedProjectId}.appspot.com`,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId || "123456789012",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || fallbackConfig.appId || "1:123456789012:web:abcdef123456",
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
  firestoreDatabaseId: fallbackConfig.firestoreDatabaseId || "(default)",
};

// Safety check to warn in console if keys are missing
export const isFirebaseConfigured = Boolean(envApiKey || fallbackConfig.apiKey);
if (!isFirebaseConfigured) {
  console.warn("RETRIVA NOTICE: Live Firebase API Key is not set in environment. Running with preview credentials.");
}

let app;
if (!firebase.apps.length) {
  try {
    app = firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
} else {
  app = firebase.apps[0];
}

export const auth = firebase.auth();
export let analytics: firebase.analytics.Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = firebase.analytics();
  } catch (e) {
    console.error("Firebase Analytics Initialization Error:", e);
  }
}

// Initialize the v9 db with the explicit databaseId, then monkey-patch 
// the v8 compat instance to use it. This avoids a massive codebase rewrite.
export const db = firebase.firestore();
try {
  if (app) {
    const dbV9 = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
    (db as any)._delegate = dbV9;
  }
} catch (e) {
  console.warn("Firestore custom database delegate init warning:", e);
}

export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const FieldValue = firebase.firestore.FieldValue;

export const generateUniqueStudentId = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  let isUnique = false;
  let newId = '';
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    attempts++;
    // Generate 6 digit random number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    newId = `${currentYear}-${randomNum}`;
    
    try {
        const snapshot = await db.collection('users').where('studentId', '==', newId).limit(1).get();
        if (snapshot.empty) {
            isUnique = true;
        }
    } catch (e) {
        console.error("Error checking student ID uniqueness", e);
        if (attempts > 5) break; 
    }
  }
  
  if (!isUnique) {
      newId = `${currentYear}-${Date.now().toString().slice(-6)}`; 
  }
  
  return newId;
};