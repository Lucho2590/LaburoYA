const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
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
