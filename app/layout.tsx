import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { AuthGuard } from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "LedgerFlow",
  description: "Track sales, expenses, and revenues",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-hidden antialiased">
      <body className="h-full overflow-hidden bg-background text-foreground">
        <AuthProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
