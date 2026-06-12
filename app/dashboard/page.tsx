"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Account, AccountAdjustment } from "@/lib/accounts-db";
import { useAuth } from "@/context/auth-context";
import { NavLayout } from "@/components/nav-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Users,
  TrendingUp,
  Coins,
  Calendar,
  Wallet,
  Lock,
  Globe,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ArrowUpRight,
  Banknote,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const formatDateLabel = (label: any): any => {
  if (typeof label !== "string") return label;
  if (!label) return "";
  try {
    const parts = label.split("-");
    if (parts.length !== 3) return label;
    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (isNaN(date.getTime())) return label;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return label;
  }
};

interface ProductItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Sale {
  id: string;
  customerSocialName: string;
  transactionName: string;
  transactionMethod: string;
  date: string;
  products: ProductItem[];
  subtotal: number;
  total: number;
  approved: boolean;
  shared?: boolean;
  createdAt: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  approved: boolean;
  shared?: boolean;
  createdAt: string;
  expenseType?: "business" | "personal";
  note?: string;
}

interface CompareBadgeProps {
  current: number;
  previous: number;
  isCurrency?: boolean;
  isExpense?: boolean;
}

function CompareBadge({
  current,
  previous,
  isCurrency = true,
  isExpense = false,
}: CompareBadgeProps) {
  const diff = current - previous;

  // Percent calculation
  let percent = 0;
  if (previous !== 0) {
    percent = (diff / previous) * 100;
  } else if (current !== 0) {
    percent = current > 0 ? 100 : -100;
  }

  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground bg-muted/40 rounded-md">
        0%
      </span>
    );
  }

  const isPositiveChange = diff > 0;
  // For expenses, decrease is good/green, increase is bad/red
  const isFavorable = isExpense ? !isPositiveChange : isPositiveChange;

  const colorClass = isFavorable
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  const Icon = isPositiveChange ? ArrowUp : ArrowDown;
  const prefix = isPositiveChange ? "+" : "-";

  const formattedDiff = isCurrency
    ? `${Math.abs(diff).toLocaleString()} Ks`
    : `${Math.abs(diff).toLocaleString()}`;

  const formattedPercent = `(${isPositiveChange ? "+" : "-"}${Math.abs(percent).toFixed(1)}%)`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium rounded-full transition-all duration-300 ${colorClass}`}
    >
      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
      <span>
        {prefix}
        {formattedDiff} {formattedPercent}
      </span>
    </span>
  );
}

const computeMetrics = (filteredSales: Sale[], filteredExpenses: Expense[]) => {
  // Distinct Customers (calculated using sale.transactionName)
  const customerSet = new Set<string>();
  const sharedCustomerSet = new Set<string>();
  const privateCustomerSet = new Set<string>();

  let totalSalesVal = 0;
  let sharedSalesVal = 0;
  let privateSalesVal = 0;
  filteredSales.forEach((sale) => {
    if (sale.transactionName) {
      const cName = sale.transactionName.trim().toLowerCase();
      customerSet.add(cName);
      if (sale.shared === true) {
        sharedCustomerSet.add(cName);
      } else {
        privateCustomerSet.add(cName);
      }
    }
    totalSalesVal += sale.total;
    if (sale.shared === true) {
      sharedSalesVal += sale.total;
    } else {
      privateSalesVal += sale.total;
    }
  });

  let totalExpensesVal = 0;
  let sharedExpensesVal = 0;
  let privateExpensesVal = 0;
  let businessExpensesVal = 0;
  let personalExpensesVal = 0;
  let sharedBusinessExpensesVal = 0;
  let sharedPersonalExpensesVal = 0;
  let privateBusinessExpensesVal = 0;
  let privatePersonalExpensesVal = 0;
  filteredExpenses.forEach((exp) => {
    totalExpensesVal += exp.amount;
    const isBusiness = exp.expenseType !== "personal";
    if (isBusiness) {
      businessExpensesVal += exp.amount;
    } else {
      personalExpensesVal += exp.amount;
    }
    if (exp.shared === true) {
      sharedExpensesVal += exp.amount;
      if (isBusiness) {
        sharedBusinessExpensesVal += exp.amount;
      } else {
        sharedPersonalExpensesVal += exp.amount;
      }
    } else {
      privateExpensesVal += exp.amount;
      if (isBusiness) {
        privateBusinessExpensesVal += exp.amount;
      } else {
        privatePersonalExpensesVal += exp.amount;
      }
    }
  });

  const revenues = totalSalesVal - totalExpensesVal;
  const sharedRevenues = sharedSalesVal - sharedExpensesVal;
  const privateRevenues = privateSalesVal - privateExpensesVal;

  // Most Selling Products
  const productCounts: {
    [id: string]: { name: string; quantity: number; revenue: number };
  } = {};
  filteredSales.forEach((sale) => {
    sale.products.forEach((p) => {
      if (!productCounts[p.productId]) {
        productCounts[p.productId] = {
          name: p.name,
          quantity: 0,
          revenue: 0,
        };
      }
      productCounts[p.productId].quantity += p.quantity;
      productCounts[p.productId].revenue += p.price * p.quantity;
    });
  });

  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    customerCount: customerSet.size,
    sharedCustomerCount: sharedCustomerSet.size,
    privateCustomerCount: privateCustomerSet.size,
    totalSales: totalSalesVal,
    sharedSales: sharedSalesVal,
    privateSales: privateSalesVal,
    totalExpenses: totalExpensesVal,
    sharedExpenses: sharedExpensesVal,
    privateExpenses: privateExpensesVal,
    businessExpenses: businessExpensesVal,
    personalExpenses: personalExpensesVal,
    sharedBusinessExpenses: sharedBusinessExpensesVal,
    sharedPersonalExpenses: sharedPersonalExpensesVal,
    privateBusinessExpenses: privateBusinessExpensesVal,
    privatePersonalExpenses: privatePersonalExpensesVal,
    revenues,
    sharedRevenues,
    privateRevenues,
    topProducts,
  };
};

type FilterType = "week" | "month" | "90days" | "1year" | "custom";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // Admin-only: accounts and adjustments
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adjustments, setAdjustments] = useState<AccountAdjustment[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingAdjustments, setLoadingAdjustments] = useState(true);

  // Filter State
  const [filter, setFilter] = useState<FilterType>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Subscriptions
  useEffect(() => {
    if (!profile) return;

    // Sales Subscription
    let salesQuery;
    if (profile.role === "admin") {
      salesQuery = query(collection(db, "sales"), orderBy("date", "asc"));
    } else {
      salesQuery = query(
        collection(db, "sales"),
        where("shared", "==", true),
        orderBy("date", "asc"),
      );
    }

    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const items: Sale[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Sale);
        });
        setSales(items);
        setLoadingSales(false);
      },
      (err) => {
        console.error("Sales snapshot error:", err);
        setLoadingSales(false);
      },
    );

    // Expenses Subscription
    let expensesQuery;
    if (profile.role === "admin") {
      expensesQuery = query(collection(db, "expenses"), orderBy("date", "asc"));
    } else {
      expensesQuery = query(
        collection(db, "expenses"),
        where("shared", "==", true),
        orderBy("date", "asc"),
      );
    }

    const unsubExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const items: Expense[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Expense);
        });
        setExpenses(items);
        setLoadingExpenses(false);
      },
      (err) => {
        console.error("Expenses snapshot error:", err);
        setLoadingExpenses(false);
      },
    );

    // Admin-only: Accounts subscription
    let unsubAccounts: (() => void) | null = null;
    let unsubAdjustments: (() => void) | null = null;

    if (profile.role === "admin") {
      const accountsQuery = query(
        collection(db, "accounts"),
        orderBy("name", "asc"),
      );
      unsubAccounts = onSnapshot(
        accountsQuery,
        (snapshot) => {
          const items: Account[] = [];
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as Account);
          });
          setAccounts(items);
          setLoadingAccounts(false);
        },
        (err) => {
          console.error("Accounts snapshot error:", err);
          setLoadingAccounts(false);
        },
      );

      const adjustmentsQuery = query(
        collection(db, "account_adjustments"),
        orderBy("createdAt", "desc"),
      );
      unsubAdjustments = onSnapshot(
        adjustmentsQuery,
        (snapshot) => {
          const items: AccountAdjustment[] = [];
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as AccountAdjustment);
          });
          setAdjustments(items);
          setLoadingAdjustments(false);
        },
        (err) => {
          console.error("Adjustments snapshot error:", err);
          setLoadingAdjustments(false);
        },
      );
    } else {
      setLoadingAccounts(false);
      setLoadingAdjustments(false);
    }

    return () => {
      unsubSales();
      unsubExpenses();
      unsubAccounts?.();
      unsubAdjustments?.();
    };
  }, [profile]);

  // Compute date boundaries
  const dateRange = useMemo(() => {
    const today = new Date();
    const start = new Date();

    if (filter === "custom") {
      const startBound = startDate ? new Date(startDate) : new Date(0);
      const endBound = endDate ? new Date(endDate) : new Date();
      // Set hours to cover the entire day
      startBound.setHours(0, 0, 0, 0);
      endBound.setHours(23, 59, 59, 999);
      return { start: startBound, end: endBound };
    }

    today.setHours(23, 59, 59, 999);

    switch (filter) {
      case "week":
        start.setDate(today.getDate() - 7);
        break;
      case "month":
        start.setDate(today.getDate() - 30);
        break;
      case "90days":
        start.setDate(today.getDate() - 90);
        break;
      case "1year":
        start.setDate(today.getDate() - 365);
        break;
    }
    start.setHours(0, 0, 0, 0);
    return { start, end: today };
  }, [filter, startDate, endDate]);

  // Filter lists based on date range
  const filteredData = useMemo(() => {
    const { start, end } = dateRange;

    const filteredSales = sales.filter((sale) => {
      const sDate = new Date(sale.date);
      return sDate >= start && sDate <= end;
    });

    const filteredExpenses = expenses.filter((expense) => {
      const eDate = new Date(expense.date);
      return eDate >= start && eDate <= end;
    });

    return { filteredSales, filteredExpenses };
  }, [sales, expenses, dateRange]);

  // Compute Metrics
  const metrics = useMemo(() => {
    const { filteredSales, filteredExpenses } = filteredData;
    return computeMetrics(filteredSales, filteredExpenses);
  }, [filteredData]);

  // Filter lists based on date range for previous period
  const previousFilteredData = useMemo(() => {
    const { start, end } = dateRange;
    const durationMs = end.getTime() - start.getTime() + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs + 1);

    const prevFilteredSales = sales.filter((sale) => {
      const sDate = new Date(sale.date);
      return sDate >= prevStart && sDate <= prevEnd;
    });

    const prevFilteredExpenses = expenses.filter((expense) => {
      const eDate = new Date(expense.date);
      return eDate >= prevStart && eDate <= prevEnd;
    });

    return { prevFilteredSales, prevFilteredExpenses };
  }, [sales, expenses, dateRange]);

  // Compute Previous Metrics
  const prevMetrics = useMemo(() => {
    const { prevFilteredSales, prevFilteredExpenses } = previousFilteredData;
    return computeMetrics(prevFilteredSales, prevFilteredExpenses);
  }, [previousFilteredData]);

  const showCompare =
    filter !== "custom" || (startDate !== "" && endDate !== "");

  // Format chart data by day / date
  const chartData = useMemo(() => {
    const { filteredSales, filteredExpenses } = filteredData;
    const dailyMap: {
      [date: string]: {
        date: string;
        sales: number;
        expenses: number;
        sharedSales: number;
        privateSales: number;
        sharedExpenses: number;
        privateExpenses: number;
      };
    } = {};

    // Populate dates
    filteredSales.forEach((sale) => {
      if (!dailyMap[sale.date]) {
        dailyMap[sale.date] = {
          date: sale.date,
          sales: 0,
          expenses: 0,
          sharedSales: 0,
          privateSales: 0,
          sharedExpenses: 0,
          privateExpenses: 0,
        };
      }
      dailyMap[sale.date].sales += sale.total;
      if (sale.shared === true) {
        dailyMap[sale.date].sharedSales += sale.total;
      } else {
        dailyMap[sale.date].privateSales += sale.total;
      }
    });

    filteredExpenses.forEach((exp) => {
      if (!dailyMap[exp.date]) {
        dailyMap[exp.date] = {
          date: exp.date,
          sales: 0,
          expenses: 0,
          sharedSales: 0,
          privateSales: 0,
          sharedExpenses: 0,
          privateExpenses: 0,
        };
      }
      dailyMap[exp.date].expenses += exp.amount;
      if (exp.shared === true) {
        dailyMap[exp.date].sharedExpenses += exp.amount;
      } else {
        dailyMap[exp.date].privateExpenses += exp.amount;
      }
    });

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // Admin-only: total available balance from all accounts
  const totalAvailableBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  }, [accounts]);

  // Admin-only: total external adjustments (cash-in minus cash-out)
  const totalAdjustments = useMemo(() => {
    return adjustments.reduce((sum, adj) => {
      return sum + (adj.type === "in" ? adj.amount : -adj.amount);
    }, 0);
  }, [adjustments]);

  const totalAdjustmentCashIn = useMemo(() => {
    return adjustments.reduce((sum, adj) => {
      return sum + (adj.type === "in" ? adj.amount : 0);
    }, 0);
  }, [adjustments]);

  const totalAdjustmentCashOut = useMemo(() => {
    return adjustments.reduce((sum, adj) => {
      return sum + (adj.type === "out" ? adj.amount : 0);
    }, 0);
  }, [adjustments]);

  const loading =
    loadingSales || loadingExpenses || loadingAccounts || loadingAdjustments;

  return (
    <NavLayout>
      <div className="space-y-6">
        {/* Top bar with filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-sans tracking-tight">
              Performance Dashboard
            </h2>
            <p className="text-sm text-muted-foreground font-sans">
              Financial performance summaries and charts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filter === "custom" && (
              <div className="flex items-center gap-2 border border-border rounded px-2 py-1 bg-card">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-none h-7 p-0 focus-visible:ring-0 text-xs w-28"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border-none h-7 p-0 focus-visible:ring-0 text-xs w-28"
                />
              </div>
            )}
            <Select
              value={filter}
              onValueChange={(val: FilterType) => setFilter(val)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="1year">Last 1 Year</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">
                    Total Sales
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex flex-col items-baseline gap-2">
                    <span className="text-2xl font-bold font-sans">
                      Ks {metrics.totalSales.toLocaleString()}
                    </span>
                    {showCompare && (
                      <CompareBadge
                        current={metrics.totalSales}
                        previous={prevMetrics.totalSales}
                        isCurrency={true}
                        isExpense={false}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    In selected period
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">
                    Total Expenses
                  </CardTitle>
                  <Wallet className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex flex-col items-baseline gap-2">
                    <span className="text-2xl font-bold font-sans">
                      Ks {metrics.totalExpenses.toLocaleString()}
                    </span>
                    {showCompare && (
                      <CompareBadge
                        current={metrics.totalExpenses}
                        previous={prevMetrics.totalExpenses}
                        isCurrency={true}
                        isExpense={true}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                      Biz: Ks {metrics.businessExpenses.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                      Personal: Ks {metrics.personalExpenses.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">
                    Net Profit
                  </CardTitle>
                  <Coins
                    className={`h-4 w-4 ${metrics.revenues >= 0 ? "text-green-500" : "text-red-500"}`}
                  />
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex flex-col items-baseline gap-2">
                    <span className="text-2xl font-bold font-sans">
                      Ks {metrics.revenues.toLocaleString()}
                    </span>
                    {showCompare && (
                      <CompareBadge
                        current={metrics.revenues}
                        previous={prevMetrics.revenues}
                        isCurrency={true}
                        isExpense={false}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    Sales minus spends
                  </p>
                </CardContent>
              </Card>

              {profile?.role === "admin" ? (
                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium font-sans">
                      Total Available Balance
                    </CardTitle>
                    <Banknote className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <div className="flex flex-col items-baseline gap-2">
                      <span className="text-2xl font-bold font-sans">
                        Ks {totalAvailableBalance.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-sans">
                      Sum of all account balances
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium font-sans">
                      Customers Count
                    </CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <div className="flex flex-col items-baseline gap-2">
                      <span className="text-2xl font-bold font-sans">
                        {metrics.customerCount}
                      </span>
                      {showCompare && (
                        <CompareBadge
                          current={metrics.customerCount}
                          previous={prevMetrics.customerCount}
                          isCurrency={false}
                          isExpense={false}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-sans">
                      Distinct buying users
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Admin-only Detailed Breakdown Grid */}
            {profile?.role === "admin" && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-muted-foreground tracking-wider font-sans">
                    Admin Details (Public vs Personal)
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {/* Shared Sales (Mobile order-1, Desktop lg:order-1) */}
                  <Card className="col-span-1 order-1 lg:order-1 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Public Sales
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.sharedSales.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.sharedSales}
                            previous={prevMetrics.sharedSales}
                            isCurrency={true}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Visible to all users
                      </p>
                    </CardContent>
                  </Card>

                  {/* Private Sales (Mobile order-2, Desktop lg:order-5) */}
                  <Card className="col-span-1 order-2 lg:order-5 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Personal Sales
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.privateSales.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.privateSales}
                            previous={prevMetrics.privateSales}
                            isCurrency={true}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Private to owner
                      </p>
                    </CardContent>
                  </Card>

                  {/* Shared Expenses (Mobile order-3, Desktop lg:order-2) */}
                  <Card className="col-span-1 order-3 lg:order-2 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Public Expenses
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.sharedExpenses.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.sharedExpenses}
                            previous={prevMetrics.sharedExpenses}
                            isCurrency={true}
                            isExpense={true}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                          Biz: Ks{" "}
                          {metrics.sharedBusinessExpenses.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                          Personal: Ks{" "}
                          {metrics.sharedPersonalExpenses.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Private Expenses (Mobile order-4, Desktop lg:order-6) */}
                  <Card className="col-span-1 order-4 lg:order-6 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Personal Expenses
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.privateExpenses.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.privateExpenses}
                            previous={prevMetrics.privateExpenses}
                            isCurrency={true}
                            isExpense={true}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                          Biz: Ks{" "}
                          {metrics.privateBusinessExpenses.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                          Personal: Ks{" "}
                          {metrics.privatePersonalExpenses.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shared Revenues (Mobile order-5, Desktop lg:order-3) */}
                  <Card className="col-span-1 order-5 lg:order-3 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Public Net Profit
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.sharedRevenues.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.sharedRevenues}
                            previous={prevMetrics.sharedRevenues}
                            isCurrency={true}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Public sales minus spends
                      </p>
                    </CardContent>
                  </Card>

                  {/* Private Revenues (Mobile order-6, Desktop lg:order-7) */}
                  <Card className="col-span-1 order-6 lg:order-7 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Personal Net Profit (Remaining Balance)
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          Ks {metrics.privateRevenues.toLocaleString()}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.privateRevenues}
                            previous={prevMetrics.privateRevenues}
                            isCurrency={true}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Personal sales minus expenses
                      </p>
                    </CardContent>
                  </Card>

                  {/* Hidden vs Visible Ratio (Mobile order-7, Desktop lg:order-4) */}
                  <Card className="col-span-1 order-7 lg:order-4 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Public vs Hidden Ratio
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-lg font-bold font-sans">
                            {metrics.sharedCustomerCount}
                          </span>
                        </div>
                        <span className="text-muted-foreground font-sans text-sm">
                          :
                        </span>
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="h-3.5 w-3.5 text-rose-400" />
                          <span className="text-lg font-bold font-sans">
                            {metrics.privateCustomerCount}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Public vs Hidden customer records
                      </p>
                    </CardContent>
                  </Card>

                  {/* Total Adjustments / External Cash-in (Mobile order-8, Desktop lg:order-8) */}
                  <Card className="col-span-1 order-8 lg:order-8 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Total Adjustments / External Cash-in
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span
                          className={`text-lg font-bold font-sans ${totalAdjustments >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {totalAdjustments >= 0 ? "+" : ""}Ks{" "}
                          {totalAdjustments.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                          In: Ks {totalAdjustmentCashIn.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ArrowDown className="h-3 w-3 text-rose-500" />
                          Out: Ks {totalAdjustmentCashOut.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Chart and Top Selling Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Chart */}
              <Card className="lg:col-span-2 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-md font-sans">
                    Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-xs font-sans">
                    Total daily sales vs expenses breakdown.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] pl-0">
                  {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                      No data to chart.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis
                          dataKey="date"
                          stroke="#888888"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatDateLabel}
                        />
                        <YAxis
                          stroke="#888888"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) =>
                            `Ks ${value.toLocaleString()}`
                          }
                        />
                        <Tooltip
                          formatter={(value) => [
                            `Ks ${Number(value).toLocaleString()}`,
                          ]}
                          labelFormatter={formatDateLabel}
                          contentStyle={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="sales"
                          name="Total Sales"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="expenses"
                          name="Total Expenses"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-md font-sans">
                    Top Selling Products
                  </CardTitle>
                  <CardDescription className="text-xs font-sans font-normal">
                    Most purchased items by volume.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {metrics.topProducts.length === 0 ? (
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm font-sans">
                      No products sold in this period.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.topProducts.map((p, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium max-w-[120px] truncate">
                              {p.name}
                            </TableCell>
                            <TableCell className="text-center font-sans">
                              {p.quantity}
                            </TableCell>
                            <TableCell className="text-right font-bold font-sans">
                              Ks {p.revenue.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Admin-only Detailed Analytics Charts */}
            {profile?.role === "admin" && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                    Admin Analytics (Trends)
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Shared Sale vs Private Sale Line Chart */}
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-sans">
                        Public Sales vs Personal Sales
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Daily breakdown of public vs personal sales.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] pl-0">
                      {chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                          No data to chart.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <XAxis
                              dataKey="date"
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatDateLabel}
                            />
                            <YAxis
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                `Ks ${value.toLocaleString()}`
                              }
                            />
                            <Tooltip
                              formatter={(value) => [
                                `Ks ${Number(value).toLocaleString()}`,
                              ]}
                              labelFormatter={formatDateLabel}
                              contentStyle={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line
                              type="monotone"
                              dataKey="sharedSales"
                              name="Public Sales"
                              stroke="#10B981"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="privateSales"
                              name="Personal Sales"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Shared Sale vs Shared Expenses Line Chart */}
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-sans">
                        Public Sales vs Expenses
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Daily comparison of public sales against public
                        expenditures.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] pl-0">
                      {chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                          No data to chart.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <XAxis
                              dataKey="date"
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatDateLabel}
                            />
                            <YAxis
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                `Ks ${value.toLocaleString()}`
                              }
                            />
                            <Tooltip
                              formatter={(value) => [
                                `Ks ${Number(value).toLocaleString()}`,
                              ]}
                              labelFormatter={formatDateLabel}
                              contentStyle={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line
                              type="monotone"
                              dataKey="sharedSales"
                              name="Public Sales"
                              stroke="#10B981"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="sharedExpenses"
                              name="Public Expenses"
                              stroke="#EF4444"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Personal Sales vs Personal Expenses Line Chart */}
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-sans">
                        Personal Sales vs Expenses
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Daily breakdown of personal (hidden) sales against
                        expenses.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] pl-0">
                      {chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                          No data to chart.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <XAxis
                              dataKey="date"
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatDateLabel}
                            />
                            <YAxis
                              stroke="#888888"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                `Ks ${value.toLocaleString()}`
                              }
                            />
                            <Tooltip
                              formatter={(value) => [
                                `Ks ${Number(value).toLocaleString()}`,
                              ]}
                              labelFormatter={formatDateLabel}
                              contentStyle={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line
                              type="monotone"
                              dataKey="privateSales"
                              name="Personal Sales"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="privateExpenses"
                              name="Personal Expenses"
                              stroke="#EF4444"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expense Breakdown Pie Chart */}
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-sans">
                        Expense Breakdown
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Business vs Personal expense distribution.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {metrics.totalExpenses === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                          No expenses in this period.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: "Business",
                                  value: metrics.businessExpenses,
                                },
                                {
                                  name: "Personal",
                                  value: metrics.personalExpenses,
                                },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                              }
                              labelLine={false}
                            >
                              <Cell fill="#3B82F6" />
                              <Cell fill="#F59E0B" />
                            </Pie>
                            <Tooltip
                              formatter={(value) => [
                                `Ks ${Number(value).toLocaleString()}`,
                              ]}
                              contentStyle={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 12 }}
                              formatter={(value) => (
                                <span className="font-sans text-sm">
                                  {value}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </NavLayout>
  );
}
