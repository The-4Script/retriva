const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
console.log(typeof getAuth, typeof getFirestore);
