#!/usr/bin/env node

/**
 * Script to promote a user to superuser role
 *
 * Usage:
 *   node scripts/create-superuser.js <uid>
 *   node scripts/create-superuser.js <email>
 *
 * Examples:
 *   node scripts/create-superuser.js abc123def456
 *   node scripts/create-superuser.js admin@example.com
 */

require('dotenv').config();
const { initializeFirebase, getDb, getAuth } = require('../src/config/firebase');

async function createSuperuser(identifier) {
  if (!identifier) {
    console.error('Error: Please provide a user UID or email');
    console.log('\nUsage:');
    console.log('  node scripts/create-superuser.js <uid>');
    console.log('  node scripts/create-superuser.js <email>');
    process.exit(1);
  }

  try {
    // Initialize Firebase
    initializeFirebase();
    const db = getDb();
    const auth = getAuth();

    let uid = identifier;

    // Check if identifier is an email
    if (identifier.includes('@')) {
      console.log(`Looking up user by email: ${identifier}`);
      try {
        const userRecord = await auth.getUserByEmail(identifier);
        uid = userRecord.uid;
        console.log(`Found user with UID: ${uid}`);
      } catch (error) {
        console.error(`Error: User with email "${identifier}" not found in Firebase Auth`);
        process.exit(1);
      }
    }

    // Check if user exists in Firestore
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User document not found. Creating new user document with superuser role...`);
      await userRef.set({
        uid,
        role: 'superuser',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`\nSuperuser created successfully!`);
    } else {
      const userData = userDoc.data();
      if (userData.role === 'superuser') {
        console.log(`User is already a superuser.`);
        process.exit(0);
      }

      console.log(`Current role: ${userData.role}`);
      console.log(`Updating role to superuser...`);

      await userRef.update({
        role: 'superuser',
        updatedAt: new Date()
      });

      console.log(`\nUser promoted to superuser successfully!`);
    }

    console.log(`\nUser details:`);
    console.log(`  UID: ${uid}`);
    console.log(`  Role: superuser`);
    console.log(`\nYou can now access the admin panel at /sudo`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
const identifier = process.argv[2];
createSuperuser(identifier);
