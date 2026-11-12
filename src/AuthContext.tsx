import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'owner' | 'pharmacist' | 'senior_pharmacist' | 'cashier' | 'stock_manager' | 'accountant' | 'auditor';
  roleTitle: string;
  siteId: string;
  siteName: string;
  isDemoSession?: boolean;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: AppUserProfile | null;
  loading: boolean;
  loginAsRole: (roleKey: string, customName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const LOCAL_STORAGE_SESSION_KEY = 'pharmaflow_active_session_v1';

const defaultProfiles: Record<string, AppUserProfile> = {
  super_admin: {
    uid: 'USR-ADMIN-01',
    email: 'admin@pharmaflow.cd',
    displayName: 'Architecte Système (Créateur)',
    role: 'super_admin',
    roleTitle: 'ARCHITECTE SYSTÈME & SUPER ADMIN',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)'
  },
  pharmacist: {
    uid: 'USR-PHARM-01',
    email: 'pharmacien.titulaire@pharmaflow.cd',
    displayName: 'Dr. Ilunga Mwamba',
    role: 'pharmacist',
    roleTitle: 'PHARMACIEN TITULAIRE',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)'
  },
  cashier: {
    uid: 'USR-CASH-01',
    email: 'caisse.jour@pharmaflow.cd',
    displayName: 'Aline Kabila',
    role: 'cashier',
    roleTitle: 'CAISSIER PRINCIPAL (COMPTOIR)',
    siteId: 'site1',
    siteName: 'Pharmacie Centrale (Kinshasa)'
  },
  stock_manager: {
    uid: 'USR-STOCK-01',
    email: 'logistique@pharmaflow.cd',
    displayName: 'Marc Tshisekedi',
    role: 'stock_manager',
    roleTitle: 'GESTIONNAIRE DES STOCKS & DÉPÔTS',
    siteId: 'site1',
    siteName: 'Dépôt Central Lubumbashi'
  },
  accountant: {
    uid: 'USR-ACCT-01',
    email: 'finance@pharmaflow.cd',
    displayName: 'Claire Mutombo',
    role: 'accountant',
    roleTitle: 'COMPTABLE & AUDITEUR FINANCIER',
    siteId: 'site1',
    siteName: 'Direction Financière'
  }
};

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  currentUser: null,
  loading: true,
  loginAsRole: async () => {},
  logout: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      return saved ? JSON.parse(saved) : defaultProfiles.super_admin;
    } catch {
      return defaultProfiles.super_admin;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return unsubscribe;
  }, []);

  const loginAsRole = async (roleKey: string, customName?: string) => {
    setLoading(true);
    try {
      // 1. Silent anonymous authentication to satisfy Firestore security rules
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn('Anonymous auth fallback:', e);
        }
      }

      const base = defaultProfiles[roleKey] || defaultProfiles.super_admin;
      const profile: AppUserProfile = {
        ...base,
        displayName: customName || base.displayName,
        isDemoSession: true
      };

      setCurrentUser(profile);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));

      // Try persisting role info in Firestore users collection if permissions allow
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            email: profile.email,
            displayName: profile.displayName,
            role: profile.role,
            siteId: profile.siteId,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch {
          // Silent catch for sandboxed environments
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setCurrentUser(null);
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, currentUser, loading, loginAsRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
