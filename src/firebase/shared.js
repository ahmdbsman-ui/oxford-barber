import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyA5WrRir2IbrthtzNSCTM-2s4afPsn8-Ic',
  authDomain: 'oxford-barber-ee024.firebaseapp.com',
  projectId: 'oxford-barber-ee024',
  storageBucket: 'oxford-barber-ee024.firebasestorage.app',
  messagingSenderId: '832264959048',
  appId: '1:832264959048:web:aefb3432a1ae329403947d',
};

export function getOrCreateFirebaseApp(name) {
  if (!name) {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return getApps().some((existingApp) => existingApp.name === name)
    ? getApp(name)
    : initializeApp(firebaseConfig, name);
}

export function createFirebaseServices() {
  const app = getOrCreateFirebaseApp();
  const phoneAuthApp = getOrCreateFirebaseApp('phoneAuth');

  return {
    app,
    phoneAuthApp,
    auth: getAuth(app),
    phoneAuth: getAuth(phoneAuthApp),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}
