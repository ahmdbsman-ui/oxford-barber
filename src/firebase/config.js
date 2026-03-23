import { createFirebaseServices, firebaseConfig } from './shared';

const { app, phoneAuthApp, auth, phoneAuth, db, storage } =
  createFirebaseServices();

export { app, auth, db, firebaseConfig, phoneAuth, phoneAuthApp, storage };
