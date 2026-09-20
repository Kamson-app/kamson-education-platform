import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ─────────────────────────────────────────────
// Initialisation Firebase
// ─────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────
// Firestore
// ─────────────────────────────────────────────
//
// Le mode Long Polling permet de contourner
// certains problèmes de connexion WebChannel,
// notamment avec certains réseaux, proxies,
// antivirus ou pare-feu.
//
// ─────────────────────────────────────────────

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// ─────────────────────────────────────────────
// Firebase Authentication
// ─────────────────────────────────────────────

export const auth = getAuth(app);

// Firebase est correctement initialisé
export const isFirebaseReady = true;