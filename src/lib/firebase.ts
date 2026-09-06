import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Check if config is in localStorage as client override, or we can fetch from backend
let localConfigStr = localStorage.getItem('minesec_firebase_config');
let currentConfig: FirebaseConfig | null = null;

if (localConfigStr) {
  try {
    currentConfig = JSON.parse(localConfigStr);
  } catch (e) {
    console.error('Failed to parse local firebase config', e);
  }
}

// Try to initialize
let app;
let db: any = null;
let auth: any = null;
let isEnabled = false;

export function initializeFirebase(config: FirebaseConfig) {
  try {
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp(config);
    }
    db = getFirestore(app);
    auth = getAuth(app);
    isEnabled = true;
    currentConfig = config;
    localStorage.setItem('minesec_firebase_config', JSON.stringify(config));
    console.log('Firebase successfully initialized with project:', config.projectId);
    return { success: true, db, auth };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return { success: false, error };
  }
}

// Auto-initialize if config is available
if (currentConfig && currentConfig.apiKey) {
  initializeFirebase(currentConfig);
}

export { db, auth, isEnabled, currentConfig };

// Utility to save config to server
export async function saveConfigToServer(config: FirebaseConfig) {
  try {
    const response = await fetch('/api/firebase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (response.ok) {
      initializeFirebase(config);
      return true;
    }
  } catch (error) {
    console.error('Error saving config to server', error);
  }
  return false;
}

// Utility to load config from server
export async function loadConfigFromServer(): Promise<FirebaseConfig | null> {
  try {
    const response = await fetch('/api/firebase-config');
    if (response.ok) {
      const data = await response.json();
      if (data && data.apiKey) {
        initializeFirebase(data);
        return data;
      }
    }
  } catch (error) {
    console.error('Error loading config from server', error);
  }
  return null;
}
