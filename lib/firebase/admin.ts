import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let adminApp: App | null | undefined;
let adminMessaging: Messaging | null | undefined;

function credentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

export function firebaseAdminApp() {
  if (adminApp !== undefined) return adminApp;
  const values = credentials();
  if (!values) return (adminApp = null);
  adminApp = getApps().length
    ? getApp()
    : initializeApp({ credential: cert(values), projectId: values.projectId });
  return adminApp;
}

export function firebaseAdminMessaging() {
  if (adminMessaging !== undefined) return adminMessaging;
  const app = firebaseAdminApp();
  adminMessaging = app ? getMessaging(app) : null;
  return adminMessaging;
}
