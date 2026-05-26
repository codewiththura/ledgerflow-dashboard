"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

const PUBLIC_PATHS = ["/login", "/signup"];

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!user) {
      if (!isPublicPath) {
        router.replace("/login");
      }
    } else {
      // User is authenticated
      if (!profile) {
        // Profile is loading or not created yet
        return;
      }

      if (!profile.approved) {
        if (pathname !== "/pending") {
          router.replace("/pending");
        }
      } else {
        // User is approved
        if (pathname === "/pending" || isPublicPath) {
          router.replace("/dashboard");
        }

        // Admin-only paths
        if (pathname === "/users" && profile.role !== "admin") {
          router.replace("/dashboard");
        }
      }
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-sans">Loading</p>
        </div>
      </div>
    );
  }

  // Handle access state before rendering children to prevent page flash
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user) {
    return isPublicPath ? <>{children}</> : null;
  }

  if (!profile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-sans">Loading account</p>
        </div>
      </div>
    );
  }

  if (!profile.approved) {
    return pathname === "/pending" ? <>{children}</> : null;
  }

  if (pathname === "/users" && profile.role !== "admin") {
    return null;
  }

  if (pathname === "/pending" || isPublicPath) {
    return null;
  }

  return <>{children}</>;
};
