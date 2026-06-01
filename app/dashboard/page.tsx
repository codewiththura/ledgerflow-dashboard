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
  transactionMethod: "Kpay" | "Aya";
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
  filteredExpenses.forEach((exp) => {
    totalExpensesVal += exp.amount;
    if (exp.shared === true) {
      sharedExpensesVal += exp.amount;
    } else {
      privateExpensesVal += exp.amount;
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

    return () => {
      unsubSales();
      unsubExpenses();
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
        };
      }
      dailyMap[exp.date].expenses += exp.amount;
      if (exp.shared === true) {
        dailyMap[exp.date].sharedExpenses += exp.amount;
      }
    });

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const loading = loadingSales || loadingExpenses;

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
                  <p className="text-xs text-muted-foreground font-sans font-normal">
                    Operational spends
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">
                    Net Revenues
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
            </div>

            {/* Admin-only Detailed Breakdown Grid */}
            {profile?.role === "admin" && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                    Admin Details (Shared vs Private)
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {/* Shared Sales (Mobile order-1, Desktop lg:order-1) */}
                  <Card className="col-span-1 order-1 lg:order-1 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Shared Sales
                        </CardTitle>
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-500/70" />
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
                          Private Sales
                        </CardTitle>
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600/50" />
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
                          Shared Expenses
                        </CardTitle>
                      </div>
                      <Wallet className="h-4 w-4 text-red-500/70" />
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
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Visible to all users
                      </p>
                    </CardContent>
                  </Card>

                  {/* Private Expenses (Mobile order-4, Desktop lg:order-6) */}
                  <Card className="col-span-1 order-4 lg:order-6 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Private Expenses
                        </CardTitle>
                      </div>
                      <Wallet className="h-4 w-4 text-red-600/50" />
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
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Private to owner
                      </p>
                    </CardContent>
                  </Card>

                  {/* Shared Revenues (Mobile order-5, Desktop lg:order-3) */}
                  <Card className="col-span-1 order-5 lg:order-3 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Shared Revenues
                        </CardTitle>
                      </div>
                      <Coins className="h-4 w-4 text-violet-500" />
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
                        Shared sales minus spends
                      </p>
                    </CardContent>
                  </Card>

                  {/* Private Revenues (Mobile order-6, Desktop lg:order-7) */}
                  <Card className="col-span-1 order-6 lg:order-7 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Private Revenues
                        </CardTitle>
                      </div>
                      <Coins className="h-4 w-4 text-fuchsia-500" />
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
                        Private sales minus spends
                      </p>
                    </CardContent>
                  </Card>

                  {/* Shared Customers (Mobile order-7, Desktop lg:order-4) */}
                  <Card className="col-span-1 order-7 lg:order-4 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Shared Customers
                        </CardTitle>
                      </div>
                      <Users className="h-4 w-4 text-blue-500/70" />
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          {metrics.sharedCustomerCount}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.sharedCustomerCount}
                            previous={prevMetrics.sharedCustomerCount}
                            isCurrency={false}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Customers from shared transactions
                      </p>
                    </CardContent>
                  </Card>

                  {/* Private Customers (Mobile order-8, Desktop lg:order-8) */}
                  <Card className="col-span-1 order-8 lg:order-8 border-border shadow-sm bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium font-sans text-muted-foreground">
                          Private Customers
                        </CardTitle>
                      </div>
                      <Users className="h-4 w-4 text-blue-600/50" />
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex flex-col items-baseline gap-2">
                        <span className="text-lg font-bold font-sans">
                          {metrics.privateCustomerCount}
                        </span>
                        {showCompare && (
                          <CompareBadge
                            current={metrics.privateCustomerCount}
                            previous={prevMetrics.privateCustomerCount}
                            isCurrency={false}
                            isExpense={false}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-sans font-normal">
                        Customers from private transactions
                      </p>
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
                    Daily sales vs expenses breakdown.
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
                          name="Sales"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="expenses"
                          name="Expenses"
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
                        Shared Sales vs Private Sales
                      </CardTitle>
                      <CardDescription className="text-xs font-sans">
                        Daily breakdown of public vs private sales.
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
                              name="Shared Sales"
                              stroke="#10B981"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="privateSales"
                              name="Private Sales"
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
                        Shared Sales vs Shared Expenses
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
                              name="Shared Sales"
                              stroke="#10B981"
                              strokeWidth={2}
                              activeDot={{ r: 6 }}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="sharedExpenses"
                              name="Shared Expenses"
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
              </div>
            )}
          </>
        )}
      </div>
    </NavLayout>
  );
}
