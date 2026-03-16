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
  sendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  Auth,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { api } from '@/services/api';
import { IUserData, EUserRole, EAppRole, IWorkerProfile, IEmployerProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  userData: IUserData | null;
  loading: boolean;
  authReady: boolean; // Token listo para hacer llamadas API
  signIn: (email: string, password: string) => Promise<{ emailVerified: boolean }>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: EUserRole) => Promise<void>;
  setSecondaryRole: (role: EAppRole) => Promise<void>;
  refreshUserData: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>; // Returns emailVerified status
  sendPasswordResetEmail: (email: string) => Promise<void>;
  // Helper to get the effective app role (for superusers returns secondaryRole)
  getEffectiveAppRole: () => EAppRole | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<IUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

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
        role: data.user?.role as EUserRole | undefined,
        secondaryRole: data.user?.secondaryRole as EAppRole | undefined,
        profile: data.profile as IWorkerProfile | IEmployerProfile | undefined,
        firstName: data.user?.firstName,
        lastName: data.user?.lastName,
        age: data.user?.age,
        nickname: data.user?.nickname,
        onboardingCompleted: data.user?.onboardingCompleted,
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
      setAuthReady(false); // Reset mientras procesamos
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Esperar a que el token esté disponible antes de llamar a la API
          await firebaseUser.getIdToken();
          const data = await api.getCurrentUser();
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: data.user?.role as EUserRole | undefined,
            secondaryRole: data.user?.secondaryRole as EAppRole | undefined,
            profile: data.profile as IWorkerProfile | IEmployerProfile | undefined,
            firstName: data.user?.firstName,
            lastName: data.user?.lastName,
            age: data.user?.age,
            nickname: data.user?.nickname,
            onboardingCompleted: data.user?.onboardingCompleted,
          });

          // Track login location (IP-based, silent)
          api.trackLogin().catch(() => {
            // Silently ignore - location tracking is not critical
          });
        } catch {
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
        }
        setAuthReady(true); // Token listo, se pueden hacer llamadas API
      } else {
        setUserData(null);
        setAuthReady(true); // No hay usuario, pero auth está lista
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ emailVerified: boolean }> => {
    if (!auth) throw new Error('Firebase not configured');
    const result = await signInWithEmailAndPassword(auth as Auth, email, password);
    return { emailVerified: result.user.emailVerified };
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    const result = await createUserWithEmailAndPassword(auth as Auth, email, password);
    // Send verification email
    await sendEmailVerification(result.user);
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

  const setRole = async (role: EUserRole) => {
    await api.registerUser(role);
    await refreshUserData();
  };

  const setSecondaryRole = async (role: EAppRole) => {
    await api.setSecondaryRole(role);
    await refreshUserData();
  };

  const resendVerificationEmail = async () => {
    if (!user) throw new Error('No user logged in');
    await sendEmailVerification(user);
  };

  const reloadUser = async (): Promise<boolean> => {
    if (!user) return false;
    await user.reload();
    // Update the user state with refreshed data
    setUser({ ...user });
    return user.emailVerified;
  };

  const sendPasswordResetEmail = async (email: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await firebaseSendPasswordResetEmail(auth as Auth, email);
  };

  const getEffectiveAppRole = (): EAppRole | undefined => {
    if (!userData) return undefined;
    if (userData.role === 'superuser') {
      return userData.secondaryRole;
    }
    return userData.role as EAppRole | undefined;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        authReady,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        setRole,
        setSecondaryRole,
        refreshUserData,
        resendVerificationEmail,
        reloadUser,
        sendPasswordResetEmail,
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
