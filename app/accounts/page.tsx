"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  TrendingUp,
  History,
  ShieldAlert,
  Calendar,
  Edit,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Account,
  AccountAdjustment,
  createAccount,
  adjustAccountBalance,
  initializeDefaultAccounts,
  updateAccountName,
  recalculateAccountBalances,
  updateAdjustmentTransaction,
  deleteAdjustmentTransaction,
  updateAccountDetails,
} from "@/lib/accounts-db";

export default function AccountsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  // Real-time states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingAdjustments, setLoadingAdjustments] = useState(true);

  // Modal Dialog Open States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);

  // Create Account Form Fields
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountInitialBalance, setNewAccountInitialBalance] = useState("0");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Adjust Balance Form Fields
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"in" | "out">("in");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Edit Account Form Fields
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountInitialBalance, setEditAccountInitialBalance] =
    useState("");
  const [editAccountError, setEditAccountError] = useState<string | null>(null);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Syncing states
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);

  // Edit Adjustment Modal Fields
  const [editAdjOpen, setEditAdjOpen] = useState(false);
  const [editingAdj, setEditingAdj] = useState<AccountAdjustment | null>(null);
  const [editAdjAccountId, setEditAdjAccountId] = useState("");
  const [editAdjType, setEditAdjType] = useState<"in" | "out">("in");
  const [editAdjAmount, setEditAdjAmount] = useState("");
  const [editAdjReason, setEditAdjReason] = useState("");
  const [editAdjError, setEditAdjError] = useState<string | null>(null);
  const [updatingAdj, setUpdatingAdj] = useState(false);

  // Delete Adjustment Modal Fields
  const [deleteAdjConfirmOpen, setDeleteAdjConfirmOpen] = useState(false);
  const [adjIdToDelete, setAdjIdToDelete] = useState<string | null>(null);
  const [deletingAdj, setDeletingAdj] = useState(false);

  // Load accounts and adjustments
  useEffect(() => {
    if (!profile) return;

    // Trigger auto-initialization of default Kpay/Aya accounts if collection is empty
    initializeDefaultAccounts(profile.uid);

    // Accounts subscription
    const accountsQuery = query(
      collection(db, "accounts"),
      orderBy("name", "asc"),
    );
    const unsubAccounts = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const list: Account[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Account);
        });
        setAccounts(list);
        setLoadingAccounts(false);

        // Auto-select first account in adjust dropdown if not set
        if (list.length > 0) {
          setSelectedAccountId((prev) => prev || list[0].id);
        }
      },
      (err) => {
        console.error("Accounts snapshot error:", err);
        setLoadingAccounts(false);
      },
    );

    // Adjustments subscription
    const adjustmentsQuery = query(
      collection(db, "account_adjustments"),
      orderBy("createdAt", "desc"),
    );
    const unsubAdjustments = onSnapshot(
      adjustmentsQuery,
      (snapshot) => {
        const list: AccountAdjustment[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as AccountAdjustment);
        });
        setAdjustments(list);
        setLoadingAdjustments(false);
      },
      (err) => {
        console.error("Adjustments snapshot error:", err);
        setLoadingAdjustments(false);
      },
    );

    // Expenses subscription
    const expensesQuery = query(collection(db, "expenses"));
    const unsubExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setExpenses(list);
      },
      (err) => {
        console.error("Expenses snapshot error:", err);
      },
    );

    return () => {
      unsubAccounts();
      unsubAdjustments();
      unsubExpenses();
    };
  }, [profile]);

  // Aggregate Metrics
  const totalCash = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  }, [accounts]);

  const totalInitialCash = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
  }, [accounts]);

  const totalExpensesFromAccounts = useMemo(() => {
    return expenses
      .filter((exp) => !!exp.accountId)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [expenses]);

  const netCashFlow = useMemo(() => {
    return totalCash - totalInitialCash;
  }, [totalCash, totalInitialCash]);

  const cashOutByAccount = useMemo(() => {
    const map: { [key: string]: number } = {};
    accounts.forEach((acc) => {
      const accExpenses = expenses
        .filter((exp) => exp.accountId === acc.id)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);

      const accOutAdjustments = adjustments
        .filter((adj) => adj.accountId === acc.id && adj.type === "out")
        .reduce((sum, adj) => sum + (adj.amount || 0), 0);

      map[acc.id] = accExpenses + accOutAdjustments;
    });
    return map;
  }, [accounts, expenses, adjustments]);

  // Handle Account Creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const name = newAccountName.trim();
    const initialBal = parseFloat(newAccountInitialBalance);

    if (!name) {
      setCreateError("Account name is required.");
      return;
    }
    if (isNaN(initialBal) || initialBal < 0) {
      setCreateError("Initial balance must be 0 or a positive number.");
      return;
    }

    setCreating(true);
    try {
      await createAccount(name, initialBal, profile?.uid || "");
      // Reset & close
      setNewAccountName("");
      setNewAccountInitialBalance("0");
      setCreateDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create account.");
    } finally {
      setCreating(false);
    }
  };

  // Handle Balance Adjustment
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    const amount = parseFloat(adjustmentAmount);
    const reason = adjustmentReason.trim();

    if (!selectedAccountId) {
      setAdjustError("Please select an account.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setAdjustError("Amount must be a valid positive number.");
      return;
    }
    if (!reason) {
      setAdjustError("Please provide a reason for the adjustment.");
      return;
    }

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
    if (
      adjustmentType === "out" &&
      selectedAcc &&
      (selectedAcc.currentBalance || 0) < amount
    ) {
      setAdjustError(
        `Insufficient funds in ${selectedAcc.name}. Available balance is Ks ${selectedAcc.currentBalance.toLocaleString()}.`,
      );
      return;
    }

    setAdjusting(true);
    try {
      await adjustAccountBalance(
        selectedAccountId,
        adjustmentType,
        amount,
        reason,
        profile?.uid || "",
        profile?.email || "",
      );
      // Reset & close
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setAdjustDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      setAdjustError(err.message || "Failed to adjust balance.");
    } finally {
      setAdjusting(false);
    }
  };

  // Handle Account Renaming and Initial Balance editing
  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setEditAccountName(acc.name);
    setEditAccountInitialBalance(acc.initialBalance.toString());
    setEditAccountError(null);
    setEditAccountOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditAccountError(null);

    const newName = editAccountName.trim();
    const newInitialBal = parseFloat(editAccountInitialBalance);

    if (!newName) {
      setEditAccountError("Account name is required.");
      return;
    }
    if (isNaN(newInitialBal) || newInitialBal < 0) {
      setEditAccountError("Initial balance must be 0 or a positive number.");
      return;
    }
    if (!editingAccount) return;

    setUpdatingAccount(true);
    try {
      await updateAccountDetails(
        editingAccount.id,
        editingAccount.name,
        newName,
        editingAccount.initialBalance,
        newInitialBal,
        profile?.uid || "",
        profile?.email || "",
      );
      setEditAccountOpen(false);
      setEditingAccount(null);
    } catch (err: any) {
      console.error(err);
      setEditAccountError(err.message || "Failed to update account details.");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleOpenEditAdjustment = (adj: AccountAdjustment) => {
    setEditingAdj(adj);
    setEditAdjAccountId(adj.accountId);
    setEditAdjType(adj.type);
    setEditAdjAmount(adj.amount.toString());
    setEditAdjReason(adj.reason);
    setEditAdjError(null);
    setEditAdjOpen(true);
  };

  const handleUpdateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdj) return;
    setEditAdjError(null);

    const amount = parseFloat(editAdjAmount);
    const reason = editAdjReason.trim();

    if (!editAdjAccountId) {
      setEditAdjError("Please select an account.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setEditAdjError("Amount must be a valid positive number.");
      return;
    }
    if (!reason) {
      setEditAdjError("Reason is required.");
      return;
    }

    setUpdatingAdj(true);
    try {
      const updatedFields = {
        accountId: editAdjAccountId,
        type: editAdjType,
        amount,
        reason,
      };
      await updateAdjustmentTransaction(
        editingAdj.id,
        updatedFields,
        editingAdj,
      );
      setEditAdjOpen(false);
      setEditingAdj(null);
    } catch (err: any) {
      console.error(err);
      setEditAdjError(err.message || "Failed to update adjustment.");
    } finally {
      setUpdatingAdj(false);
    }
  };

  const triggerDeleteAdjustment = (id: string) => {
    setAdjIdToDelete(id);
    setDeleteAdjConfirmOpen(true);
  };

  const handleConfirmDeleteAdjustment = async () => {
    if (!adjIdToDelete) return;
    const adjData = adjustments.find((a) => a.id === adjIdToDelete);
    if (!adjData) return;

    setDeletingAdj(true);
    try {
      await deleteAdjustmentTransaction(adjIdToDelete, adjData);
      setDeleteAdjConfirmOpen(false);
      setAdjIdToDelete(null);
    } catch (err) {
      console.error("Error deleting adjustment:", err);
    } finally {
      setDeletingAdj(false);
    }
  };

  const handleSyncBalances = async () => {
    setSyncError(null);
    setSyncSuccess(false);
    setSyncing(true);
    try {
      await recalculateAccountBalances();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || "Failed to recalculate balances.");
    } finally {
      setSyncing(false);
    }
  };

  if (profile && profile.role !== "admin") {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 font-sans">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Only administrators are authorized to view the accounts dashboard
            page.
          </p>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-sans tracking-tight">
              Financial Accounts
            </h2>
            <p className="text-sm text-muted-foreground font-sans">
              Manage accounts, view dynamic balances, and adjust ledger floats.
            </p>
          </div>

          {profile?.role === "admin" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSyncBalances}
                disabled={syncing}
                className="hidden md:flex md:items-center md:gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Syncing..." : "Sync Balances"}
              </Button>

              <Dialog
                open={adjustDialogOpen}
                onOpenChange={setAdjustDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Adjust Balance
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle>Adjust Account Balance</DialogTitle>
                    <DialogDescription>
                      Inject (Cash In) or extract (Cash Out) funds from an
                      account.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={handleAdjustBalance}
                    className="space-y-4 py-4 font-sans text-sm"
                  >
                    {adjustError && (
                      <Alert variant="destructive">
                        <AlertDescription>{adjustError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="adjustAccount" required>
                        Select Account
                      </RequiredLabel>
                      <Select
                        value={selectedAccountId}
                        onValueChange={setSelectedAccountId}
                      >
                        <SelectTrigger id="adjustAccount">
                          <SelectValue placeholder="Select Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} (Ks{" "}
                              {acc.currentBalance.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="adjustType" required>
                        Adjustment Type
                      </RequiredLabel>
                      <Select
                        value={adjustmentType}
                        onValueChange={(val: "in" | "out") =>
                          setAdjustmentType(val)
                        }
                      >
                        <SelectTrigger id="adjustType">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">Cash In (+)</SelectItem>
                          <SelectItem value="out">Cash Out (-)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="adjustAmount" required>
                        Amount (Ks)
                      </RequiredLabel>
                      <Input
                        id="adjustAmount"
                        type="number"
                        min="1"
                        placeholder="10000"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="adjustReason" required>
                        Reason / Note
                      </RequiredLabel>
                      <Input
                        id="adjustReason"
                        placeholder="E.g., Opening cache float, error correction"
                        value={adjustmentReason}
                        onChange={(e) => setAdjustmentReason(e.target.value)}
                        required
                      />
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAdjustDialogOpen(false)}
                        disabled={adjusting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={adjusting}>
                        {adjusting ? "Processing..." : "Confirm Adjustment"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Add Financial Account</DialogTitle>
                    <DialogDescription>
                      Create a new named account for tracking sale transaction
                      entries.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={handleCreateAccount}
                    className="space-y-4 py-4 font-sans text-sm"
                  >
                    {createError && (
                      <Alert variant="destructive">
                        <AlertDescription>{createError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="accName" required>
                        Account Name
                      </RequiredLabel>
                      <Input
                        id="accName"
                        placeholder="E.g., WavePay, CityCash"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <RequiredLabel htmlFor="accInitial" required>
                        Initial Balance (Ks)
                      </RequiredLabel>
                      <Input
                        id="accInitial"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newAccountInitialBalance}
                        onChange={(e) =>
                          setNewAccountInitialBalance(e.target.value)
                        }
                        required
                      />
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={creating}>
                        {creating ? "Creating..." : "Create Account"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {syncSuccess && (
          <Alert className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 font-sans">
            <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
            <AlertDescription className="text-xs">
              All account balances successfully recalculated and synchronized
              with historical sales.
            </AlertDescription>
          </Alert>
        )}

        {syncError && (
          <Alert variant="destructive" className="font-sans">
            <AlertTitle className="text-xs font-semibold">
              Error Syncing Balances
            </AlertTitle>
            <AlertDescription className="text-xs">{syncError}</AlertDescription>
          </Alert>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Total Liquidity
              </CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans">
                Ks {totalCash.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Sum of current balances
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Initial Capital Base
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans">
                Ks {totalInitialCash.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Sum of starting balances
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Total Expenses (Paid)
              </CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-sans text-rose-600 dark:text-rose-400">
                Ks {totalExpensesFromAccounts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Deducted from account floats
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium font-sans">
                Net Cash Growth
              </CardTitle>
              <TrendingUp
                className={`h-4 w-4 ${netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold font-sans ${netCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {netCashFlow >= 0 ? "+" : ""}Ks {netCashFlow.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Sales & float flow additions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Detail Cards */}
        {loadingAccounts ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((acc) => {
              const growth = acc.currentBalance - acc.initialBalance;
              return (
                <Card
                  key={acc.id}
                  className="border-border shadow-sm bg-card hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-md font-bold font-sans capitalize">
                        {acc.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Created{" "}
                        {acc.createdAt
                          ? new Date(acc.createdAt).toLocaleDateString()
                          : "-"}
                      </CardDescription>
                    </div>
                    {profile?.role === "admin" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEditAccount(acc)}
                        title="Edit Account Name"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center text-sm border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">
                        Initial Balance
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        Ks {acc.initialBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-border/40 pb-1">
                      <span className="text-muted-foreground font-sans">
                        Current Balance
                      </span>
                      <span className="font-bold text-foreground">
                        Ks {acc.currentBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        Total Cash Out
                      </span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        Ks {(cashOutByAccount[acc.id] || 0).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Tabs for detailed lists */}
        <Tabs defaultValue="accounts" className="w-full">
          <TabsList>
            <TabsTrigger value="accounts">Accounts Table</TabsTrigger>
            <TabsTrigger value="adjustments">
              Adjustment Log History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-4 pt-1">
            <Card className="border border-border shadow-sm p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">
                        Initial Balance
                      </TableHead>
                      <TableHead className="text-right">
                        Current Balance
                      </TableHead>
                      <TableHead className="text-right">
                        Total Cash Out
                      </TableHead>
                      <TableHead className="text-right">
                        Total Growth Flow
                      </TableHead>
                      <TableHead>Created Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAccounts ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : accounts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground italic"
                        >
                          No financial accounts configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((acc) => {
                        const growth = acc.currentBalance - acc.initialBalance;
                        return (
                          <TableRow key={acc.id}>
                            <TableCell className="font-semibold capitalize">
                              {acc.name}
                            </TableCell>
                            <TableCell className="text-right">
                              Ks {acc.initialBalance.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-bold text-foreground">
                              Ks {acc.currentBalance.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-rose-600 dark:text-rose-400">
                              Ks{" "}
                              {(cashOutByAccount[acc.id] || 0).toLocaleString()}
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${growth >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {growth >= 0 ? "+" : ""}Ks{" "}
                              {growth.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {acc.createdAt
                                ? new Date(acc.createdAt).toLocaleDateString()
                                : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="adjustments" className="mt-4 pt-1">
            <Card className="border border-border shadow-sm p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Adjustment Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Adjusted By</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAdjustments ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : adjustments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground italic"
                        >
                          No adjustments have been recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      adjustments.map((adj) => (
                        <TableRow key={adj.id}>
                          <TableCell className="font-semibold capitalize">
                            {adj.accountName}
                          </TableCell>
                          <TableCell>
                            {adj.type === "in" ? (
                              <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-none font-sans font-normal gap-1">
                                <ArrowUpRight className="h-3 w-3" /> Cash In
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border-none font-sans font-normal gap-1">
                                <ArrowDownLeft className="h-3 w-3" /> Cash Out
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            Ks {adj.amount.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className="max-w-xs truncate"
                            title={adj.reason}
                          >
                            {adj.reason}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {adj.createdByEmail}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {adj.createdAt
                              ? new Date(adj.createdAt).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => handleOpenEditAdjustment(adj)}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-primary border-border"
                                title="Edit Adjustment"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => triggerDeleteAdjustment(adj.id)}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                                title="Delete Adjustment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Account Details</DialogTitle>
            <DialogDescription>
              Modify the financial account name or initial float balance.
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <form
              onSubmit={handleUpdateAccount}
              className="space-y-4 py-4 font-sans text-sm"
            >
              {editAccountError && (
                <Alert variant="destructive">
                  <AlertDescription>{editAccountError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <RequiredLabel htmlFor="editAccName" required>
                  Account Name
                </RequiredLabel>
                <Input
                  id="editAccName"
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  placeholder="E.g., WavePay, CityCash"
                  required
                />
              </div>
              <div className="space-y-1">
                <RequiredLabel htmlFor="editAccInitial" required>
                  Initial Balance (Ks)
                </RequiredLabel>
                <Input
                  id="editAccInitial"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={editAccountInitialBalance}
                  onChange={(e) => setEditAccountInitialBalance(e.target.value)}
                  required
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditAccountOpen(false)}
                  disabled={updatingAccount}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingAccount}>
                  {updatingAccount ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Adjustment Dialog */}
      <Dialog open={editAdjOpen} onOpenChange={setEditAdjOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Account Adjustment</DialogTitle>
            <DialogDescription>
              Modify the balance adjustment details.
            </DialogDescription>
          </DialogHeader>
          {editingAdj && (
            <form
              onSubmit={handleUpdateAdjustment}
              className="space-y-4 py-4 font-sans text-sm"
            >
              {editAdjError && (
                <Alert variant="destructive">
                  <AlertDescription>{editAdjError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <RequiredLabel htmlFor="editAdjAccount" required>
                  Select Account
                </RequiredLabel>
                <Select
                  value={editAdjAccountId}
                  onValueChange={setEditAdjAccountId}
                >
                  <SelectTrigger id="editAdjAccount">
                    <SelectValue placeholder="Select Account" />
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

              <div className="space-y-1">
                <RequiredLabel htmlFor="editAdjType" required>
                  Adjustment Type
                </RequiredLabel>
                <Select
                  value={editAdjType}
                  onValueChange={(val: "in" | "out") => setEditAdjType(val)}
                >
                  <SelectTrigger id="editAdjType">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Cash In (+)</SelectItem>
                    <SelectItem value="out">Cash Out (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <RequiredLabel htmlFor="editAdjAmount" required>
                  Amount (Ks)
                </RequiredLabel>
                <Input
                  id="editAdjAmount"
                  type="number"
                  min="1"
                  placeholder="10000"
                  value={editAdjAmount}
                  onChange={(e) => setEditAdjAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <RequiredLabel htmlFor="editAdjReason" required>
                  Reason / Note
                </RequiredLabel>
                <Input
                  id="editAdjReason"
                  placeholder="E.g., Opening cache float, error correction"
                  value={editAdjReason}
                  onChange={(e) => setEditAdjReason(e.target.value)}
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditAdjOpen(false)}
                  disabled={updatingAdj}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingAdj}>
                  {updatingAdj ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Adjustment Confirm Dialog */}
      <ConfirmDialog
        open={deleteAdjConfirmOpen}
        onOpenChange={setDeleteAdjConfirmOpen}
        title="Delete Account Adjustment"
        description="Are you sure you want to permanently delete this balance adjustment? The account balance will be reverted to reflect this deletion."
        onConfirm={handleConfirmDeleteAdjustment}
        loading={deletingAdj}
      />
    </NavLayout>
  );
}
