"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NavLayout } from "@/components/nav-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, Edit, Banknote, Wallet, FileText } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Income,
  validateIncomeInput,
  canManageIncome,
} from "@/lib/income-utils";
import {
  Account,
  createIncomeTransaction,
  updateIncomeTransaction,
  deleteIncomeTransaction,
} from "@/lib/accounts-db";

export default function IncomePage() {
  const { profile } = useAuth();

  // Accounts state for dropdown selection
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Create Form Fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [incomeType, setIncomeType] = useState<
    "business" | "personal" | "other"
  >("business");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"Shared" | "Only Me">("Shared");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form Fields
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIncomeType, setEditIncomeType] = useState<
    "business" | "personal" | "other"
  >("business");
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<"Shared" | "Only Me">(
    "Shared"
  );
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch accounts list in real time
  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Account[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Account);
      });
      setAccounts(list);
      if (list.length > 0) {
        setAccountId((prev) => prev || list[0].id);
      }
    });

    return () => unsub();
  }, []);

  // Firestore Pagination Query
  const createIncomesQuery = useCallback(() => {
    if (!profile) {
      return query(collection(db, "incomes"), orderBy("date", "desc"));
    }

    if (profile.role === "admin") {
      return query(collection(db, "incomes"), orderBy("date", "desc"));
    } else {
      return query(
        collection(db, "incomes"),
        where("shared", "==", true),
        orderBy("date", "desc")
      );
    }
  }, [profile]);

  const {
    items: incomes,
    loading,
    page,
    pageSize,
    setPageSize,
    totalCount,
    hasMore,
    nextPage,
    prevPage,
    refresh,
  } = useFirestorePagination<Income>(
    createIncomesQuery,
    10,
    [profile?.role],
    !!profile
  );

  // Filtered & sorted list
  const filteredIncomes = useMemo(() => {
    return incomes.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.accountName || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (item.note || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === "all" || (item.incomeType || "business") === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [incomes, searchQuery, typeFilter]);

  // Aggregate stats across current page/view
  const totalCustomIncomeAmount = useMemo(() => {
    return incomes.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [incomes]);

  // Handle Create Income
  const handleCreateIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateIncomeInput({
      title,
      amount,
      accountId,
      date,
    });

    if (!validation.isValid) {
      setFormError(validation.error);
      return;
    }

    setSubmitting(true);
    try {
      const isShared =
        profile?.role === "admin" ? visibility === "Shared" : true;

      await createIncomeTransaction(
        {
          title: title.trim(),
          amount: validation.parsedAmount,
          date,
          incomeType,
          note: note.trim(),
          shared: isShared,
          createdBy: profile?.uid || "",
          createdByEmail: profile?.email || "",
          createdAt: new Date().toISOString(),
        },
        accountId
      );

      // Reset form fields
      setTitle("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setIncomeType("business");
      setNote("");
      setVisibility("Shared");
      if (accounts.length > 0) {
        setAccountId(accounts[0].id);
      }
      setCreateDialogOpen(false);
      await refresh();
    } catch (err: unknown) {
      console.error("Error creating custom income:", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to record custom income."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (income: Income) => {
    setEditingIncome(income);
    setEditTitle(income.title);
    setEditAmount(income.amount.toString());
    setEditAccountId(income.accountId || "");
    setEditDate(income.date);
    setEditIncomeType(income.incomeType || "business");
    setEditNote(income.note || "");
    setEditVisibility(income.shared ? "Shared" : "Only Me");
    setEditFormError(null);
    setEditDialogOpen(true);
  };

  // Handle Update Income
  const handleUpdateIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncome) return;
    setEditFormError(null);

    const validation = validateIncomeInput({
      title: editTitle,
      amount: editAmount,
      accountId: editAccountId,
      date: editDate,
    });

    if (!validation.isValid) {
      setEditFormError(validation.error);
      return;
    }

    setUpdating(true);
    try {
      const isShared =
        profile?.role === "admin" ? editVisibility === "Shared" : true;

      await updateIncomeTransaction(
        editingIncome.id,
        {
          title: editTitle.trim(),
          amount: validation.parsedAmount,
          accountId: editAccountId,
          date: editDate,
          incomeType: editIncomeType,
          note: editNote.trim(),
          shared: isShared,
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.uid || "",
        },
        editingIncome
      );

      setEditDialogOpen(false);
      setEditingIncome(null);
      await refresh();
    } catch (err: unknown) {
      console.error("Error updating custom income:", err);
      setEditFormError(
        err instanceof Error ? err.message : "Failed to update custom income."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Handle Delete Confirmation
  const handleOpenDelete = (income: Income) => {
    setIncomeToDelete(income);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!incomeToDelete) return;
    setDeleting(true);
    try {
      await deleteIncomeTransaction(incomeToDelete.id, incomeToDelete);
      setDeleteConfirmOpen(false);
      setIncomeToDelete(null);
      await refresh();
    } catch (err: unknown) {
      console.error("Error deleting custom income:", err);
    } finally {
      setDeleting(false);
    }
  };

  const isAuthorized = canManageIncome(profile?.role);

  return (
    <NavLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-sans tracking-tight">
                Income List
              </h2>
              <Badge variant="secondary" className="font-sans text-xs">
                {totalCount} Total
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-sans">
              Record miscellaneous revenue, capital inflow, and custom earnings with automatic account updates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Income
            </Button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Logged Income
              </CardTitle>
              <Banknote className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans text-foreground">
                Ks {totalCustomIncomeAmount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Sum of current page entries
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Total Transactions
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans text-foreground">
                {totalCount}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Total custom income records
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Active Accounts
              </CardTitle>
              <Wallet className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans text-foreground">
                {accounts.length}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Configured payment accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-lg border border-border">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search income by title, account, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-xs font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table of Custom Incomes */}
        <Card className="border border-border shadow-sm p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount (Ks)</TableHead>
                  <TableHead>Note</TableHead>
                  {profile?.role === "admin" && <TableHead>Visibility</TableHead>}
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={profile?.role === "admin" ? 8 : 7}
                      className="text-center py-10"
                    >
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredIncomes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={profile?.role === "admin" ? 8 : 7}
                      className="text-center py-12 text-muted-foreground font-sans italic"
                    >
                      No custom income records found. Click &quot;Add Income&quot; to log your first entry.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncomes.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40 font-sans">
                      <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {item.date}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal capitalize">
                          {item.accountName || "Account"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-xs text-muted-foreground">
                          {item.incomeType || "business"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +Ks {item.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.note || "-"}
                      </TableCell>
                      {profile?.role === "admin" && (
                        <TableCell>
                          <Badge
                            variant={item.shared ? "default" : "secondary"}
                            className="text-[10px] uppercase font-semibold"
                          >
                            {item.shared ? "Shared" : "Only Me"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right whitespace-nowrap">
                        {isAuthorized && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(item)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Income"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDelete(item)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Delete Income"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-border">
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
          </div>
        </Card>

        {/* Add Income Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Custom Income</DialogTitle>
              <DialogDescription>
                Record custom income and update deposit account balance in real-time.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateIncome} className="space-y-4 py-2 font-sans">
              {formError && (
                <Alert variant="destructive">
                  <AlertTitle>Validation Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <RequiredLabel htmlFor="incomeTitle" required>
                  Income Title
                </RequiredLabel>
                <Input
                  id="incomeTitle"
                  placeholder="e.g. Consulting Fee, Investment Return, Capital Injection"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <RequiredLabel htmlFor="incomeAmount" required>
                    Amount (Ks)
                  </RequiredLabel>
                  <Input
                    id="incomeAmount"
                    type="number"
                    min="1"
                    placeholder="100000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <RequiredLabel htmlFor="incomeAccount" required>
                    Deposit Account
                  </RequiredLabel>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="incomeAccount">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} (Ks {acc.currentBalance.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <RequiredLabel htmlFor="incomeDate" required>
                    Date
                  </RequiredLabel>
                  <Input
                    id="incomeDate"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <RequiredLabel htmlFor="incomeType">Category / Type</RequiredLabel>
                  <Select
                    value={incomeType}
                    onValueChange={(val: "business" | "personal" | "other") =>
                      setIncomeType(val)
                    }
                  >
                    <SelectTrigger id="incomeType">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <RequiredLabel htmlFor="incomeNote">Note (Optional)</RequiredLabel>
                <Input
                  id="incomeNote"
                  placeholder="Reference number, customer note, or details..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {profile?.role === "admin" && (
                <div className="space-y-1">
                  <RequiredLabel htmlFor="incomeVisibility">
                    Visibility
                  </RequiredLabel>
                  <Select
                    value={visibility}
                    onValueChange={(val: "Shared" | "Only Me") =>
                      setVisibility(val)
                    }
                  >
                    <SelectTrigger id="incomeVisibility">
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shared">Shared (Team-wide)</SelectItem>
                      <SelectItem value="Only Me">Only Me (Private)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {submitting ? "Saving..." : "Save Income"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Income Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Custom Income</DialogTitle>
              <DialogDescription>
                Modify details. Balance adjustments will be applied atomically to maintain accuracy.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateIncome} className="space-y-4 py-2 font-sans">
              {editFormError && (
                <Alert variant="destructive">
                  <AlertTitle>Validation Error</AlertTitle>
                  <AlertDescription>{editFormError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <RequiredLabel htmlFor="editIncomeTitle" required>
                  Income Title
                </RequiredLabel>
                <Input
                  id="editIncomeTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <RequiredLabel htmlFor="editIncomeAmount" required>
                    Amount (Ks)
                  </RequiredLabel>
                  <Input
                    id="editIncomeAmount"
                    type="number"
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <RequiredLabel htmlFor="editIncomeAccount" required>
                    Deposit Account
                  </RequiredLabel>
                  <Select value={editAccountId} onValueChange={setEditAccountId}>
                    <SelectTrigger id="editIncomeAccount">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} (Ks {acc.currentBalance.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <RequiredLabel htmlFor="editIncomeDate" required>
                    Date
                  </RequiredLabel>
                  <Input
                    id="editIncomeDate"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <RequiredLabel htmlFor="editIncomeType">Category / Type</RequiredLabel>
                  <Select
                    value={editIncomeType}
                    onValueChange={(val: "business" | "personal" | "other") =>
                      setEditIncomeType(val)
                    }
                  >
                    <SelectTrigger id="editIncomeType">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <RequiredLabel htmlFor="editIncomeNote">Note (Optional)</RequiredLabel>
                <Input
                  id="editIncomeNote"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>

              {profile?.role === "admin" && (
                <div className="space-y-1">
                  <RequiredLabel htmlFor="editIncomeVisibility">
                    Visibility
                  </RequiredLabel>
                  <Select
                    value={editVisibility}
                    onValueChange={(val: "Shared" | "Only Me") =>
                      setEditVisibility(val)
                    }
                  >
                    <SelectTrigger id="editIncomeVisibility">
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shared">Shared (Team-wide)</SelectItem>
                      <SelectItem value="Only Me">Only Me (Private)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updating}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {updating ? "Updating..." : "Update Income"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Delete Custom Income"
          description={`Are you sure you want to delete "${incomeToDelete?.title}" (Ks ${incomeToDelete?.amount.toLocaleString()})? This amount will be subtracted from ${incomeToDelete?.accountName || "the account"} balance.`}
          confirmText="Delete"
          loading={deleting}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </NavLayout>
  );
}

