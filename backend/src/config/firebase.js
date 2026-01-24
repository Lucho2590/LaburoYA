const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
  if (admin.apps.length === 0) {
    // Clean up the private key - handle different formats
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

    // Remove surrounding quotes if present
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }

    // Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
  }

  db = admin.firestore();
  console.log('Firebase Admin initialized');
}

function getDb() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
}

function getAuth() {
  return admin.auth();
}

module.exports = {
  initializeFirebase,
  getDb,
  getAuth
};
