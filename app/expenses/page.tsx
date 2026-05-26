"use client";

import React, { useEffect, useState } from "react";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NavLayout } from "@/components/nav-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, Plus, Trash2 } from "lucide-react";

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  note: string;
  approved: boolean;
  createdBy: string;
  createdAt: string;
}

export default function ExpensesPage() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let expensesQuery;
    if (profile.role === "admin") {
      expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
    } else {
      expensesQuery = query(
        collection(db, "expenses"), 
        where("approved", "==", true),
        orderBy("date", "desc")
      );
    }

    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const items: Expense[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(items);
      setLoading(false);
    }, (error) => {
      console.error("Expenses subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedAmount = parseFloat(amount);

    if (!title.trim()) {
      setFormError("Expense title is required.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Amount must be a valid positive number.");
      return;
    }
    if (!date) {
      setFormError("Date is required.");
      return;
    }

    setSubmitting(true);
    try {
      const isApproved = profile?.role === "admin";
      await addDoc(collection(db, "expenses"), {
        title: title.trim(),
        amount: parsedAmount,
        date: date,
        note: note.trim(),
        approved: isApproved,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });
      
      setTitle("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setDialogOpen(false);
    } catch (err) {
      console.error("Error creating expense:", err);
      setFormError("Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "expenses", id), { approved: true });
    } catch (err) {
      console.error("Error approving expense:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        await deleteDoc(doc(db, "expenses", id));
      } catch (err) {
        console.error("Error deleting expense:", err);
      }
    }
  };

  return (
    <NavLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-sans tracking-tight">Expenses Log</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Track business operational costs and spending.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                  Enter spend details below.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateExpense} className="space-y-4 py-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="title">Expense Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g. Office rent, utilities"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Notes (Optional)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Additional details"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Expense"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Expenses List</CardTitle>
            <CardDescription className="text-xs font-sans">
              {expenses.length} expenses logged.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-sans text-sm">
                No expenses logged. Add an expense to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {profile?.role === "admin" && (
                      <>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">{expense.date}</TableCell>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {expense.note || "-"}
                      </TableCell>
                      <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                      {profile?.role === "admin" && (
                        <>
                          <TableCell className="text-center">
                            {expense.approved ? (
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
                              {!expense.approved && (
                                <Button
                                  onClick={() => handleApprove(expense.id)}
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDelete(expense.id)}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
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
