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
  deleteDoc,
  getDocs
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
import { Check, Plus, Trash2, Eye, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ProductItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Sale {
  id: string;
  customerSocialName: string;
  customerEmail: string;
  transactionName: string;
  transactionMethod: "Kpay" | "Aya";
  date: string;
  products: ProductItem[];
  subtotal: number;
  total: number;
  approved: boolean;
  createdBy: string;
  createdAt: string;
}

interface ProductCatalogItem {
  id: string;
  name: string;
  price: number;
}

export default function SalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [productsCatalog, setProductsCatalog] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog Open states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Custom delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saleIdToDelete, setSaleIdToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Creation form fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [transactionName, setTransactionName] = useState("");
  const [transactionMethod, setTransactionMethod] = useState<"Kpay" | "Aya">("Kpay");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saleItems, setSaleItems] = useState<{ productId: string; price: string; quantity: string }[]>([
    { productId: "", price: "", quantity: "1" }
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editing form fields
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editTransactionName, setEditTransactionName] = useState("");
  const [editTransactionMethod, setEditTransactionMethod] = useState<"Kpay" | "Aya">("Kpay");
  const [editDate, setEditDate] = useState("");
  const [editSaleItems, setEditSaleItems] = useState<{ productId: string; price: string; quantity: string }[]>([]);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch sales list
  useEffect(() => {
    if (!profile) return;

    let salesQuery;
    if (profile.role === "admin") {
      salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
    } else {
      salesQuery = query(
        collection(db, "sales"), 
        where("approved", "==", true),
        orderBy("date", "desc")
      );
    }

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const items: Sale[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({ 
          id: doc.id, 
          customerSocialName: data.customerSocialName || "",
          customerEmail: data.customerEmail || "",
          transactionName: data.transactionName,
          transactionMethod: data.transactionMethod,
          date: data.date,
          products: data.products || [],
          subtotal: data.subtotal || 0,
          total: data.total || 0,
          approved: data.approved,
          createdBy: data.createdBy,
          createdAt: data.createdAt
        } as Sale);
      });
      setSales(items);
      setLoading(false);
    }, (error) => {
      console.error("Sales subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const fetchProductsCatalog = async () => {
      try {
        const q = query(collection(db, "products"), where("approved", "==", true));
        const snap = await getDocs(q);
        const list: ProductCatalogItem[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, name: data.name, price: data.price });
        });
        setProductsCatalog(list);
      } catch (err) {
        console.error("Error fetching products catalog:", err);
      }
    };

    if (createDialogOpen || editDialogOpen) {
      fetchProductsCatalog();
    }
  }, [createDialogOpen, editDialogOpen]);

  // Calculations for Creation Form
  const calculateTotals = () => {
    let subtotal = 0;
    saleItems.forEach((item) => {
      const priceVal = parseFloat(item.price) || 0;
      const qtyVal = parseInt(item.quantity) || 0;
      subtotal += priceVal * qtyVal;
    });
    return { subtotal, total: subtotal };
  };

  const { subtotal: calculatedSubtotal, total: calculatedTotal } = calculateTotals();

  // Calculations for Edit Form
  const calculateEditTotals = () => {
    let subtotal = 0;
    editSaleItems.forEach((item) => {
      const priceVal = parseFloat(item.price) || 0;
      const qtyVal = parseInt(item.quantity) || 0;
      subtotal += priceVal * qtyVal;
    });
    return { subtotal, total: subtotal };
  };

  const { subtotal: editCalculatedSubtotal, total: editCalculatedTotal } = calculateEditTotals();

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      productId,
      price: selectedProd.price.toString()
    };
    setSaleItems(newItems);
  };

  const handleEditProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const newItems = [...editSaleItems];
    newItems[index] = {
      ...newItems[index],
      productId,
      price: selectedProd.price.toString()
    };
    setEditSaleItems(newItems);
  };

  const handleItemChange = (index: number, key: "price" | "quantity", value: string) => {
    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      [key]: value
    };
    setSaleItems(newItems);
  };

  const handleEditItemChange = (index: number, key: "price" | "quantity", value: string) => {
    const newItems = [...editSaleItems];
    newItems[index] = {
      ...newItems[index],
      [key]: value
    };
    setEditSaleItems(newItems);
  };

  const handleAddItemRow = () => {
    setSaleItems([...saleItems, { productId: "", price: "", quantity: "1" }]);
  };

  const handleAddEditItemRow = () => {
    setEditSaleItems([...editSaleItems, { productId: "", price: "", quantity: "1" }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (saleItems.length === 1) return;
    const newItems = saleItems.filter((_, i) => i !== index);
    setSaleItems(newItems);
  };

  const handleRemoveEditItemRow = (index: number) => {
    if (editSaleItems.length === 1) return;
    const newItems = editSaleItems.filter((_, i) => i !== index);
    setEditSaleItems(newItems);
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerEmail.trim()) {
      setFormError("Customer email is required.");
      return;
    }
    if (!transactionName.trim()) {
      setFormError("Transaction name/description is required.");
      return;
    }
    if (!date) {
      setFormError("Date is required.");
      return;
    }

    const preparedProducts: ProductItem[] = [];
    for (const item of saleItems) {
      if (!item.productId) {
        setFormError("Please select a product for all rows.");
        return;
      }
      const pPrice = parseFloat(item.price);
      const pQty = parseInt(item.quantity);
      if (isNaN(pPrice) || pPrice < 0) {
        setFormError("Product price must be a valid positive number.");
        return;
      }
      if (isNaN(pQty) || pQty <= 0) {
        setFormError("Quantity must be greater than zero.");
        return;
      }

      const originalProduct = productsCatalog.find((p) => p.id === item.productId);
      preparedProducts.push({
        productId: item.productId,
        name: originalProduct?.name || "Unknown Product",
        price: pPrice,
        quantity: pQty
      });
    }

    setSubmitting(true);
    try {
      const isApproved = profile?.role === "admin";
      const { subtotal, total } = calculateTotals();

      await addDoc(collection(db, "sales"), {
        customerSocialName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        transactionName: transactionName.trim(),
        transactionMethod,
        date,
        products: preparedProducts,
        subtotal,
        total,
        approved: isApproved,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });

      // Reset form
      setCustomerName("");
      setCustomerEmail("");
      setTransactionName("");
      setTransactionMethod("Kpay");
      setDate(new Date().toISOString().split("T")[0]);
      setSaleItems([{ productId: "", price: "", quantity: "1" }]);
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Error creating sale record:", err);
      setFormError("Failed to save sale transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerSocialName);
    setEditCustomerEmail(sale.customerEmail);
    setEditTransactionName(sale.transactionName);
    setEditTransactionMethod(sale.transactionMethod);
    setEditDate(sale.date);
    
    // Map existing products in sale to form item states
    const items = sale.products.map(p => ({
      productId: p.productId,
      price: p.price.toString(),
      quantity: p.quantity.toString()
    }));
    setEditSaleItems(items);
    setEditFormError(null);
    setEditDialogOpen(true);
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    setEditFormError(null);

    if (!editCustomerEmail.trim()) {
      setEditFormError("Customer email is required.");
      return;
    }
    if (!editTransactionName.trim()) {
      setEditFormError("Transaction name/description is required.");
      return;
    }
    if (!editDate) {
      setEditFormError("Date is required.");
      return;
    }

    const preparedProducts: ProductItem[] = [];
    for (const item of editSaleItems) {
      if (!item.productId) {
        setEditFormError("Please select a product for all rows.");
        return;
      }
      const pPrice = parseFloat(item.price);
      const pQty = parseInt(item.quantity);
      if (isNaN(pPrice) || pPrice < 0) {
        setEditFormError("Product price must be a valid positive number.");
        return;
      }
      if (isNaN(pQty) || pQty <= 0) {
        setEditFormError("Quantity must be greater than zero.");
        return;
      }

      const originalProduct = productsCatalog.find((p) => p.id === item.productId);
      preparedProducts.push({
        productId: item.productId,
        name: originalProduct?.name || "Unknown Product",
        price: pPrice,
        quantity: pQty
      });
    }

    setUpdating(true);
    try {
      const { subtotal, total } = calculateEditTotals();
      await updateDoc(doc(db, "sales", editingSale.id), {
        customerSocialName: editCustomerName.trim(),
        customerEmail: editCustomerEmail.trim(),
        transactionName: editTransactionName.trim(),
        transactionMethod: editTransactionMethod,
        date: editDate,
        products: preparedProducts,
        subtotal,
        total,
      });

      setEditDialogOpen(false);
      setEditingSale(null);
    } catch (err) {
      console.error("Error updating sale record:", err);
      setEditFormError("Failed to update sale transaction.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "sales", id), { approved: true });
    } catch (err) {
      console.error("Error approving sale:", err);
    }
  };

  const triggerDelete = (id: string) => {
    setSaleIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!saleIdToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "sales", saleIdToDelete));
      setDeleteConfirmOpen(false);
      setSaleIdToDelete(null);
    } catch (err) {
      console.error("Error deleting sale record:", err);
    } finally {
      setDeleting(false);
    }
  };

  const openViewDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setViewDialogOpen(true);
  };

  return (
    <NavLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-sans tracking-tight">Sales List</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Record and view customer transaction data.
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Sale</DialogTitle>
                <DialogDescription>
                  Create a new customer sale record.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSale} className="space-y-4 py-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="customerName">Customer Social Name</RequiredLabel>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="E.g. John Doe Facebook"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="customerEmail" required>Customer Email</RequiredLabel>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john.doe@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="transactionName" required>Transaction Name</RequiredLabel>
                    <Input
                      id="transactionName"
                      value={transactionName}
                      onChange={(e) => setTransactionName(e.target.value)}
                      placeholder="E.g. Invoice 12456"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="method" required>Transaction Method</RequiredLabel>
                    <Select
                      value={transactionMethod}
                      onValueChange={(val: "Kpay" | "Aya") => setTransactionMethod(val)}
                    >
                      <SelectTrigger id="method">
                        <SelectValue placeholder="Select Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kpay">Kpay</SelectItem>
                        <SelectItem value="Aya">Aya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <RequiredLabel required>Products Sold</RequiredLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItemRow}
                      className="text-xs h-7 px-2"
                      disabled={productsCatalog.length === 0}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Product
                    </Button>
                  </div>

                  {productsCatalog.length === 0 ? (
                    <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                      No approved products exist. Please add products and approve them first.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {saleItems.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:border-none sm:pb-0">
                          <div className="flex-1 w-full space-y-1 sm:space-y-0">
                            <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Product</RequiredLabel>
                            <Select
                              value={item.productId}
                              onValueChange={(val) => handleProductSelect(idx, val)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Product" />
                              </SelectTrigger>
                              <SelectContent>
                                {productsCatalog.map((prod) => (
                                  <SelectItem key={prod.id} value={prod.id}>
                                    {prod.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="w-full sm:w-24 grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-0">
                            <div className="space-y-1 sm:space-y-0">
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Price</RequiredLabel>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={item.price}
                                onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                                className="w-full text-right"
                              />
                            </div>
                          </div>

                          <div className="w-full sm:w-20 grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-0">
                            <div className="space-y-1 sm:space-y-0">
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Qty</RequiredLabel>
                              <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                className="w-full text-right"
                              />
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-destructive h-9 w-9 self-end"
                            disabled={saleItems.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end border-t border-border pt-4 text-sm font-sans space-y-1">
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-bold">${calculatedSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-4 text-base font-bold">
                    <span className="text-foreground">Total:</span>
                    <span className="text-primary">${calculatedTotal.toFixed(2)}</span>
                  </div>
                </div>

                <DialogFooter className="pt-4 gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || productsCatalog.length === 0}>
                    {submitting ? "Saving..." : "Save Sale"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Sales Log</CardTitle>
            <CardDescription className="text-xs font-sans">
              {sales.length} transactions stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-sans text-sm">
                No sales transactions found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    {profile?.role === "admin" && (
                      <TableHead className="text-center">Status</TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">{sale.date}</TableCell>
                      <TableCell className="font-medium">{sale.customerSocialName || "-"}</TableCell>
                      <TableCell>{sale.customerEmail}</TableCell>
                      <TableCell>{sale.transactionName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-sans font-normal border-border bg-muted/30">
                          {sale.transactionMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold font-sans">
                        ${sale.total.toFixed(2)}
                      </TableCell>
                      {profile?.role === "admin" && (
                        <TableCell className="text-center">
                          {sale.approved ? (
                            <Badge className="bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-none font-sans font-normal">
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400 border-none font-sans font-normal">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => openViewDialog(sale)}
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(profile?.role === "admin" || !sale.approved) && (
                            <Button
                              onClick={() => handleOpenEdit(sale)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-primary border-border"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {profile?.role === "admin" && (
                            <>
                              {!sale.approved && (
                                <Button
                                  onClick={() => handleApprove(sale.id)}
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() => triggerDelete(sale.id)}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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

      {/* Edit Sale Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sale Record</DialogTitle>
            <DialogDescription>
              Update the details of this sale.
            </DialogDescription>
          </DialogHeader>
          {editingSale && (
            <form onSubmit={handleUpdateSale} className="space-y-4 py-4">
              {editFormError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{editFormError}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerName">Customer Social Name</RequiredLabel>
                  <Input
                    id="editCustomerName"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="E.g. John Doe Facebook"
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerEmail" required>Customer Email</RequiredLabel>
                  <Input
                    id="editCustomerEmail"
                    type="email"
                    value={editCustomerEmail}
                    onChange={(e) => setEditCustomerEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editTransactionName" required>Transaction Name</RequiredLabel>
                  <Input
                    id="editTransactionName"
                    value={editTransactionName}
                    onChange={(e) => setEditTransactionName(e.target.value)}
                    placeholder="E.g. Invoice 12456"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editMethod" required>Transaction Method</RequiredLabel>
                  <Select
                    value={editTransactionMethod}
                    onValueChange={(val: "Kpay" | "Aya") => setEditTransactionMethod(val)}
                  >
                    <SelectTrigger id="editMethod">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kpay">Kpay</SelectItem>
                      <SelectItem value="Aya">Aya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editDate" required>Date</RequiredLabel>
                  <Input
                    id="editDate"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <RequiredLabel required>Products Sold</RequiredLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddEditItemRow}
                    className="text-xs h-7 px-2"
                    disabled={productsCatalog.length === 0}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Product
                  </Button>
                </div>

                {productsCatalog.length === 0 ? (
                  <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                    No approved products exist. Please add products and approve them first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editSaleItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:border-none sm:pb-0">
                        <div className="flex-1 w-full space-y-1 sm:space-y-0">
                          <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Product</RequiredLabel>
                          <Select
                            value={item.productId}
                            onValueChange={(val) => handleEditProductSelect(idx, val)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {productsCatalog.map((prod) => (
                                <SelectItem key={prod.id} value={prod.id}>
                                  {prod.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="w-full sm:w-24 grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-0">
                          <div className="space-y-1 sm:space-y-0">
                            <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Price</RequiredLabel>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={item.price}
                              onChange={(e) => handleEditItemChange(idx, "price", e.target.value)}
                              className="w-full text-right"
                            />
                          </div>
                        </div>

                        <div className="w-full sm:w-20 grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-0">
                          <div className="space-y-1 sm:space-y-0">
                            <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Qty</RequiredLabel>
                            <Input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={item.quantity}
                              onChange={(e) => handleEditItemChange(idx, "quantity", e.target.value)}
                              className="w-full text-right"
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEditItemRow(idx)}
                          className="text-destructive h-9 w-9 self-end"
                          disabled={editSaleItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end border-t border-border pt-4 text-sm font-sans space-y-1">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">${editCalculatedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">${editCalculatedTotal.toFixed(2)}</span>
                </div>
              </div>

              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating || productsCatalog.length === 0}>
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Sale Detail Viewer Modal */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              Full breakdown for {selectedSale?.customerSocialName || "No Name"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4 py-4 font-sans text-sm">
              <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-3">
                <span className="text-muted-foreground">Date:</span>
                <span className="text-right font-medium">{selectedSale.date}</span>
                
                <span className="text-muted-foreground">Customer:</span>
                <span className="text-right font-medium">{selectedSale.customerSocialName || "-"}</span>
                
                <span className="text-muted-foreground">Customer Email:</span>
                <span className="text-right font-medium">{selectedSale.customerEmail}</span>

                <span className="text-muted-foreground">Transaction Name:</span>
                <span className="text-right font-medium">{selectedSale.transactionName}</span>
                
                <span className="text-muted-foreground">Method:</span>
                <span className="text-right font-medium">{selectedSale.transactionMethod}</span>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block">Products Breakdown</span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedSale.products.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-muted/30 p-2 rounded border border-border">
                      <div className="flex flex-col">
                        <span className="font-medium text-xs sm:text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">Qty: {p.quantity} @ ${p.price.toFixed(2)}</span>
                      </div>
                      <span className="font-bold text-xs sm:text-sm">${(p.price * p.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end border-t border-border pt-4 space-y-1">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">${selectedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">${selectedSale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom ConfirmDialog for delete action */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Sale Record"
        description="Are you sure you want to permanently delete this sale record? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </NavLayout>
  );
}
