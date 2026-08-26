import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';
import { getFirestore } from 'firebase/firestore';

// Safely load local config for AI Studio Preview without breaking Vercel builds if missing
const localConfigs = import.meta.glob('../firebase-applet-config.json', { eager: true });
const fallbackConfig = (localConfigs['../firebase-applet-config.json'] as any)?.default || {};

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
  firestoreDatabaseId: "(default)",
};

// Safety check to warn in console if keys are missing
if (!firebaseConfig.apiKey) {
  console.error("RETRIVA CRITICAL ERROR: Firebase API Key is missing. Please add VITE_FIREBASE_API_KEY to your environment variables.");
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
const dbV9 = getFirestore(app, firebaseConfig.firestoreDatabaseId);
(db as any)._delegate = dbV9;

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