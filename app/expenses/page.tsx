"use client";

import React, { useState } from "react";
import {
  collection,
  addDoc,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { PaginationControls } from "@/components/pagination-controls";

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  note: string;
  shared: boolean;
  createdBy: string;
  createdAt: string;
}

export default function ExpensesPage() {
  const { profile } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Custom delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseIdToDelete, setExpenseIdToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"Shared" | "Only Me">("Shared");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form fields
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<"Shared" | "Only Me">("Shared");
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const createExpensesQuery = React.useCallback(() => {
    if (!profile) return query(collection(db, "expenses"), orderBy("date", "desc"));

    if (profile.role === "admin") {
      return query(collection(db, "expenses"), orderBy("date", "desc"));
    } else {
      return query(
        collection(db, "expenses"),
        where("shared", "==", true),
        orderBy("date", "desc")
      );
    }
  }, [profile]);

  const {
    items: expenses,
    loading,
    page,
    pageSize,
    setPageSize,
    totalCount,
    hasMore,
    nextPage,
    prevPage,
    refresh
  } = useFirestorePagination<Expense>(
    createExpensesQuery,
    10,
    [profile?.role],
    !!profile
  );

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
      // If admin, they choose visibility. If moderator, it defaults to "Only Me".
      const isShared = profile?.role === "admin" ? (visibility === "Shared") : true;
      await addDoc(collection(db, "expenses"), {
        title: title.trim(),
        amount: parsedAmount,
        date: date,
        note: note.trim(),
        shared: isShared,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });

      setTitle("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setVisibility("Shared");
      setCreateDialogOpen(false);
      await refresh();
    } catch (err) {
      console.error("Error creating expense:", err);
      setFormError("Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditTitle(expense.title);
    setEditAmount(expense.amount.toString());
    setEditDate(expense.date);
    setEditNote(expense.note);
    setEditVisibility(expense.shared ? "Shared" : "Only Me");
    setEditFormError(null);
    setEditDialogOpen(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    setEditFormError(null);
    const parsedAmount = parseFloat(editAmount);

    if (!editTitle.trim()) {
      setEditFormError("Expense title is required.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setEditFormError("Amount must be a valid positive number.");
      return;
    }
    if (!editDate) {
      setEditFormError("Date is required.");
      return;
    }

    setUpdating(true);
    try {
      const updatedFields: {
        title: string;
        amount: number;
        date: string;
        note: string;
        shared?: boolean;
      } = {
        title: editTitle.trim(),
        amount: parsedAmount,
        date: editDate,
        note: editNote.trim(),
      };

      if (profile?.role === "admin") {
        updatedFields.shared = editVisibility === "Shared";
      }

      await updateDoc(doc(db, "expenses", editingExpense.id), updatedFields);
      setEditDialogOpen(false);
      setEditingExpense(null);
      await refresh();
    } catch (err) {
      console.error("Error updating expense:", err);
      setEditFormError("Failed to update expense.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleVisibility = async (expense: Expense) => {
    if (profile?.role !== "admin") return;
    try {
      await updateDoc(doc(db, "expenses", expense.id), {
        shared: !expense.shared
      });
      await refresh();
    } catch (err) {
      console.error("Error toggling expense visibility:", err);
    }
  };

  const triggerDelete = (id: string) => {
    setExpenseIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseIdToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "expenses", expenseIdToDelete));
      setDeleteConfirmOpen(false);
      setExpenseIdToDelete(null);
      await refresh();
    } catch (err) {
      console.error("Error deleting expense:", err);
    } finally {
      setDeleting(false);
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

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                  <RequiredLabel htmlFor="title" required>Expense Title</RequiredLabel>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g. Office rent, utilities"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="amount" required>Amount</RequiredLabel>
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
                  <RequiredLabel htmlFor="date" required>Date</RequiredLabel>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="note">Notes (Optional)</RequiredLabel>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Additional details"
                  />
                </div>
                {profile?.role === "admin" && (
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="visibility" required>Visibility</RequiredLabel>
                    <Select
                      value={visibility}
                      onValueChange={(val: "Shared" | "Only Me") => setVisibility(val)}
                    >
                      <SelectTrigger id="visibility">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Shared">Shared</SelectItem>
                        <SelectItem value="Only Me">Only Me</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
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
              {totalCount} expenses logged.
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
                      <TableHead className="text-center">Visibility</TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">Ks {expense.amount.toLocaleString()}</TableCell>
                      {profile?.role === "admin" && (
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleToggleVisibility(expense)}
                            className="focus:outline-none"
                            title="Click to toggle visibility"
                          >
                            {expense.shared ? (
                              <Badge className="bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-none font-sans font-normal cursor-pointer">
                                Shared
                              </Badge>
                            ) : (
                              <Badge className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400 border-none font-sans font-normal cursor-pointer">
                                Only Me
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(profile?.role === "admin" || expense.shared) && (
                            <Button
                              onClick={() => handleOpenEdit(expense)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-primary border-border"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {profile?.role === "admin" && (
                            <Button
                              onClick={() => triggerDelete(expense.id)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {!loading && expenses.length > 0 && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageSizeChange={setPageSize}
              onPrevPage={prevPage}
              onNextPage={nextPage}
              hasMore={hasMore}
              loading={loading}
            />
          )}
        </Card>
      </div>

      {/* Edit Expense Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the details of this expense.
            </DialogDescription>
          </DialogHeader>
          {editingExpense && (
            <form onSubmit={handleUpdateExpense} className="space-y-4 py-4">
              {editFormError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{editFormError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-title" required>Expense Title</RequiredLabel>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="E.g. Office rent, utilities"
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-amount" required>Amount</RequiredLabel>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-date" required>Date</RequiredLabel>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-note">Notes (Optional)</RequiredLabel>
                <Input
                  id="edit-note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Additional details"
                />
              </div>
              {profile?.role === "admin" && (
                <div className="space-y-2">
                  <RequiredLabel htmlFor="edit-visibility" required>Visibility</RequiredLabel>
                  <Select
                    value={editVisibility}
                    onValueChange={(val: "Shared" | "Only Me") => setEditVisibility(val)}
                  >
                    <SelectTrigger id="edit-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shared">Shared</SelectItem>
                      <SelectItem value="Only Me">Only Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom ConfirmDialog for delete action */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Expense"
        description="Are you sure you want to permanently delete this expense log? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </NavLayout>
  );
}
