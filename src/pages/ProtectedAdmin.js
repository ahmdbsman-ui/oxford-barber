import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase/config';

export default function ProtectedAdmin({ children }) {
  const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const authTime = Number(sessionStorage.getItem('oxfordAdminAuthTime'));
  const isExpired = !authTime || Date.now() - authTime > SESSION_DURATION_MS;

  if (!authReady) {
    return null;
  }

  if (!currentUser || isExpired) {
    sessionStorage.removeItem('oxfordAdminAuth');
    sessionStorage.removeItem('oxfordAdminAuthTime');
    return <Navigate to="/" replace />;
  }

  return children;
}
