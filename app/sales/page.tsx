"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot
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
import { Plus, Trash2, Eye, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import {
  createSaleTransaction,
  updateSaleTransaction,
  deleteSaleTransaction,
  initializeDefaultAccounts
} from "@/lib/accounts-db";

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
  customerChannel?: string;
  transactionName: string;
  transactionMethod: string;
  accountId?: string;
  date: string;
  products: ProductItem[];
  subtotal: number;
  total: number;
  shared: boolean;
  createdBy: string;
  createdAt: string;
  discountName?: string;
  discountAmount?: number;
  note?: string;
}

interface ProductCatalogItem {
  id: string;
  name: string;
  price: number;
}

export default function SalesPage() {
  const { profile } = useAuth();
  const [productsCatalog, setProductsCatalog] = useState<ProductCatalogItem[]>([]);

  // Dialog Open states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Predefined Discounts states
  const [predefinedDiscounts, setPredefinedDiscounts] = useState<{ id: string; name: string; value: number }[]>([]);
  const [manageDiscountsOpen, setManageDiscountsOpen] = useState(false);
  const [newDiscountName, setNewDiscountName] = useState("");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Custom delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saleIdToDelete, setSaleIdToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Accounts list state
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);

  // Creation form fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [transactionName, setTransactionName] = useState("");
  const [transactionMethod, setTransactionMethod] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [visibility, setVisibility] = useState<"Shared" | "Only Me">("Shared");
  const [saleItems, setSaleItems] = useState<{ productId: string; price: string; quantity: string }[]>([
    { productId: "", price: "", quantity: "1" }
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sale creation discount, note & channel fields
  const [discountType, setDiscountType] = useState("None");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [note, setNote] = useState("");
  const [customerChannel, setCustomerChannel] = useState("facebook");

  // Editing form fields
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editTransactionName, setEditTransactionName] = useState("");
  const [editTransactionMethod, setEditTransactionMethod] = useState<string>("");
  const [editDate, setEditDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"Shared" | "Only Me">("Shared");
  const [editSaleItems, setEditSaleItems] = useState<{ productId: string; price: string; quantity: string }[]>([]);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Sale editing discount, note & channel fields
  const [editDiscountType, setEditDiscountType] = useState("None");
  const [editDiscountAmount, setEditDiscountAmount] = useState("0");
  const [editNote, setEditNote] = useState("");
  const [editCustomerChannel, setEditCustomerChannel] = useState("facebook");

  // Predefined discounts real-time listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "discounts"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: { id: string; name: string; value: number }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name,
          value: data.value
        });
      });
      setPredefinedDiscounts(list);
    }, (err) => {
      console.error("Discounts subscription error:", err);
    });
    return () => unsubscribe();
  }, [profile]);

  // Dynamic accounts real-time listener and auto-initialization
  useEffect(() => {
    if (!profile) return;
    
    // Auto-create defaults if there are no accounts
    initializeDefaultAccounts(profile.uid);

    const q = query(collection(db, "accounts"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: { id: string; name: string }[] = [];
      snapshot.forEach((doc) => {
        list.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      setAccounts(list);
      // Default creation transactionMethod to first account if empty
      if (list.length > 0) {
        setTransactionMethod((prev) => prev || list[0].id);
      }
    }, (err) => {
      console.error("Accounts subscription error:", err);
    });
    return () => unsubscribe();
  }, [profile]);

  const handleAddDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountError(null);
    const val = parseFloat(newDiscountValue);
    if (!newDiscountName.trim()) {
      setDiscountError("Discount name is required.");
      return;
    }
    if (isNaN(val) || val <= 0) {
      setDiscountError("Discount value must be a valid positive number.");
      return;
    }

    setSavingDiscount(true);
    try {
      await addDoc(collection(db, "discounts"), {
        name: newDiscountName.trim(),
        value: val,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString()
      });
      setNewDiscountName("");
      setNewDiscountValue("");
    } catch (err) {
      console.error("Error creating discount:", err);
      setDiscountError("Failed to save discount.");
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDeleteDiscount = async (id: string) => {
    try {
      await deleteDoc(doc(db, "discounts", id));
    } catch (err) {
      console.error("Error deleting discount:", err);
    }
  };

  const createSalesQuery = React.useCallback(() => {
    if (!profile) return query(collection(db, "sales"), orderBy("date", "desc"));

    if (profile.role === "admin") {
      return query(collection(db, "sales"), orderBy("date", "desc"));
    } else {
      return query(
        collection(db, "sales"),
        where("shared", "==", true),
        orderBy("date", "desc")
      );
    }
  }, [profile]);

  const {
    items: sales,
    loading,
    page,
    pageSize,
    setPageSize,
    totalCount,
    hasMore,
    nextPage,
    prevPage,
    refresh
  } = useFirestorePagination<Sale>(
    createSalesQuery,
    10,
    [profile?.role],
    !!profile
  );

  useEffect(() => {
    const fetchProductsCatalog = async () => {
      try {
        const q = query(collection(db, "products"), orderBy("name", "asc"));
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

    let discountVal = 0;
    if (discountType === "Custom") {
      discountVal = parseFloat(discountAmount) || 0;
    } else if (discountType !== "None") {
      const selected = predefinedDiscounts.find(d => d.id === discountType);
      if (selected) {
        discountVal = selected.value;
      }
    }

    const total = Math.max(0, subtotal - discountVal);
    return { subtotal, total, discountVal };
  };

  const { subtotal: calculatedSubtotal, total: calculatedTotal, discountVal: activeDiscountVal } = calculateTotals();

  // Calculations for Edit Form
  const calculateEditTotals = () => {
    let subtotal = 0;
    editSaleItems.forEach((item) => {
      const priceVal = parseFloat(item.price) || 0;
      const qtyVal = parseInt(item.quantity) || 0;
      subtotal += priceVal * qtyVal;
    });

    let discountVal = 0;
    if (editDiscountType === "Custom") {
      discountVal = parseFloat(editDiscountAmount) || 0;
    } else if (editDiscountType !== "None") {
      const selected = predefinedDiscounts.find(d => d.id === editDiscountType);
      if (selected) {
        discountVal = selected.value;
      }
    }

    const total = Math.max(0, subtotal - discountVal);
    return { subtotal, total, discountVal };
  };

  const { subtotal: editCalculatedSubtotal, total: editCalculatedTotal, discountVal: editActiveDiscountVal } = calculateEditTotals();

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const existingIndex = saleItems.findIndex((item, idx) => item.productId === productId && idx !== index);

    if (existingIndex !== -1) {
      const newItems = [...saleItems];
      const existingQty = parseInt(newItems[existingIndex].quantity) || 1;
      const currentQty = parseInt(newItems[index].quantity) || 1;
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: (existingQty + currentQty).toString()
      };
      newItems.splice(index, 1);
      setSaleItems(newItems);
    } else {
      const newItems = [...saleItems];
      newItems[index] = {
        ...newItems[index],
        productId,
        price: selectedProd.price.toString()
      };
      setSaleItems(newItems);
    }
  };

  const handleEditProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const existingIndex = editSaleItems.findIndex((item, idx) => item.productId === productId && idx !== index);

    if (existingIndex !== -1) {
      const newItems = [...editSaleItems];
      const existingQty = parseInt(newItems[existingIndex].quantity) || 1;
      const currentQty = parseInt(newItems[index].quantity) || 1;
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: (existingQty + currentQty).toString()
      };
      newItems.splice(index, 1);
      setEditSaleItems(newItems);
    } else {
      const newItems = [...editSaleItems];
      newItems[index] = {
        ...newItems[index],
        productId,
        price: selectedProd.price.toString()
      };
      setEditSaleItems(newItems);
    }
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

    if (!transactionName.trim()) {
      setFormError("Transaction name/description is required.");
      return;
    }
    if (!date) {
      setFormError("Date is required.");
      return;
    }

    const mergedPrepared: { [productId: string]: ProductItem } = {};
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
      const prodName = originalProduct?.name || "Unknown Product";
      if (mergedPrepared[item.productId]) {
        mergedPrepared[item.productId].quantity += pQty;
        mergedPrepared[item.productId].price = pPrice;
      } else {
        mergedPrepared[item.productId] = {
          productId: item.productId,
          name: prodName,
          price: pPrice,
          quantity: pQty
        };
      }
    }
    const preparedProducts = Object.values(mergedPrepared);

    setSubmitting(true);
    try {
      const isShared = profile?.role === "admin" ? (visibility === "Shared") : true;
      const { subtotal, total } = calculateTotals();

      let finalDiscountName = "";
      let finalDiscountAmount = 0;

      if (discountType === "Custom") {
        finalDiscountName = "Custom Discount";
        finalDiscountAmount = parseFloat(discountAmount) || 0;
      } else if (discountType !== "None") {
        const selected = predefinedDiscounts.find(d => d.id === discountType);
        if (selected) {
          finalDiscountName = selected.name;
          finalDiscountAmount = selected.value;
        }
      }

      const saleData = {
        customerSocialName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerChannel,
        transactionName: transactionName.trim(),
        date,
        products: preparedProducts,
        subtotal,
        total,
        shared: isShared,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
        discountName: finalDiscountName,
        discountAmount: finalDiscountAmount,
        note: note.trim()
      };

      await createSaleTransaction(saleData, transactionMethod);

      // Reset form
      setCustomerName("");
      setCustomerEmail("");
      setCustomerChannel("facebook");
      setTransactionName("");
      setTransactionMethod(accounts[0]?.id || "");
      setDate(new Date().toISOString().split("T")[0]);
      setSaleItems([{ productId: "", price: "", quantity: "1" }]);
      setVisibility("Shared");
      setDiscountType("None");
      setDiscountAmount("0");
      setNote("");
      setCreateDialogOpen(false);
      await refresh();
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
    setEditCustomerChannel(sale.customerChannel || "facebook");
    setEditTransactionName(sale.transactionName);
    
    // Resolve account ID for old sales
    const matchedAcc = accounts.find(a => a.name === sale.transactionMethod || a.id === sale.accountId);
    setEditTransactionMethod(sale.accountId || matchedAcc?.id || "");
    
    setEditDate(sale.date);
    setEditVisibility(sale.shared ? "Shared" : "Only Me");
    setEditNote(sale.note || "");

    // Set edit discount fields
    if (!sale.discountAmount || sale.discountAmount === 0) {
      setEditDiscountType("None");
      setEditDiscountAmount("0");
    } else if (sale.discountName === "Custom Discount") {
      setEditDiscountType("Custom");
      setEditDiscountAmount(sale.discountAmount.toString());
    } else {
      const matched = predefinedDiscounts.find(d => d.name === sale.discountName);
      if (matched) {
        setEditDiscountType(matched.id);
        setEditDiscountAmount(matched.value.toString());
      } else {
        setEditDiscountType("Custom");
        setEditDiscountAmount(sale.discountAmount.toString());
      }
    }

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

    if (!editTransactionName.trim()) {
      setEditFormError("Transaction name/description is required.");
      return;
    }
    if (!editDate) {
      setEditFormError("Date is required.");
      return;
    }

    const mergedPrepared: { [productId: string]: ProductItem } = {};
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
      const prodName = originalProduct?.name || "Unknown Product";
      if (mergedPrepared[item.productId]) {
        mergedPrepared[item.productId].quantity += pQty;
        mergedPrepared[item.productId].price = pPrice;
      } else {
        mergedPrepared[item.productId] = {
          productId: item.productId,
          name: prodName,
          price: pPrice,
          quantity: pQty
        };
      }
    }
    const preparedProducts = Object.values(mergedPrepared);

    setUpdating(true);
    try {
      const { subtotal, total } = calculateEditTotals();

      let finalDiscountName = "";
      let finalDiscountAmount = 0;

      if (editDiscountType === "Custom") {
        finalDiscountName = "Custom Discount";
        finalDiscountAmount = parseFloat(editDiscountAmount) || 0;
      } else if (editDiscountType !== "None") {
        const selected = predefinedDiscounts.find(d => d.id === editDiscountType);
        if (selected) {
          finalDiscountName = selected.name;
          finalDiscountAmount = selected.value;
        }
      }

      const oldSaleWithAccount = { ...editingSale };
      if (!oldSaleWithAccount.accountId) {
        const matchedAcc = accounts.find(a => a.name === oldSaleWithAccount.transactionMethod);
        if (matchedAcc) {
          oldSaleWithAccount.accountId = matchedAcc.id;
        }
      }

      const selectedAccount = accounts.find(a => a.id === editTransactionMethod);
      const updatedFields: {
        customerSocialName: string;
        customerEmail: string;
        customerChannel: string;
        transactionName: string;
        transactionMethod: string;
        accountId: string;
        date: string;
        products: ProductItem[];
        subtotal: number;
        total: number;
        shared?: boolean;
        discountName: string;
        discountAmount: number;
        note: string;
      } = {
        customerSocialName: editCustomerName.trim(),
        customerEmail: editCustomerEmail.trim(),
        customerChannel: editCustomerChannel,
        transactionName: editTransactionName.trim(),
        accountId: editTransactionMethod,
        transactionMethod: selectedAccount?.name || "",
        date: editDate,
        products: preparedProducts,
        subtotal,
        total,
        discountName: finalDiscountName,
        discountAmount: finalDiscountAmount,
        note: editNote.trim()
      };

      if (profile?.role === "admin") {
        updatedFields.shared = editVisibility === "Shared";
      }

      await updateSaleTransaction(editingSale.id, updatedFields, oldSaleWithAccount);

      setEditDialogOpen(false);
      setEditingSale(null);
      await refresh();
    } catch (err) {
      console.error("Error updating sale record:", err);
      setEditFormError("Failed to update sale transaction.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleVisibility = async (sale: Sale) => {
    if (profile?.role !== "admin") return;
    try {
      await updateDoc(doc(db, "sales", sale.id), {
        shared: !sale.shared
      });
      await refresh();
    } catch (err) {
      console.error("Error toggling sale visibility:", err);
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
      const saleToDelete = sales.find(s => s.id === saleIdToDelete);
      if (saleToDelete) {
        const saleWithAccount = { ...saleToDelete };
        if (!saleWithAccount.accountId) {
          const matchedAcc = accounts.find(a => a.name === saleToDelete.transactionMethod);
          if (matchedAcc) {
            saleWithAccount.accountId = matchedAcc.id;
          }
        }
        await deleteSaleTransaction(saleIdToDelete, saleWithAccount);
      } else {
        await deleteDoc(doc(db, "sales", saleIdToDelete));
      }
      setDeleteConfirmOpen(false);
      setSaleIdToDelete(null);
      await refresh();
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

          <div className="flex items-center gap-2">
            <Dialog open={manageDiscountsOpen} onOpenChange={setManageDiscountsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  Manage Discounts
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle>Manage Predefined Discounts</DialogTitle>
                  <DialogDescription>
                    Add or delete predefined discounts.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 font-sans text-sm">
                  {discountError && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{discountError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleAddDiscount} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <RequiredLabel htmlFor="newDiscountName" required>Name</RequiredLabel>
                      <Input
                        id="newDiscountName"
                        value={newDiscountName}
                        onChange={(e) => setNewDiscountName(e.target.value)}
                        placeholder="E.g. Bundle Discount"
                        required
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <RequiredLabel htmlFor="newDiscountValue" required>Value (Ks)</RequiredLabel>
                      <Input
                        id="newDiscountValue"
                        type="number"
                        min="1"
                        value={newDiscountValue}
                        onChange={(e) => setNewDiscountValue(e.target.value)}
                        placeholder="9000"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={savingDiscount} className="h-9 px-3">
                      Add
                    </Button>
                  </form>

                  <div className="border-t border-border pt-4">
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-2">Discounts List</span>
                    {predefinedDiscounts.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2 italic text-center">
                        No predefined discounts created.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {predefinedDiscounts.map((d) => (
                          <div key={d.id} className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border">
                            <div>
                              <span className="font-medium">{d.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({d.value.toLocaleString()} Ks)</span>
                            </div>
                            <Button
                              onClick={() => handleDeleteDiscount(d.id)}
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setManageDiscountsOpen(false)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                      <RequiredLabel htmlFor="customerEmail">Customer Email</RequiredLabel>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john.doe@example.com"
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
                        placeholder="E.g. John Doe 26/05/2026"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="method" required>Transaction Method</RequiredLabel>
                      <Select
                        value={transactionMethod}
                        onValueChange={(val: string) => setTransactionMethod(val)}
                      >
                        <SelectTrigger id="method">
                          <SelectValue placeholder="Select Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name}
                            </SelectItem>
                          ))}
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
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="customerChannel" required>Source Channel</RequiredLabel>
                      <Select
                        value={customerChannel}
                        onValueChange={(val) => setCustomerChannel(val)}
                      >
                        <SelectTrigger id="customerChannel">
                          <SelectValue placeholder="Select Source Channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                          <SelectItem value="web">Web</SelectItem>
                          <SelectItem value="person">Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {profile?.role === "admin" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="discountType">Discount Type</RequiredLabel>
                      <Select
                        value={discountType}
                        onValueChange={(val) => {
                          setDiscountType(val);
                          if (val === "None") {
                            setDiscountAmount("0");
                          } else if (val !== "Custom") {
                            const selected = predefinedDiscounts.find(d => d.id === val);
                            if (selected) {
                              setDiscountAmount(selected.value.toString());
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="discountType">
                          <SelectValue placeholder="No Discount" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">No Discount</SelectItem>
                          <SelectItem value="Custom">Custom Discount</SelectItem>
                          {predefinedDiscounts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} (Ks {d.value.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel htmlFor="discountAmount">Discount Amount (Ks)</RequiredLabel>
                      <Input
                        id="discountAmount"
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        disabled={discountType === "None" || discountType !== "Custom"}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel htmlFor="note">Note (Optional)</RequiredLabel>
                    <Input
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="E.g. Special request or customer contact details"
                    />
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

                            <div className="w-full sm:w-40 flex flex-row gap-2">
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
                              <div className="space-y-1 sm:space-y-0">
                                <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Qty</RequiredLabel>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                  className="w-full sm:w-14 text-right"
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
                      <span className="font-bold">Ks {calculatedSubtotal.toLocaleString()}</span>
                    </div>
                    {activeDiscountVal > 0 && (
                      <div className="flex gap-4 text-red-600 text-xs">
                        <span>Discount:</span>
                        <span>-Ks {activeDiscountVal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-base font-bold">
                      <span className="text-foreground">Total:</span>
                      <span className="text-primary">Ks {calculatedTotal.toLocaleString()}</span>
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
        </div>
        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Sales Log</CardTitle>
            <CardDescription className="text-xs font-sans">
              {totalCount} transactions stored.
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
                      <TableHead className="text-center">Visibility</TableHead>
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
                        Ks {sale.total.toLocaleString()}
                        {sale.discountAmount ? (
                          <div className="text-[10px] text-red-600 font-normal">
                            (Ks {sale.discountAmount.toLocaleString()} discount)
                          </div>
                        ) : null}
                      </TableCell>
                      {profile?.role === "admin" && (
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleToggleVisibility(sale)}
                            className="focus:outline-none"
                            title="Click to toggle visibility"
                          >
                            {sale.shared ? (
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
                          <Button
                            onClick={() => openViewDialog(sale)}
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(profile?.role === "admin" || !sale.shared) && (
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
                            <Button
                              onClick={() => triggerDelete(sale.id)}
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
          {!loading && sales.length > 0 && (
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
                  <RequiredLabel htmlFor="editCustomerEmail">Customer Email</RequiredLabel>
                  <Input
                    id="editCustomerEmail"
                    type="email"
                    value={editCustomerEmail}
                    onChange={(e) => setEditCustomerEmail(e.target.value)}
                    placeholder="john.doe@example.com"
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
                    placeholder="E.g. John Doe 26/05/2026"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editMethod" required>Transaction Method</RequiredLabel>
                  <Select
                    value={editTransactionMethod}
                    onValueChange={(val: string) => setEditTransactionMethod(val)}
                  >
                    <SelectTrigger id="editMethod">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
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
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerChannel" required>Source Channel</RequiredLabel>
                  <Select
                    value={editCustomerChannel}
                    onValueChange={(val) => setEditCustomerChannel(val)}
                  >
                    <SelectTrigger id="editCustomerChannel">
                      <SelectValue placeholder="Select Source Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {profile?.role === "admin" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="editVisibility" required>Visibility</RequiredLabel>
                    <Select
                      value={editVisibility}
                      onValueChange={(val: "Shared" | "Only Me") => setEditVisibility(val)}
                    >
                      <SelectTrigger id="editVisibility">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Shared">Shared</SelectItem>
                        <SelectItem value="Only Me">Only Me</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editDiscountType">Discount Type</RequiredLabel>
                  <Select
                    value={editDiscountType}
                    onValueChange={(val) => {
                      setEditDiscountType(val);
                      if (val === "None") {
                        setEditDiscountAmount("0");
                      } else if (val !== "Custom") {
                        const selected = predefinedDiscounts.find(d => d.id === val);
                        if (selected) {
                          setEditDiscountAmount(selected.value.toString());
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="editDiscountType">
                      <SelectValue placeholder="No Discount" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">No Discount</SelectItem>
                      <SelectItem value="Custom">Custom Discount</SelectItem>
                      {predefinedDiscounts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} (Ks {d.value.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <RequiredLabel htmlFor="editDiscountAmount">Discount Amount (Ks)</RequiredLabel>
                  <Input
                    id="editDiscountAmount"
                    type="number"
                    min="0"
                    value={editDiscountAmount}
                    onChange={(e) => setEditDiscountAmount(e.target.value)}
                    disabled={editDiscountType === "None" || editDiscountType !== "Custom"}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <RequiredLabel htmlFor="editNote">Note (Optional)</RequiredLabel>
                <Input
                  id="editNote"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="E.g. Special request or customer contact details"
                />
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

                        <div className="w-full sm:w-40 flex flex-row gap-2">
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
                          <div className="space-y-1 sm:space-y-0">
                            <RequiredLabel className="sm:hidden text-xs text-muted-foreground">Qty</RequiredLabel>
                            <Input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={item.quantity}
                              onChange={(e) => handleEditItemChange(idx, "quantity", e.target.value)}
                              className="w-full sm:w-14 text-right"
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
                  <span className="font-bold">Ks {editCalculatedSubtotal.toLocaleString()}</span>
                </div>
                {editActiveDiscountVal > 0 && (
                  <div className="flex gap-4 text-red-600 text-xs">
                    <span>Discount:</span>
                    <span>-Ks {editActiveDiscountVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">Ks {editCalculatedTotal.toLocaleString()}</span>
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
                <span className="text-right font-medium break-all">{selectedSale.customerEmail}</span>

                {selectedSale.customerChannel && (
                  <>
                    <span className="text-muted-foreground">Source Channel:</span>
                    <span className="text-right font-medium capitalize">{selectedSale.customerChannel}</span>
                  </>
                )}

                <span className="text-muted-foreground">Transaction Name:</span>
                <span className="text-right font-medium">{selectedSale.transactionName}</span>

                <span className="text-muted-foreground">Method:</span>
                <span className="text-right font-medium">{selectedSale.transactionMethod}</span>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block">Products Breakdown</span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(() => {
                    const merged: ProductItem[] = [];
                    selectedSale.products.forEach((p) => {
                      const existing = merged.find((item) => item.productId === p.productId);
                      if (existing) {
                        existing.quantity += p.quantity;
                      } else {
                        merged.push({ ...p });
                      }
                    });
                    return merged.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-muted/30 p-2 rounded border border-border">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs sm:text-sm">{p.name}</span>
                          <span className="text-xs text-muted-foreground">Qty: {p.quantity} @ Ks {p.price.toLocaleString()}</span>
                        </div>
                        <span className="font-bold text-xs sm:text-sm">Ks {(p.price * p.quantity).toLocaleString()}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="flex flex-col items-end border-t border-border pt-4 space-y-1">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">Ks {selectedSale.subtotal.toLocaleString()}</span>
                </div>
                {selectedSale.discountAmount ? (
                  <div className="flex gap-4 text-red-600 text-xs">
                    <span>Discount ({selectedSale.discountName || "Applied"}):</span>
                    <span>-Ks {selectedSale.discountAmount.toLocaleString()}</span>
                  </div>
                ) : null}
                {selectedSale.note ? (
                  <div className="text-xs text-muted-foreground max-w-full italic mt-2 self-start">
                    Note: {selectedSale.note}
                  </div>
                ) : null}
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">Ks {selectedSale.total.toLocaleString()}</span>
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
