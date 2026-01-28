'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  Auth,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { api } from '@/services/api';
import { UserData, UserRole, AppRole, WorkerProfile, EmployerProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  setSecondaryRole: (role: AppRole) => Promise<void>;
  refreshUserData: () => Promise<void>;
  // Helper to get the effective app role (for superusers returns secondaryRole)
  getEffectiveAppRole: () => AppRole | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async () => {
    if (!user) {
      setUserData(null);
      return;
    }

    try {
      const data = await api.getCurrentUser();
      setUserData({
        uid: user.uid,
        email: user.email,
        role: data.user?.role as UserRole | undefined,
        secondaryRole: data.user?.secondaryRole as AppRole | undefined,
        profile: data.profile as WorkerProfile | EmployerProfile | undefined,
      });
    } catch {
      // User not registered in backend yet
      setUserData({
        uid: user.uid,
        email: user.email,
      });
    }
  };

  useEffect(() => {
    // If Firebase auth is not configured, stop loading
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth as Auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const data = await api.getCurrentUser();
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: data.user?.role as UserRole | undefined,
            secondaryRole: data.user?.secondaryRole as AppRole | undefined,
            profile: data.profile as WorkerProfile | EmployerProfile | undefined,
          });
        } catch {
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await signInWithEmailAndPassword(auth as Auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await createUserWithEmailAndPassword(auth as Auth, email, password);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth as Auth, provider);
  };

  const signInWithFacebook = async () => {
    if (!auth) throw new Error('Firebase not configured');
    const provider = new FacebookAuthProvider();
    await signInWithPopup(auth as Auth, provider);
  };

  const signOut = async () => {
    if (!auth) throw new Error('Firebase not configured');
    await firebaseSignOut(auth as Auth);
    setUserData(null);
  };

  const setRole = async (role: UserRole) => {
    await api.registerUser(role);
    await refreshUserData();
  };

  const setSecondaryRole = async (role: AppRole) => {
    await api.setSecondaryRole(role);
    await refreshUserData();
  };

  const getEffectiveAppRole = (): AppRole | undefined => {
    if (!userData) return undefined;
    if (userData.role === 'superuser') {
      return userData.secondaryRole;
    }
    return userData.role as AppRole | undefined;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        setRole,
        setSecondaryRole,
        refreshUserData,
        getEffectiveAppRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
