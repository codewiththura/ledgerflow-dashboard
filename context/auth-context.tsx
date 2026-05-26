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

  // Load profile from localStorage on client mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("ledgerflow_profile");
        if (cached) {
          const parsedProfile = JSON.parse(cached);
          Promise.resolve().then(() => {
            setProfile(parsedProfile);
          });
        }
      } catch (e) {
        console.error("Failed to load profile from localStorage:", e);
      }
    }
  }, []);

  const saveProfile = (newProfile: UserProfile | null) => {
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      try {
        if (newProfile) {
          localStorage.setItem("ledgerflow_profile", JSON.stringify(newProfile));
        } else {
          localStorage.removeItem("ledgerflow_profile");
        }
      } catch (e) {
        console.error("Error saving profile to localStorage:", e);
      }
    }
  };

  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const updatedProfile = await fetchUserProfile(user.uid);
        if (updatedProfile) {
          saveProfile(updatedProfile);
        }
      } catch (e) {
        console.error("Error refreshing user profile:", e);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // 1. Try to load from localStorage first for instant transition
        let cachedProfile: UserProfile | null = null;
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("ledgerflow_profile");
            if (cached) {
              const parsed = JSON.parse(cached) as UserProfile;
              if (parsed.uid === firebaseUser.uid) {
                cachedProfile = parsed;
                setProfile(parsed);
              }
            }
          } catch (e) {
            console.error("Error reading cached profile:", e);
          }
        }

        // Set loading to false early if we already have the cached profile!
        if (cachedProfile) {
          setLoading(false);
        }

        // 2. Fetch fresh user profile from firestore (falls back to cache if offline)
        try {
          const userProfile = await fetchUserProfile(firebaseUser.uid);
          if (userProfile) {
            saveProfile(userProfile);
          } else {
            // Document doesn't exist. If we don't have a cached profile, bootstrap it.
            if (!cachedProfile) {
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
              saveProfile(newProfile);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile from database:", error);
          // If offline or network error and we already have a cached profile, we do not clear it.
        }
      } else {
        saveProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => console.log("Service Worker registered:", reg.scope))
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("Error signing out:", e);
    }
    setUser(null);
    saveProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
