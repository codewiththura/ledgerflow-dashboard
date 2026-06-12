"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CreditCard,
  Wallet,
  Users,
  LogOut,
  Menu,
  X,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const NavLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check deferred asynchronously to avoid synchronous setState inside effect body
    const initialOnlineState = navigator.onLine;
    Promise.resolve().then(() => {
      setIsOnline(initialOnlineState);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Sales", href: "/sales", icon: ShoppingCart },
    { name: "Products", href: "/products", icon: Package },
    { name: "Expenses", href: "/expenses", icon: CreditCard },
  ];

  // Admin-only links
  if (profile?.role === "admin") {
    navigation.push({ name: "Accounts", href: "/accounts", icon: Wallet });
    navigation.push({ name: "Users", href: "/users", icon: Users });
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center px-6 border-b border-border justify-between">
          <span className="text-lg font-bold font-sans tracking-tight">LedgerFlow</span>
          {/* <span className="text-xs uppercase bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
            {profile?.role}
          </span> */}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans ${active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border bg-muted/20">
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-amber-500 animate-pulse">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold font-sans">Offline Mode</span>
            </div>
          )}
          <div className="flex flex-col mb-4">
            <span className="text-xs text-muted-foreground truncate font-sans">
              {profile?.email}
            </span>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-border text-destructive hover:bg-destructive/10 hover:text-destructive text-sm"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between px-4 border-b border-border bg-card md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold md:text-xl font-sans capitalize">
              {navigation.find((item) => isActive(item.href))?.name || "App"}
            </h1>
            {!isOnline && (
              <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] md:text-xs font-bold text-amber-500 animate-pulse ml-2">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                Offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-medium font-sans">{profile?.email}</span>
            </div>
          </div>
        </header>

        {/* Dynamic content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/30">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 md:hidden ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-sans tracking-tight">LedgerFlow</span>
            <span className="text-xs uppercase bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
              {profile?.role}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans ${active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border bg-muted/20">
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-amber-500 animate-pulse">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold font-sans">Offline Mode</span>
            </div>
          )}
          <div className="flex flex-col mb-4">
            <span className="text-xs text-muted-foreground truncate font-sans">
              {profile?.email}
            </span>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-border text-destructive hover:bg-destructive/10 hover:text-destructive text-sm"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
};
