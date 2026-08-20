import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Safety check to warn in console if keys are missing
if (!firebaseConfig.apiKey) {
  console.error("RETRIVA CRITICAL ERROR: Firebase API Key is missing.");
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