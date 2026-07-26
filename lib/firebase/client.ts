"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging, type MessagePayload } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let appPromise: Promise<FirebaseApp | null> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function hasClientConfig() {
  return Object.values(firebaseConfig).every(Boolean) && Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

export async function pushCapability() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || !hasClientConfig()) {
    return { supported: false as const, reason: "unsupported" as const };
  }
  const supported = await isSupported().catch(() => false);
  return supported
    ? { supported: true as const, permission: Notification.permission }
    : { supported: false as const, reason: "unsupported" as const };
}

async function firebaseApp() {
  if (!appPromise) {
    appPromise = Promise.resolve(hasClientConfig() ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null);
  }
  return appPromise;
}

export async function browserMessaging() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const capability = await pushCapability();
      const app = capability.supported ? await firebaseApp() : null;
      return app ? getMessaging(app) : null;
    })();
  }
  return messagingPromise;
}

export async function registerForPush() {
  const messaging = await browserMessaging();
  if (!messaging) throw new Error("PUSH_UNSUPPORTED");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("TOKEN_UNAVAILABLE");
  return token;
}

export async function subscribeForegroundMessages(handler: (payload: MessagePayload) => void) {
  const messaging = await browserMessaging();
  return messaging ? onMessage(messaging, handler) : () => undefined;
}
