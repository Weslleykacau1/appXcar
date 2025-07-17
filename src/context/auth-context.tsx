
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export type UserRole = "passenger" | "driver" | "admin";
export type VerificationStatus = "Verificado" | "Pendente" | "Rejeitado";
export type UserStatus = "Ativo" | "Suspenso";

interface SavedLocation {
    id: string;
    name: string;
    address: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  verification: VerificationStatus;
  phone?: string;
  cpf?: string;
  vehicle_model?: string;
  vehicle_license_plate?: string;
  vehicle_color?: string;
  vehicle_year?: string;
  photoUrl?: string;
  cnhUrl?: string;
  crlvUrl?: string;
  identityDocumentUrl?: string;
  addressProofUrl?: string;
  homeAddress?: string;
  workAddress?: string;
  savedLocations?: SavedLocation[];
}

interface LoginCredentials {
    email: string;
    password?: string;
}

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials, overrideRole?: UserRole) => void;
  logout: () => void;
  isLoading: boolean;
  isSubmitting: boolean;
  fetchUserProfile: (firebaseUser: FirebaseUser) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = "admin@tridriver.com";


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUserProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    if (!firebaseUser?.uid) return null;
    const docRef = doc(db, "profiles", firebaseUser.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const profileData = docSnap.data();
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            ...profileData,
        } as User;
    }
    return null;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userProfile = await fetchUserProfile(firebaseUser);
        if (userProfile) {
          setUser(userProfile);
        } else if (firebaseUser.email === ADMIN_EMAIL) {
            setUser({
                 id: firebaseUser.uid,
                name: "Admin",
                email: ADMIN_EMAIL,
                role: "admin",
                status: "Ativo",
                verification: "Verificado"
            });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (credentials: LoginCredentials, overrideRole?: UserRole) => {
    setIsSubmitting(true);
    if (!credentials.email || !credentials.password) {
        toast({ variant: "destructive", title: "Erro", description: "Email e senha são obrigatórios." });
        setIsSubmitting(false);
        return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        let userProfile = await fetchUserProfile(firebaseUser);
        
        if (!userProfile) {
           const roleToUse = overrideRole || (firebaseUser.email?.includes('passenger') ? 'passenger' : 'driver');
           userProfile = {
              id: firebaseUser.uid,
              name: roleToUse.charAt(0).toUpperCase() + roleToUse.slice(1),
              email: firebaseUser.email || '',
              role: roleToUse,
              status: "Ativo",
              verification: "Verificado"
           }
        }

        let finalRole = overrideRole || userProfile.role;
        if (userProfile.email === ADMIN_EMAIL) {
            finalRole = 'admin';
        }

        const finalUser = { ...userProfile, role: finalRole };
        setUser(finalUser);
        
        if (finalRole === 'passenger') {
            router.push('/passenger/request-ride');
        } else {
            router.push(`/${finalRole}`);
        }

      } else {
         throw new Error("Ocorreu um erro inesperado durante o login.");
      }

    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Erro no Login",
        description: error.code === 'auth/invalid-credential' 
            ? "Credenciais inválidas. Verifique seu email e senha."
            : error.message || "Ocorreu um erro no servidor.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isSubmitting, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

    

    
