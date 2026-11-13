import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'owner' | 'pharmacist' | 'senior_pharmacist' | 'cashier' | 'stock_manager' | 'accountant' | 'auditor';
  roleTitle: string;
  siteId: string;
  siteName: string;
  photoURL?: string;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: AppUserProfile | null;
  authReady: boolean;
  loading: boolean;
  loginWithGoogle: (roleKey?: string) => Promise<void>;
  loginAsRole: (roleKey: string, customName?: string) => Promise<void>;
  switchRole: (roleKey: string) => void;
  logout: () => Promise<void>;
}

const LOCAL_ROLE_KEY = 'pharmaflow_active_role_v2';

export const defaultProfiles: Record<string, AppUserProfile> = {
  super_admin: {
    uid: 'USR-ADMIN-01',
    email: 'admin@shekinah-pharma.cd',
    displayName: 'Architecte Système',
    role: 'super_admin',
    roleTitle: 'ARCHITECTE SYSTÈME & SUPER ADMIN',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)',
  },
  pharmacist: {
    uid: 'USR-PHARM-01',
    email: 'pharmacien.titulaire@shekinah-pharma.cd',
    displayName: 'Dr. Ilunga Mwamba',
    role: 'pharmacist',
    roleTitle: 'PHARMACIEN TITULAIRE',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)',
  },
  cashier: {
    uid: 'USR-CASH-01',
    email: 'caisse.jour@shekinah-pharma.cd',
    displayName: 'Aline Kabila',
    role: 'cashier',
    roleTitle: 'CAISSIER PRINCIPAL (COMPTOIR)',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)',
  },
  stock_manager: {
    uid: 'USR-STOCK-01',
    email: 'logistique@shekinah-pharma.cd',
    displayName: 'Marc Tshisekedi',
    role: 'stock_manager',
    roleTitle: 'GESTIONNAIRE DES STOCKS & DÉPÔTS',
    siteId: 'site1',
    siteName: 'Dépôt Central Lubumbashi',
  },
  accountant: {
    uid: 'USR-ACCT-01',
    email: 'finance@shekinah-pharma.cd',
    displayName: 'Claire Mutombo',
    role: 'accountant',
    roleTitle: 'COMPTABLE & AUDITEUR FINANCIER',
    siteId: 'site1',
    siteName: 'Direction Financière',
  },
};

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  currentUser: null,
  authReady: false,
  loading: false,
  loginWithGoogle: async () => {},
  loginAsRole: async () => {},
  switchRole: () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const buildProfile = (fbUser: FirebaseUser, roleKey: string, customName?: string): AppUserProfile => {
    const base = defaultProfiles[roleKey] || defaultProfiles.super_admin;
    return {
      ...base,
      uid: fbUser.uid,
      email: fbUser.email || base.email,
      displayName: customName || fbUser.displayName || base.displayName,
      photoURL: fbUser.photoURL || undefined,
    };
  };

  const syncUserDoc = async (profile: AppUserProfile) => {
    try {
      await setDoc(
        doc(db, 'users', profile.uid),
        {
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          role: profile.role,
          siteId: profile.siteId,
          lastLogin: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('User profile sync skipped:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        const savedRole = localStorage.getItem(LOCAL_ROLE_KEY) || 'super_admin';
        const profile = buildProfile(user, savedRole);
        setCurrentUser(profile);
      } else {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async (roleKey: string = 'super_admin') => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      localStorage.setItem(LOCAL_ROLE_KEY, roleKey);
      const profile = buildProfile(cred.user, roleKey);
      setCurrentUser(profile);
      await syncUserDoc(profile);
    } finally {
      setLoading(false);
    }
  };

  const loginAsRole = async (roleKey: string, customName?: string) => {
    setLoading(true);
    try {
      let fbUser = auth.currentUser;
      if (!fbUser) {
        const cred = await signInAnonymously(auth);
        fbUser = cred.user;
      }
      localStorage.setItem(LOCAL_ROLE_KEY, roleKey);
      const profile = buildProfile(fbUser, roleKey, customName);
      setCurrentUser(profile);
      await syncUserDoc(profile);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (roleKey: string) => {
    if (!firebaseUser) return;
    localStorage.setItem(LOCAL_ROLE_KEY, roleKey);
    const profile = buildProfile(firebaseUser, roleKey);
    setCurrentUser(profile);
    syncUserDoc(profile);
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_ROLE_KEY);
    setCurrentUser(null);
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        authReady,
        loading,
        loginWithGoogle,
        loginAsRole,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
