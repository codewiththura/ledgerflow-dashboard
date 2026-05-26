"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  const { user, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg border border-border text-center">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Approval Pending</CardTitle>
          <CardDescription>
            Your account is waiting for administrative approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 font-sans text-sm text-muted-foreground">
          <p>
            Your email is: <strong className="text-foreground">{user?.email}</strong>
          </p>
          <p>
            An administrator must approve your moderator account before you can access the dashboard.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={handleCheckStatus} disabled={checking} variant="outline" className="w-full sm:w-auto">
            {checking ? "Checking..." : "Refresh Status"}
          </Button>
          <Button onClick={logout} variant="destructive" className="w-full sm:w-auto">
            Log Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
