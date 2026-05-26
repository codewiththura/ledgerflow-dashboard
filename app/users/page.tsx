"use client";

import React, { useEffect, useState } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  orderBy,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NavLayout } from "@/components/nav-layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldAlert, Trash2 } from "lucide-react";
import { UserProfile } from "@/context/auth-context";

export default function UsersAdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== "admin") return;

    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const items: UserProfile[] = [];
      snapshot.forEach((doc) => {
        items.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(items);
      setLoading(false);
    }, (error) => {
      console.error("Users admin query error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleToggleApproval = async (user: UserProfile) => {
    if (user.uid === profile?.uid) {
      alert("You cannot revoke approval for your own account.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        approved: !user.approved
      });
    } catch (err) {
      console.error("Error toggling user approval:", err);
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    if (user.uid === profile?.uid) {
      alert("You cannot change your own role.");
      return;
    }

    const nextRole = user.role === "admin" ? "moderator" : "admin";
    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: nextRole
      });
    } catch (err) {
      console.error("Error changing user role:", err);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.uid === profile?.uid) {
      alert("You cannot delete your own account.");
      return;
    }

    if (confirm(`Are you sure you want to delete ${user.email}? This will only delete their database profile, not their login auth credentials.`)) {
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (err) {
        console.error("Error deleting user document:", err);
      }
    }
  };

  if (profile?.role !== "admin") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground font-sans">
            Only administrators are authorized to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <NavLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight">User Accounts</h2>
          <p className="text-sm text-muted-foreground font-sans">
            Review and approve moderator accounts, configure roles.
          </p>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Registered Users</CardTitle>
            <CardDescription className="text-xs font-sans">
              Control which accounts have permission to login and see data.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-sans text-sm">
                No user records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-center">Role</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="capitalize font-sans font-normal">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {u.approved ? (
                          <Badge className="bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-none font-sans font-normal">
                            Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400 border-none font-sans font-normal">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleToggleApproval(u)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-sans"
                            disabled={u.uid === profile?.uid}
                          >
                            {u.approved ? (
                              <span className="flex items-center gap-1 text-yellow-600"><X className="h-3 w-3" /> Revoke</span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> Approve</span>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleToggleRole(u)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-sans"
                            disabled={u.uid === profile?.uid}
                          >
                            Change Role
                          </Button>
                          <Button
                            onClick={() => handleDeleteUser(u)}
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                            disabled={u.uid === profile?.uid}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </NavLayout>
  );
}
