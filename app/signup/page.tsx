"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess(true);
    } catch (err) {
      console.error("Signup error:", err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        setError("Email is already in use.");
      } else {
        setError(firebaseError.message || "An error occurred during signup.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>
          <CardDescription>
            Register for a LedgerFlow account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Registration Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-600 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-400">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>Creating profile...</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full"
                disabled={loading || success}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? "Registering..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
          <div>
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-primary transition-colors">
              Log In
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
