import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, testFirestoreConnection } from '../firebase';
import {
  CHANCELLOR_EMAIL,
  QUOTA_PRICING_URL,
  QUOTA_UPGRADE_URL,
  parseFirestoreError,
} from '../services/firebaseService';

export interface FirebaseContextValue {
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  isVerifiedUser: boolean;
  isFirebaseAdmin: boolean;
  firestoreError: Error | null;
  firestoreErrorMessage: string | null;
  isQuotaExceeded: boolean;
  quotaUpgradeUrl: string;
  quotaPricingUrl: string;
  reportFirestoreError: (err: unknown) => void;
  clearFirestoreError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const reportFirestoreError = useCallback((err: unknown) => {
    const normalized = err instanceof Error ? err : new Error(String(err));
    setFirestoreError(normalized);
  }, []);

  const clearFirestoreError = useCallback(() => {
    setFirestoreError(null);
  }, []);

  const isVerifiedUser = Boolean(firebaseUser && firebaseUser.emailVerified);
  const isFirebaseAdmin = Boolean(
    isVerifiedUser && firebaseUser?.email?.toLowerCase() === CHANCELLOR_EMAIL
  );

  const parsed = firestoreError ? parseFirestoreError(firestoreError) : null;

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        isAuthReady,
        isVerifiedUser,
        isFirebaseAdmin,
        firestoreError,
        firestoreErrorMessage: parsed ? parsed.userMessage : null,
        isQuotaExceeded: parsed ? parsed.isQuotaExceeded : false,
        quotaUpgradeUrl: QUOTA_UPGRADE_URL,
        quotaPricingUrl: QUOTA_PRICING_URL,
        reportFirestoreError,
        clearFirestoreError,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside <FirebaseProvider>.');
  }
  return ctx;
}
