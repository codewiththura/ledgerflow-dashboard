"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NavLayout } from "@/components/nav-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Wallet
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

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
  createdAt: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  approved: boolean;
  createdAt: string;
}

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
        orderBy("date", "asc")
      );
    }

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const items: Sale[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(items);
      setLoadingSales(false);
    }, (err) => {
      console.error("Sales snapshot error:", err);
      setLoadingSales(false);
    });

    // Expenses Subscription
    let expensesQuery;
    if (profile.role === "admin") {
      expensesQuery = query(collection(db, "expenses"), orderBy("date", "asc"));
    } else {
      expensesQuery = query(
        collection(db, "expenses"), 
        where("shared", "==", true),
        orderBy("date", "asc")
      );
    }

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const items: Expense[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(items);
      setLoadingExpenses(false);
    }, (err) => {
      console.error("Expenses snapshot error:", err);
      setLoadingExpenses(false);
    });

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

    // Distinct Customers
    const customerSet = new Set<string>();
    let totalSalesVal = 0;
    filteredSales.forEach((sale) => {
      if (sale.customerSocialName) {
        customerSet.add(sale.customerSocialName.trim().toLowerCase());
      }
      totalSalesVal += sale.total;
    });

    let totalExpensesVal = 0;
    filteredExpenses.forEach((exp) => {
      totalExpensesVal += exp.amount;
    });

    const revenues = totalSalesVal - totalExpensesVal;

    // Most Selling Products
    const productCounts: { [id: string]: { name: string; quantity: number; revenue: number } } = {};
    filteredSales.forEach((sale) => {
      sale.products.forEach((p) => {
        if (!productCounts[p.productId]) {
          productCounts[p.productId] = { name: p.name, quantity: 0, revenue: 0 };
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
      totalSales: totalSalesVal,
      totalExpenses: totalExpensesVal,
      revenues,
      topProducts
    };
  }, [filteredData]);

  // Format chart data by day / date
  const chartData = useMemo(() => {
    const { filteredSales, filteredExpenses } = filteredData;
    const dailyMap: { [date: string]: { date: string; sales: number; expenses: number } } = {};

    // Populate dates
    filteredSales.forEach((sale) => {
      if (!dailyMap[sale.date]) {
        dailyMap[sale.date] = { date: sale.date, sales: 0, expenses: 0 };
      }
      dailyMap[sale.date].sales += sale.total;
    });

    filteredExpenses.forEach((exp) => {
      if (!dailyMap[exp.date]) {
        dailyMap[exp.date] = { date: exp.date, sales: 0, expenses: 0 };
      }
      dailyMap[exp.date].expenses += exp.amount;
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
            <h2 className="text-xl font-bold font-sans tracking-tight">Performance Dashboard</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Financial performance summaries and charts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filter === "custom" && (
              <div className="flex items-center gap-2 border border-border rounded px-2 py-1 bg-card">
                <Calendar className="h-4 w-4 text-muted-foreground" />
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
            <Select value={filter} onValueChange={(val: FilterType) => setFilter(val)}>
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
                  <CardTitle className="text-sm font-medium font-sans">Total Sales</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-sans">${metrics.totalSales.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground font-sans">In selected period</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">Total Expenses</CardTitle>
                  <Wallet className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-sans">${metrics.totalExpenses.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground font-sans font-normal">Operational spends</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">Net Revenues</CardTitle>
                  <DollarSign className={`h-4 w-4 ${metrics.revenues >= 0 ? "text-green-500" : "text-red-500"}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-sans">${metrics.revenues.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground font-sans">Sales minus spends</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium font-sans">Customers Count</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-sans">{metrics.customerCount}</div>
                  <p className="text-xs text-muted-foreground font-sans">Distinct buying users</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart and Top Selling Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Chart */}
              <Card className="lg:col-span-2 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-md font-sans">Revenue Trend</CardTitle>
                  <CardDescription className="text-xs font-sans">Daily sales vs expenses breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] pl-0">
                  {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-sans">
                      No data to chart.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-md font-sans">Top Selling Products</CardTitle>
                  <CardDescription className="text-xs font-sans font-normal">Most purchased items by volume.</CardDescription>
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
                            <TableCell className="font-medium max-w-[120px] truncate">{p.name}</TableCell>
                            <TableCell className="text-center font-sans">{p.quantity}</TableCell>
                            <TableCell className="text-right font-bold font-sans">${p.revenue.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </NavLayout>
  );
}
