import fs from 'fs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = firebase.initializeApp(firebaseConfig);

const dbV9 = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const dbCompat = firebase.firestore();
dbCompat._delegate = dbV9;

dbCompat.collection('test').get().then(snap => {
  console.log("Success! Docs:", snap.size);
  process.exit(0);
}).catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
