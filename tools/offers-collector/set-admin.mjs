#!/usr/bin/env node
// Gives one account the `admin` custom claim, so it can open "Manage offers" in the app and
// publish offers (firestore.rules checks the same claim).
//
//   FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" node set-admin.mjs you@example.com
//   node set-admin.mjs you@example.com --remove
//
// The user must sign out and back in (or wait up to an hour) for the change to reach the app.
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
const remove = process.argv.includes('--remove');
if (!email || email.startsWith('--')) {
  console.error('Usage: node set-admin.mjs <email> [--remove]');
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });

const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = Object.assign({}, user.customClaims);
if (remove) delete claims.admin; else claims.admin = true;
await auth.setCustomUserClaims(user.uid, claims);
console.log(`${remove ? 'Removed admin from' : 'Granted admin to'} ${email} (${user.uid}). Sign out and back in to apply.`);
