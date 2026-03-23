import { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { isAllowedAdminEmail } from '../constants/adminEmails';

export function useAdminAuth() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [firestoreReady, setFirestoreReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirestoreReady(false);

      if (!user) {
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }

      if (!isAllowedAdminEmail(user.email)) {
        setAuthError('This account is not allowed to access the admin app.');
        await signOut(auth);
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }

      try {
        await user.getIdToken();
        setCurrentUser(user);
        setFirestoreReady(true);
        setAuthReady(true);
      } catch (error) {
        console.error('Admin app auth token initialization failed:', {
          email: user.email || 'unknown',
          code: error?.code || 'unknown',
          message: error?.message || 'Unknown auth token error',
        });
        setAuthError('Failed to initialize secure admin session.');
        setCurrentUser(null);
        await signOut(auth);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const isAuthenticatedAdmin = useMemo(() => {
    return Boolean(currentUser && isAllowedAdminEmail(currentUser.email));
  }, [currentUser]);

  const login = async (email, password) => {
    setAuthError('');

    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isAllowedAdminEmail(normalizedEmail)) {
      setAuthError('This account is not allowed to access the admin app.');
      return { ok: false };
    }

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      if (!isAllowedAdminEmail(credential.user.email)) {
        await signOut(auth);
        setAuthError('This account is not allowed to access the admin app.');
        return { ok: false };
      }

      return { ok: true };
    } catch (error) {
      console.error('Admin app login failed:', error);
      setAuthError('Invalid admin email or password.');
      return { ok: false };
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return {
    authError,
    authReady,
    currentUser,
    firestoreReady,
    isAuthenticatedAdmin,
    login,
    logout,
    setAuthError,
  };
}
