import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA5WrRir2IbrthtzNSCTM-2s4afPsn8-Ic',
  authDomain: 'oxford-barber-ee024.firebaseapp.com',
  projectId: 'oxford-barber-ee024',
  storageBucket: 'oxford-barber-ee024.firebasestorage.app',
  messagingSenderId: '832264959048',
  appId: '1:832264959048:web:aefb3432a1ae329403947d',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, firebaseConfig, storage };
