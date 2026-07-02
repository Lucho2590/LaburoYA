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
import { IUserData, EUserRole, EAppRole, IWorkerProfile, IEmployerProfile, ICompanyProfile } from '@/types';

const USER_DATA_CACHE_KEY = 'laburoya:userData';

// Cache optimista de userData en localStorage. Permite renderizar el shell
// (nav + nombre + avatar) al instante para usuarios recurrentes mientras
// /auth/me revalida en background, en vez de esperar el roundtrip al backend.
function readCachedUserData(): IUserData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_DATA_CACHE_KEY);
    return raw ? (JSON.parse(raw) as IUserData) : null;
  } catch {
    return null;
  }
}

function writeCachedUserData(data: IUserData | null) {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      window.localStorage.setItem(USER_DATA_CACHE_KEY, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(USER_DATA_CACHE_KEY);
    }
  } catch {
    // Ignorar (modo privado / storage lleno)
  }
}

interface AuthContextType {
  user: User | null;
  userData: IUserData | null;
  loading: boolean;
  sessionReady: boolean; // Firebase resolvió si hay sesión (rápido, ~100ms)
  authReady: boolean; // Token listo para hacer llamadas API
  signIn: (email: string, password: string) => Promise<{ emailVerified: boolean }>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: EUserRole) => Promise<void>;
  setSecondaryRole: (role: EAppRole) => Promise<void>;
  impersonateCompany: (companyId: string) => Promise<void>;
  stopImpersonatingCompany: () => Promise<void>;
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
  // Hidratamos desde localStorage para que el primer render ya tenga rol/nombre.
  const [userData, setUserDataState] = useState<IUserData | null>(() => readCachedUserData());
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Wrapper que persiste userData en el cache optimista.
  const setUserData = (data: IUserData | null) => {
    setUserDataState(data);
    writeCachedUserData(data);
  };

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
        organizationId: data.user?.organizationId,
        companySubscription: data.companySubscription ?? null,
        impersonating: data.impersonating ?? null,
        profile: data.profile as IWorkerProfile | IEmployerProfile | ICompanyProfile | undefined,
        firstName: data.user?.firstName,
        lastName: data.user?.lastName,
        age: data.user?.age,
        nickname: data.user?.nickname,
        onboardingCompleted: data.user?.onboardingCompleted,
        aiCvEnabled: data.user?.aiCvEnabled,
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
        // La sesión ya está resuelta: el shell puede renderizar de inmediato
        // (usando el cache optimista de userData) sin esperar a /auth/me.
        // OJO: `loading` sigue en true hasta que userData esté cargado, porque
        // varios guards (onboarding, redirects) lo usan para saber si el perfil
        // ya llegó. `sessionReady` es solo para el chrome del shell.
        setSessionReady(true);

        // Cache optimista: si tenemos un perfil válido (con rol) del MISMO
        // usuario, lo usamos ya y no bloqueamos → los guards de onboarding/rol
        // corren con datos correctos y el header aparece al instante; /auth/me
        // revalida en background. Si NO hay cache válido (login nuevo, otra
        // cuenta, o cache sin rol), ponemos loading=true y descartamos el cache
        // viejo, para que los guards ESPEREN al perfil en vez de asumir que es
        // un usuario nuevo y mandarlo a onboarding.
        const cached = readCachedUserData();
        const cacheValid = !!cached && cached.uid === firebaseUser.uid && !!cached.role;
        if (cacheValid) {
          setUserDataState(cached);
          setLoading(false);
        } else {
          if (cached && cached.uid !== firebaseUser.uid) writeCachedUserData(null);
          setUserData(null);
          setLoading(true);
        }

        try {
          // Esperar a que el token esté disponible antes de llamar a la API.
          await firebaseUser.getIdToken();
          // Token listo: los hooks (notificaciones, etc.) ya pueden consultar,
          // en paralelo con la carga del perfil.
          setAuthReady(true);

          const data = await api.getCurrentUser();
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: data.user?.role as EUserRole | undefined,
            secondaryRole: data.user?.secondaryRole as EAppRole | undefined,
            organizationId: data.user?.organizationId,
            companySubscription: data.companySubscription ?? null,
            impersonating: data.impersonating ?? null,
            profile: data.profile as IWorkerProfile | IEmployerProfile | ICompanyProfile | undefined,
            firstName: data.user?.firstName,
            lastName: data.user?.lastName,
            age: data.user?.age,
            nickname: data.user?.nickname,
            onboardingCompleted: data.user?.onboardingCompleted,
            aiCvEnabled: data.user?.aiCvEnabled,
          });

          // Track login location (IP-based, silent)
          api.trackLogin().catch(() => {
            // Silently ignore - location tracking is not critical
          });
        } catch {
          setAuthReady(true);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
        } finally {
          // Perfil cargado (o falló): recién ahora liberamos los guards que
          // dependen de userData (onboarding, redirects por rol).
          setLoading(false);
        }
      } else {
        setUserData(null);
        setSessionReady(true); // No hay usuario, pero la sesión está resuelta
        setAuthReady(true);
        setLoading(false);
      }
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

  const impersonateCompany = async (companyId: string) => {
    await api.impersonateCompany(companyId);
    await refreshUserData();
  };

  const stopImpersonatingCompany = async () => {
    await api.stopImpersonatingCompany();
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
    // Una empresa usa las mismas pantallas que el empleador.
    if (userData.role === 'company') {
      return EAppRole.EMPLOYER;
    }
    if (userData.role === 'superuser') {
      // Impersonar una empresa gana sobre el secondaryRole; ambos caen en la
      // experiencia "employer".
      if (userData.impersonating?.companyId) {
        return EAppRole.EMPLOYER;
      }
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
        sessionReady,
        authReady,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        setRole,
        setSecondaryRole,
        impersonateCompany,
        stopImpersonatingCompany,
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
