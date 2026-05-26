"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signOut as firebaseSignOut
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  limit, 
  query 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  role: "admin" | "moderator";
  approved: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchUserProfile(user.uid);
      setProfile(updatedProfile);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let userProfile = await fetchUserProfile(firebaseUser.uid);
        
        // If user document does not exist yet (e.g. signup in progress or manual database mismatch),
        // we wait for it to be created, or try to fallback.
        if (!userProfile) {
          // Let's check if they are the first user to bootstrap admin
          try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, limit(1));
            const querySnapshot = await getDocs(q);
            const isFirstUser = querySnapshot.empty;

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              role: isFirstUser ? "admin" : "moderator",
              approved: isFirstUser, // Auto-approve first user
              createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, "users", firebaseUser.uid), newProfile);
            userProfile = newProfile;
          } catch (e) {
            console.error("Error bootstrapping user:", e);
          }
        }
        
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => console.log("Service Worker registered:", reg.scope))
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  const logout = async () => {
    setLoading(true);
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
