"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { getUserDocument } from "@/lib/firebase/auth";
import type { UserFirestore } from "@/types/firestore";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user:         User | null;
  userProfile:  UserFirestore | null;
  loading:      boolean;
  isAdmin:      boolean;
  isPsicologo:  boolean;
  isSecretaria: boolean;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue>({
  user:         null,
  userProfile:  null,
  loading:      true,
  isAdmin:      false,
  isPsicologo:  false,
  isSecretaria: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserFirestore | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profile = await getUserDocument(firebaseUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const role = userProfile?.role;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin:      role === "admin",
        isPsicologo:  role === "psicologo" || role === "admin",
        isSecretaria: role === "secretaria" || role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
