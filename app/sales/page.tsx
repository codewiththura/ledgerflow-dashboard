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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Eye, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import {
  createSaleTransaction,
  updateSaleTransaction,
  deleteSaleTransaction,
  initializeDefaultAccounts,
  Installment,
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
  // Service sales fields
  saleType?: "product" | "service";
  serviceType?: string;
  serviceName?: string;
  paymentType?: "Full" | "Partial";
  installmentPlan?: "2" | "3" | "custom";
  installments?: Installment[];
}

interface ProductCatalogItem {
  id: string;
  name: string;
  price: number;
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  serviceType: string;
  basePrice: number;
}

export default function SalesPage() {
  const { profile } = useAuth();
  const [productsCatalog, setProductsCatalog] = useState<ProductCatalogItem[]>(
    [],
  );

  // Dialog Open states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Predefined Discounts states
  const [predefinedDiscounts, setPredefinedDiscounts] = useState<
    { id: string; name: string; value: number }[]
  >([]);
  const [manageDiscountsOpen, setManageDiscountsOpen] = useState(false);
  const [newDiscountName, setNewDiscountName] = useState("");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Predefined Services states
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>(
    [],
  );
  const [manageServicesOpen, setManageServicesOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceType, setNewServiceType] = useState("Mentorship");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);

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
  const [visibility, setVisibility] = useState<"Shared" | "Only Me">("Only Me");
  const [saleItems, setSaleItems] = useState<
    { productId: string; price: string; quantity: string }[]
  >([{ productId: "", price: "", quantity: "1" }]);
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
  const [editTransactionMethod, setEditTransactionMethod] =
    useState<string>("");
  const [editDate, setEditDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"Shared" | "Only Me">(
    "Shared",
  );
  const [editSaleItems, setEditSaleItems] = useState<
    { productId: string; price: string; quantity: string }[]
  >([]);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Sale editing discount, note & channel fields
  const [editDiscountType, setEditDiscountType] = useState("None");
  const [editDiscountAmount, setEditDiscountAmount] = useState("0");
  const [editNote, setEditNote] = useState("");
  const [editCustomerChannel, setEditCustomerChannel] = useState("facebook");

  // Service Sale Creation states
  const [saleType, setSaleType] = useState<"product" | "service">("product");
  const [serviceType, setServiceType] = useState<string>("Mentorship");
  const [serviceName, setServiceName] = useState<string>("");
  const [servicePrice, setServicePrice] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Full" | "Partial">("Full");
  const [installmentPlan, setInstallmentPlan] = useState<"2" | "3" | "custom">(
    "2",
  );
  const [customInstallmentCount, setCustomInstallmentCount] =
    useState<string>("4");
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Service Sale Editing states
  const [editSaleType, setEditSaleType] = useState<"product" | "service">(
    "product",
  );
  const [editServiceType, setEditServiceType] = useState<string>("Mentorship");
  const [editServiceName, setEditServiceName] = useState<string>("");
  const [editServicePrice, setEditServicePrice] = useState<string>("");
  const [editPaymentType, setEditPaymentType] = useState<"Full" | "Partial">(
    "Full",
  );
  const [editInstallmentPlan, setEditInstallmentPlan] = useState<
    "2" | "3" | "custom"
  >("2");
  const [editCustomInstallmentCount, setEditCustomInstallmentCount] =
    useState<string>("4");
  const [editInstallments, setEditInstallments] = useState<Installment[]>([]);

  // Inline payment state inside Details modal
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(
    null,
  );
  const [payingAccountId, setPayingAccountId] = useState<string>("");
  const [payingDate, setPayingDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Sync Installments Helper
  const syncInstallments = (
    totalPrice: number,
    plan: "2" | "3" | "custom",
    customCountStr: string,
    currentInsts: Installment[],
  ): Installment[] => {
    const count =
      plan === "2" ? 2 : plan === "3" ? 3 : parseInt(customCountStr) || 2;
    if (count <= 0) return [];

    const baseAmount = Math.floor(totalPrice / count);
    const remainder = totalPrice - baseAmount * count;

    const newInsts: Installment[] = [];
    for (let i = 0; i < count; i++) {
      const id = (i + 1).toString();
      const amt = i === count - 1 ? baseAmount + remainder : baseAmount;

      const existing = currentInsts.find((inst) => inst.id === id);
      if (existing) {
        newInsts.push({
          ...existing,
          amount: amt,
        });
      } else {
        newInsts.push({
          id,
          amount: amt,
          status: "Pending",
        });
      }
    }
    return newInsts;
  };

  // Auto-generate installments for creation
  useEffect(() => {
    if (saleType === "service") {
      const sPrice = parseFloat(servicePrice) || 0;
      let discountVal = 0;
      if (discountType === "Custom") {
        discountVal = parseFloat(discountAmount) || 0;
      } else if (discountType !== "None") {
        const selected = predefinedDiscounts.find((d) => d.id === discountType);
        if (selected) {
          discountVal = selected.value;
        }
      }
      const total = Math.max(0, sPrice - discountVal);

      if (paymentType === "Full") {
        const activeAccount = accounts.find((a) => a.id === transactionMethod);
        setInstallments([
          {
            id: "1",
            amount: total,
            status: "Paid",
            paidDate: date,
            accountId: transactionMethod,
            transactionMethod: activeAccount?.name || "",
          },
        ]);
      } else {
        setInstallments((prev) => {
          const cleanPrev = prev.length === 1 && prev[0].id === "1" ? [] : prev;
          return syncInstallments(
            total,
            installmentPlan,
            customInstallmentCount,
            cleanPrev,
          );
        });
      }
    }
  }, [
    saleType,
    servicePrice,
    discountType,
    discountAmount,
    paymentType,
    installmentPlan,
    customInstallmentCount,
    transactionMethod,
    date,
    accounts,
    predefinedDiscounts,
  ]);

  // Auto-generate installments for editing
  useEffect(() => {
    if (editSaleType === "service") {
      const sPrice = parseFloat(editServicePrice) || 0;
      let discountVal = 0;
      if (editDiscountType === "Custom") {
        discountVal = parseFloat(editDiscountAmount) || 0;
      } else if (editDiscountType !== "None") {
        const selected = predefinedDiscounts.find(
          (d) => d.id === editDiscountType,
        );
        if (selected) {
          discountVal = selected.value;
        }
      }
      const total = Math.max(0, sPrice - discountVal);

      if (editPaymentType === "Full") {
        const activeAccount = accounts.find(
          (a) => a.id === editTransactionMethod,
        );
        setEditInstallments([
          {
            id: "1",
            amount: total,
            status: "Paid",
            paidDate: editDate,
            accountId: editTransactionMethod,
            transactionMethod: activeAccount?.name || "",
          },
        ]);
      } else {
        setEditInstallments((prev) => {
          const cleanPrev = prev.length === 1 && prev[0].id === "1" ? [] : prev;
          return syncInstallments(
            total,
            editInstallmentPlan,
            editCustomInstallmentCount,
            cleanPrev,
          );
        });
      }
    }
  }, [
    editSaleType,
    editServicePrice,
    editDiscountType,
    editDiscountAmount,
    editPaymentType,
    editInstallmentPlan,
    editCustomInstallmentCount,
    editTransactionMethod,
    editDate,
    accounts,
    predefinedDiscounts,
  ]);

  // Predefined discounts real-time listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "discounts"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: { id: string; name: string; value: number }[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name,
            value: data.value,
          });
        });
        setPredefinedDiscounts(list);
      },
      (err) => {
        console.error("Discounts subscription error:", err);
      },
    );
    return () => unsubscribe();
  }, [profile]);

  // Predefined services real-time listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "services"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ServiceCatalogItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name,
            serviceType: data.serviceType,
            basePrice: data.basePrice,
          });
        });
        setServicesCatalog(list);
      },
      (err) => {
        console.error("Services subscription error:", err);
      },
    );
    return () => unsubscribe();
  }, [profile]);

  // Dynamic accounts real-time listener and auto-initialization
  useEffect(() => {
    if (!profile) return;

    // Auto-create defaults if there are no accounts
    initializeDefaultAccounts(profile.uid);

    const q = query(collection(db, "accounts"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: { id: string; name: string }[] = [];
        snapshot.forEach((doc) => {
          list.push({
            id: doc.id,
            name: doc.data().name,
          });
        });
        setAccounts(list);
        // Default creation transactionMethod to first account if empty
        if (list.length > 0) {
          setTransactionMethod((prev) => prev || list[0].id);
        }
      },
      (err) => {
        console.error("Accounts subscription error:", err);
      },
    );
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
        createdAt: new Date().toISOString(),
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

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError(null);
    const price = parseFloat(newServicePrice);
    if (!newServiceName.trim()) {
      setServiceError("Service name is required.");
      return;
    }
    if (!newServiceType) {
      setServiceError("Service type is required.");
      return;
    }
    if (isNaN(price) || price <= 0) {
      setServiceError("Service base price must be a valid positive number.");
      return;
    }

    setSavingService(true);
    try {
      await addDoc(collection(db, "services"), {
        name: newServiceName.trim(),
        serviceType: newServiceType,
        basePrice: price,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });
      setNewServiceName("");
      setNewServicePrice("");
    } catch (err) {
      console.error("Error creating service template:", err);
      setServiceError("Failed to save service template.");
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await deleteDoc(doc(db, "services", id));
    } catch (err) {
      console.error("Error deleting service template:", err);
    }
  };

  const createSalesQuery = React.useCallback(() => {
    if (!profile)
      return query(collection(db, "sales"), orderBy("date", "desc"));

    if (profile.role === "admin") {
      return query(collection(db, "sales"), orderBy("date", "desc"));
    } else {
      return query(
        collection(db, "sales"),
        where("shared", "==", true),
        orderBy("date", "desc"),
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
    refresh,
  } = useFirestorePagination<Sale>(
    createSalesQuery,
    10,
    [profile?.role],
    !!profile,
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
    if (saleType === "service") {
      subtotal = parseFloat(servicePrice) || 0;
    } else {
      saleItems.forEach((item) => {
        const priceVal = parseFloat(item.price) || 0;
        const qtyVal = parseInt(item.quantity) || 0;
        subtotal += priceVal * qtyVal;
      });
    }

    let discountVal = 0;
    if (discountType === "Custom") {
      discountVal = parseFloat(discountAmount) || 0;
    } else if (discountType !== "None") {
      const selected = predefinedDiscounts.find((d) => d.id === discountType);
      if (selected) {
        discountVal = selected.value;
      }
    }

    const total = Math.max(0, subtotal - discountVal);
    return { subtotal, total, discountVal };
  };

  const {
    subtotal: calculatedSubtotal,
    total: calculatedTotal,
    discountVal: activeDiscountVal,
  } = calculateTotals();

  // Calculations for Edit Form
  const calculateEditTotals = () => {
    let subtotal = 0;
    if (editSaleType === "service") {
      subtotal = parseFloat(editServicePrice) || 0;
    } else {
      editSaleItems.forEach((item) => {
        const priceVal = parseFloat(item.price) || 0;
        const qtyVal = parseInt(item.quantity) || 0;
        subtotal += priceVal * qtyVal;
      });
    }

    let discountVal = 0;
    if (editDiscountType === "Custom") {
      discountVal = parseFloat(editDiscountAmount) || 0;
    } else if (editDiscountType !== "None") {
      const selected = predefinedDiscounts.find(
        (d) => d.id === editDiscountType,
      );
      if (selected) {
        discountVal = selected.value;
      }
    }

    const total = Math.max(0, subtotal - discountVal);
    return { subtotal, total, discountVal };
  };

  const {
    subtotal: editCalculatedSubtotal,
    total: editCalculatedTotal,
    discountVal: editActiveDiscountVal,
  } = calculateEditTotals();

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const existingIndex = saleItems.findIndex(
      (item, idx) => item.productId === productId && idx !== index,
    );

    if (existingIndex !== -1) {
      const newItems = [...saleItems];
      const existingQty = parseInt(newItems[existingIndex].quantity) || 1;
      const currentQty = parseInt(newItems[index].quantity) || 1;
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: (existingQty + currentQty).toString(),
      };
      newItems.splice(index, 1);
      setSaleItems(newItems);
    } else {
      const newItems = [...saleItems];
      newItems[index] = {
        ...newItems[index],
        productId,
        price: selectedProd.price.toString(),
      };
      setSaleItems(newItems);
    }
  };

  const handleEditProductSelect = (index: number, productId: string) => {
    const selectedProd = productsCatalog.find((p) => p.id === productId);
    if (!selectedProd) return;

    const existingIndex = editSaleItems.findIndex(
      (item, idx) => item.productId === productId && idx !== index,
    );

    if (existingIndex !== -1) {
      const newItems = [...editSaleItems];
      const existingQty = parseInt(newItems[existingIndex].quantity) || 1;
      const currentQty = parseInt(newItems[index].quantity) || 1;
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: (existingQty + currentQty).toString(),
      };
      newItems.splice(index, 1);
      setEditSaleItems(newItems);
    } else {
      const newItems = [...editSaleItems];
      newItems[index] = {
        ...newItems[index],
        productId,
        price: selectedProd.price.toString(),
      };
      setEditSaleItems(newItems);
    }
  };

  const handleItemChange = (
    index: number,
    key: "price" | "quantity",
    value: string,
  ) => {
    const newItems = [...saleItems];
    newItems[index] = {
      ...newItems[index],
      [key]: value,
    };
    setSaleItems(newItems);
  };

  const handleEditItemChange = (
    index: number,
    key: "price" | "quantity",
    value: string,
  ) => {
    const newItems = [...editSaleItems];
    newItems[index] = {
      ...newItems[index],
      [key]: value,
    };
    setEditSaleItems(newItems);
  };

  const handleAddItemRow = () => {
    setSaleItems([...saleItems, { productId: "", price: "", quantity: "1" }]);
  };

  const handleAddEditItemRow = () => {
    setEditSaleItems([
      ...editSaleItems,
      { productId: "", price: "", quantity: "1" },
    ]);
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

    let preparedProducts: ProductItem[] = [];
    if (saleType === "product") {
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

        const originalProduct = productsCatalog.find(
          (p) => p.id === item.productId,
        );
        const prodName = originalProduct?.name || "Unknown Product";
        if (mergedPrepared[item.productId]) {
          mergedPrepared[item.productId].quantity += pQty;
          mergedPrepared[item.productId].price = pPrice;
        } else {
          mergedPrepared[item.productId] = {
            productId: item.productId,
            name: prodName,
            price: pPrice,
            quantity: pQty,
          };
        }
      }
      preparedProducts = Object.values(mergedPrepared);
    } else {
      if (
        !servicePrice ||
        isNaN(parseFloat(servicePrice)) ||
        parseFloat(servicePrice) <= 0
      ) {
        setFormError("Service price must be a valid positive number.");
        return;
      }

      for (const inst of installments) {
        if (inst.status === "Paid" && !inst.accountId) {
          setFormError("Please select an account for all paid installments.");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const isShared =
        profile?.role === "admin" ? visibility === "Shared" : true;
      const { subtotal, total } = calculateTotals();

      let finalDiscountName = "";
      let finalDiscountAmount = 0;

      if (discountType === "Custom") {
        finalDiscountName = "Custom Discount";
        finalDiscountAmount = parseFloat(discountAmount) || 0;
      } else if (discountType !== "None") {
        const selected = predefinedDiscounts.find((d) => d.id === discountType);
        if (selected) {
          finalDiscountName = selected.name;
          finalDiscountAmount = selected.value;
        }
      }

      const saleData: any = {
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
        note: note.trim(),
        saleType,
      };

      if (saleType === "service") {
        saleData.serviceType = serviceType;
        saleData.serviceName = serviceName.trim() || serviceType;
        saleData.paymentType = paymentType;
        saleData.installmentPlan = installmentPlan;
        saleData.installments = installments;
      }

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
      setSaleType("product");
      setServiceType("Mentorship");
      setServiceName("");
      setServicePrice("");
      setPaymentType("Full");
      setInstallmentPlan("2");
      setInstallments([]);
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

    const matchedAcc = accounts.find(
      (a) => a.name === sale.transactionMethod || a.id === sale.accountId,
    );
    setEditTransactionMethod(sale.accountId || matchedAcc?.id || "");

    setEditDate(sale.date);
    setEditVisibility(sale.shared ? "Shared" : "Only Me");
    setEditNote(sale.note || "");

    if (!sale.discountAmount || sale.discountAmount === 0) {
      setEditDiscountType("None");
      setEditDiscountAmount("0");
    } else if (sale.discountName === "Custom Discount") {
      setEditDiscountType("Custom");
      setEditDiscountAmount(sale.discountAmount.toString());
    } else {
      const matched = predefinedDiscounts.find(
        (d) => d.name === sale.discountName,
      );
      if (matched) {
        setEditDiscountType(matched.id);
        setEditDiscountAmount(matched.value.toString());
      } else {
        setEditDiscountType("Custom");
        setEditDiscountAmount(sale.discountAmount.toString());
      }
    }

    const items = sale.products
      ? sale.products.map((p) => ({
          productId: p.productId,
          price: p.price.toString(),
          quantity: p.quantity.toString(),
        }))
      : [];
    setEditSaleItems(
      items.length > 0 ? items : [{ productId: "", price: "", quantity: "1" }],
    );

    setEditSaleType(sale.saleType || "product");
    setEditServiceType(sale.serviceType || "Mentorship");
    setEditServiceName(sale.serviceName || "");
    setEditServicePrice(
      sale.saleType === "service"
        ? (sale.subtotal || sale.total || 0).toString()
        : "",
    );
    setEditPaymentType(sale.paymentType || "Full");
    setEditInstallmentPlan(sale.installmentPlan || "2");

    if (sale.saleType === "service" && sale.installments) {
      setEditInstallments(sale.installments);
      if (sale.installmentPlan === "custom") {
        setEditCustomInstallmentCount(sale.installments.length.toString());
      }
    } else {
      setEditInstallments([]);
    }

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

    let preparedProducts: ProductItem[] = [];
    if (editSaleType === "product") {
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

        const originalProduct = productsCatalog.find(
          (p) => p.id === item.productId,
        );
        const prodName = originalProduct?.name || "Unknown Product";
        if (mergedPrepared[item.productId]) {
          mergedPrepared[item.productId].quantity += pQty;
          mergedPrepared[item.productId].price = pPrice;
        } else {
          mergedPrepared[item.productId] = {
            productId: item.productId,
            name: prodName,
            price: pPrice,
            quantity: pQty,
          };
        }
      }
      preparedProducts = Object.values(mergedPrepared);
    } else {
      if (
        !editServicePrice ||
        isNaN(parseFloat(editServicePrice)) ||
        parseFloat(editServicePrice) <= 0
      ) {
        setEditFormError("Service price must be a valid positive number.");
        return;
      }

      for (const inst of editInstallments) {
        if (inst.status === "Paid" && !inst.accountId) {
          setEditFormError(
            "Please select an account for all paid installments.",
          );
          return;
        }
      }
    }

    setUpdating(true);
    try {
      const { subtotal, total } = calculateEditTotals();

      let finalDiscountName = "";
      let finalDiscountAmount = 0;

      if (editDiscountType === "Custom") {
        finalDiscountName = "Custom Discount";
        finalDiscountAmount = parseFloat(editDiscountAmount) || 0;
      } else if (editDiscountType !== "None") {
        const selected = predefinedDiscounts.find(
          (d) => d.id === editDiscountType,
        );
        if (selected) {
          finalDiscountName = selected.name;
          finalDiscountAmount = selected.value;
        }
      }

      const oldSaleWithAccount = { ...editingSale };
      if (!oldSaleWithAccount.accountId) {
        const matchedAcc = accounts.find(
          (a) => a.name === oldSaleWithAccount.transactionMethod,
        );
        if (matchedAcc) {
          oldSaleWithAccount.accountId = matchedAcc.id;
        }
      }

      const selectedAccount = accounts.find(
        (a) => a.id === editTransactionMethod,
      );
      const updatedFields: any = {
        customerSocialName: editCustomerName.trim(),
        customerEmail: editCustomerEmail.trim(),
        customerChannel: editCustomerChannel,
        transactionName: editTransactionName.trim(),
        accountId: editSaleType === "service" ? "" : editTransactionMethod,
        transactionMethod:
          editSaleType === "service" ? "" : selectedAccount?.name || "",
        date: editDate,
        products: preparedProducts,
        subtotal,
        total,
        discountName: finalDiscountName,
        discountAmount: finalDiscountAmount,
        note: editNote.trim(),
        saleType: editSaleType,
      };

      if (editSaleType === "service") {
        updatedFields.serviceType = editServiceType;
        updatedFields.serviceName = editServiceName.trim() || editServiceType;
        updatedFields.paymentType = editPaymentType;
        updatedFields.installmentPlan = editInstallmentPlan;
        updatedFields.installments = editInstallments;
      }

      if (profile?.role === "admin") {
        updatedFields.shared = editVisibility === "Shared";
      }

      await updateSaleTransaction(
        editingSale.id,
        updatedFields,
        oldSaleWithAccount,
      );

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
        shared: !sale.shared,
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
      const saleToDelete = sales.find((s) => s.id === saleIdToDelete);
      if (saleToDelete) {
        const saleWithAccount = { ...saleToDelete };
        if (!saleWithAccount.accountId) {
          const matchedAcc = accounts.find(
            (a) => a.name === saleToDelete.transactionMethod,
          );
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

  const handleMarkInstallmentPaid = async (instId: string) => {
    if (!selectedSale || !payingAccountId) return;
    try {
      const selectedAcc = accounts.find((a) => a.id === payingAccountId);
      const updatedInstallments =
        selectedSale.installments?.map((inst) => {
          if (inst.id === instId) {
            return {
              ...inst,
              status: "Paid" as const,
              paidDate: payingDate,
              accountId: payingAccountId,
              transactionMethod: selectedAcc?.name || "",
            };
          }
          return inst;
        }) || [];

      const updatedSale = {
        ...selectedSale,
        installments: updatedInstallments,
      };

      const oldSaleWithAccount = { ...selectedSale };
      if (!oldSaleWithAccount.accountId) {
        const matchedAcc = accounts.find(
          (a) =>
            a.name === oldSaleWithAccount.transactionMethod ||
            a.id === oldSaleWithAccount.accountId,
        );
        if (matchedAcc) {
          oldSaleWithAccount.accountId = matchedAcc.id;
        }
      }

      await updateSaleTransaction(
        selectedSale.id,
        updatedSale,
        oldSaleWithAccount,
      );
      setSelectedSale(updatedSale);
      setPayingInstallmentId(null);
      await refresh();
    } catch (err) {
      console.error("Error marking installment as paid:", err);
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
            <h2 className="text-xl font-bold font-sans tracking-tight">
              Sales List
            </h2>
            <p className="text-sm text-muted-foreground font-sans">
              Record and view customer transaction data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog
              open={manageDiscountsOpen}
              onOpenChange={setManageDiscountsOpen}
            >
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

                  <form
                    onSubmit={handleAddDiscount}
                    className="flex gap-2 items-end"
                  >
                    <div className="flex-1 space-y-1">
                      <RequiredLabel htmlFor="newDiscountName" required>
                        Name
                      </RequiredLabel>
                      <Input
                        id="newDiscountName"
                        value={newDiscountName}
                        onChange={(e) => setNewDiscountName(e.target.value)}
                        placeholder="E.g. Bundle Discount"
                        required
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <RequiredLabel htmlFor="newDiscountValue" required>
                        Value (Ks)
                      </RequiredLabel>
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
                    <Button
                      type="submit"
                      disabled={savingDiscount}
                      className="h-9 px-3"
                    >
                      Add
                    </Button>
                  </form>

                  <div className="border-t border-border pt-4">
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                      Discounts List
                    </span>
                    {predefinedDiscounts.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2 italic text-center">
                        No predefined discounts created.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {predefinedDiscounts.map((d) => (
                          <div
                            key={d.id}
                            className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border"
                          >
                            <div>
                              <span className="font-medium">{d.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({d.value.toLocaleString()} Ks)
                              </span>
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
                  <Button onClick={() => setManageDiscountsOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={manageServicesOpen}
              onOpenChange={setManageServicesOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  Manage Services
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle>Manage Service Catalog</DialogTitle>
                  <DialogDescription>
                    Add or delete predefined service templates.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 font-sans text-sm">
                  {serviceError && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{serviceError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleAddService} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <RequiredLabel htmlFor="newServiceType" required>
                          Type
                        </RequiredLabel>
                        <Select
                          value={newServiceType}
                          onValueChange={(val) => setNewServiceType(val)}
                        >
                          <SelectTrigger id="newServiceType" className="h-9">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mentorship">
                              Mentorship
                            </SelectItem>
                            <SelectItem value="Zoom Class">
                              Zoom Class
                            </SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
                            <SelectItem value="1 on 1 Class">
                              1 on 1 Class
                            </SelectItem>
                            <SelectItem value="Custom">
                              Custom / Other
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <RequiredLabel htmlFor="newServicePrice" required>
                          Price (Ks)
                        </RequiredLabel>
                        <Input
                          id="newServicePrice"
                          type="number"
                          min="1"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          placeholder="300000"
                          className="h-9"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <RequiredLabel htmlFor="newServiceName" required>
                          Service Template Name
                        </RequiredLabel>
                        <Input
                          id="newServiceName"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          placeholder="E.g. Advanced JS Mentorship"
                          className="h-9"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={savingService}
                        className="h-9 px-3"
                      >
                        Add
                      </Button>
                    </div>
                  </form>

                  <div className="border-t border-border pt-4">
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                      Services Catalog Templates
                    </span>
                    {servicesCatalog.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2 italic text-center">
                        No service templates created.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {servicesCatalog.map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-xs sm:text-sm">
                                {s.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {s.serviceType} • {s.basePrice.toLocaleString()}{" "}
                                Ks
                              </span>
                            </div>
                            <Button
                              onClick={() => handleDeleteService(s.id)}
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
                  <Button onClick={() => setManageServicesOpen(false)}>
                    Done
                  </Button>
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

                  {/* Sale Type Selector */}
                  <div className="space-y-2">
                    <RequiredLabel>Sale Type</RequiredLabel>
                    <Tabs
                      value={saleType}
                      onValueChange={(val) =>
                        setSaleType(val as "product" | "service")
                      }
                      className="w-full"
                    >
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="product">Product Sale</TabsTrigger>
                        <TabsTrigger value="service">Service Sale</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="customerName">
                        Customer Social Name
                      </RequiredLabel>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="E.g. John Doe Facebook"
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="customerEmail">
                        Customer Email
                      </RequiredLabel>
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
                      <RequiredLabel htmlFor="transactionName" required>
                        Transaction Name
                      </RequiredLabel>
                      <Input
                        id="transactionName"
                        value={transactionName}
                        onChange={(e) => setTransactionName(e.target.value)}
                        placeholder="E.g. John Doe 26/05/2026"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="date" required>
                        Date
                      </RequiredLabel>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="customerChannel" required>
                        Source Channel
                      </RequiredLabel>
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

                    {(saleType === "product" ||
                      (saleType === "service" && paymentType === "Full")) && (
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="method" required>
                          Transaction Method (Account)
                        </RequiredLabel>
                        <Select
                          value={transactionMethod}
                          onValueChange={(val: string) =>
                            setTransactionMethod(val)
                          }
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
                    )}
                  </div>

                  {profile?.role === "admin" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="visibility" required>
                          Visibility
                        </RequiredLabel>
                        <Select
                          value={visibility}
                          onValueChange={(val: "Shared" | "Only Me") =>
                            setVisibility(val)
                          }
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
                      <RequiredLabel htmlFor="discountType">
                        Discount Type
                      </RequiredLabel>
                      <Select
                        value={discountType}
                        onValueChange={(val) => {
                          setDiscountType(val);
                          if (val === "None") {
                            setDiscountAmount("0");
                          } else if (val !== "Custom") {
                            const selected = predefinedDiscounts.find(
                              (d) => d.id === val,
                            );
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
                          <SelectItem value="Custom">
                            Custom Discount
                          </SelectItem>
                          {predefinedDiscounts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} (Ks {d.value.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel htmlFor="discountAmount">
                        Discount Amount (Ks)
                      </RequiredLabel>
                      <Input
                        id="discountAmount"
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        disabled={
                          discountType === "None" || discountType !== "Custom"
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel htmlFor="note">
                      Note (Optional)
                    </RequiredLabel>
                    <Input
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="E.g. Special request or customer contact details"
                    />
                  </div>

                  {/* Conditional Product Form vs Service Form */}
                  {saleType === "product" ? (
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
                          No approved products exist. Please add products and
                          approve them first.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {saleItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:border-none sm:pb-0"
                            >
                              <div className="flex-1 w-full space-y-1 sm:space-y-0">
                                <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                  Product
                                </RequiredLabel>
                                <Select
                                  value={item.productId}
                                  onValueChange={(val) =>
                                    handleProductSelect(idx, val)
                                  }
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
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Price
                                  </RequiredLabel>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={item.price}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        "price",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full text-right"
                                  />
                                </div>
                                <div className="space-y-1 sm:space-y-0">
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Qty
                                  </RequiredLabel>
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        "quantity",
                                        e.target.value,
                                      )
                                    }
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
                  ) : (
                    <div className="space-y-4 border-t border-border pt-4">
                      {servicesCatalog.length > 0 && (
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="selectTemplate">
                            Saved Service Template (Optional)
                          </RequiredLabel>
                          <Select
                            onValueChange={(val) => {
                              if (val !== "custom") {
                                const selected = servicesCatalog.find(
                                  (s) => s.id === val,
                                );
                                if (selected) {
                                  setServiceType(selected.serviceType);
                                  setServiceName(selected.name);
                                  setServicePrice(
                                    selected.basePrice.toString(),
                                  );
                                }
                              }
                            }}
                          >
                            <SelectTrigger id="selectTemplate">
                              <SelectValue placeholder="Select a saved service template to autofill" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">
                                Custom (Create from scratch)
                              </SelectItem>
                              {servicesCatalog.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} ({s.serviceType} - Ks{" "}
                                  {s.basePrice.toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="serviceType" required>
                            Service Type
                          </RequiredLabel>
                          <Select
                            value={serviceType}
                            onValueChange={(val) => {
                              setServiceType(val);
                              setServiceName(val);
                            }}
                          >
                            <SelectTrigger id="serviceType">
                              <SelectValue placeholder="Select Service Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mentorship">
                                Mentorship
                              </SelectItem>
                              <SelectItem value="Zoom Class">
                                Zoom Class
                              </SelectItem>
                              <SelectItem value="Support">Support</SelectItem>
                              <SelectItem value="1 on 1 Class">
                                1 on 1 Class
                              </SelectItem>
                              <SelectItem value="Custom">
                                Custom / Other
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="serviceName" required>
                            Service Name
                          </RequiredLabel>
                          <Input
                            id="serviceName"
                            value={serviceName}
                            onChange={(e) => setServiceName(e.target.value)}
                            placeholder="E.g. Advanced JS Mentorship"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="servicePrice" required>
                            Price (Ks)
                          </RequiredLabel>
                          <Input
                            id="servicePrice"
                            type="number"
                            min="1"
                            value={servicePrice}
                            onChange={(e) => setServicePrice(e.target.value)}
                            placeholder="300000"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="paymentType" required>
                            Payment Term
                          </RequiredLabel>
                          <Select
                            value={paymentType}
                            onValueChange={(val: "Full" | "Partial") =>
                              setPaymentType(val)
                            }
                          >
                            <SelectTrigger id="paymentType">
                              <SelectValue placeholder="Select Payment Term" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full">Full Payment</SelectItem>
                              <SelectItem value="Partial">
                                Partial Payment
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {paymentType === "Partial" && (
                        <div className="space-y-4 border-t border-border/60 pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <RequiredLabel htmlFor="installmentPlan" required>
                                Installment Plan
                              </RequiredLabel>
                              <Select
                                value={installmentPlan}
                                onValueChange={(val: "2" | "3" | "custom") =>
                                  setInstallmentPlan(val)
                                }
                              >
                                <SelectTrigger id="installmentPlan">
                                  <SelectValue placeholder="Select Plan" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2">
                                    2 times paid (50% / 50%)
                                  </SelectItem>
                                  <SelectItem value="3">
                                    3 times paid (33.3% / 33.3% / 33.3%)
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    Custom Plan
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {installmentPlan === "custom" && (
                              <div className="space-y-2">
                                <RequiredLabel
                                  htmlFor="customInstallmentCount"
                                  required
                                >
                                  Number of Payments
                                </RequiredLabel>
                                <Input
                                  id="customInstallmentCount"
                                  type="number"
                                  min="2"
                                  max="12"
                                  value={customInstallmentCount}
                                  onChange={(e) =>
                                    setCustomInstallmentCount(e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block">
                              Payments Schedule
                            </span>
                            {installments.map((inst, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:pb-0 sm:border-none"
                              >
                                <div className="w-full sm:w-28 text-xs font-semibold text-muted-foreground mb-1 sm:mb-2 self-start sm:self-center">
                                  Payment #{idx + 1}
                                </div>
                                <div className="flex-1 w-full space-y-1 sm:space-y-0">
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Amount (Ks)
                                  </RequiredLabel>
                                  <Input
                                    type="number"
                                    value={inst.amount}
                                    onChange={(e) => {
                                      const newInsts = [...installments];
                                      newInsts[idx] = {
                                        ...newInsts[idx],
                                        amount: parseFloat(e.target.value) || 0,
                                      };
                                      setInstallments(newInsts);
                                    }}
                                    className="w-full text-right animate-none"
                                    disabled={installmentPlan !== "custom"}
                                  />
                                </div>
                                <div className="w-full sm:w-32 space-y-1 sm:space-y-0">
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Status
                                  </RequiredLabel>
                                  <Select
                                    value={inst.status}
                                    onValueChange={(
                                      val: "Paid" | "Pending",
                                    ) => {
                                      const newInsts = [...installments];
                                      const activeAccount = accounts.find(
                                        (a) => a.id === transactionMethod,
                                      );
                                      newInsts[idx] = {
                                        ...newInsts[idx],
                                        status: val,
                                        paidDate:
                                          val === "Paid" ? date : undefined,
                                        accountId:
                                          val === "Paid"
                                            ? transactionMethod
                                            : undefined,
                                        transactionMethod:
                                          val === "Paid"
                                            ? activeAccount?.name || ""
                                            : undefined,
                                      };
                                      setInstallments(newInsts);
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Paid">Paid</SelectItem>
                                      <SelectItem value="Pending">
                                        Pending
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {inst.status === "Paid" && (
                                  <>
                                    <div className="w-full sm:w-36 space-y-1 sm:space-y-0">
                                      <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                        Account
                                      </RequiredLabel>
                                      <Select
                                        value={inst.accountId || ""}
                                        onValueChange={(val) => {
                                          const newInsts = [...installments];
                                          const activeAccount = accounts.find(
                                            (a) => a.id === val,
                                          );
                                          newInsts[idx] = {
                                            ...newInsts[idx],
                                            accountId: val,
                                            transactionMethod:
                                              activeAccount?.name || "",
                                          };
                                          setInstallments(newInsts);
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {accounts.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                              {a.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="w-full sm:w-32 space-y-1 sm:space-y-0">
                                      <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                        Paid Date
                                      </RequiredLabel>
                                      <Input
                                        type="date"
                                        value={inst.paidDate || date}
                                        onChange={(e) => {
                                          const newInsts = [...installments];
                                          newInsts[idx] = {
                                            ...newInsts[idx],
                                            paidDate: e.target.value,
                                          };
                                          setInstallments(newInsts);
                                        }}
                                        className="w-full"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}

                            {/* Discrepancy Banner */}
                            {(() => {
                              const instSum = installments.reduce(
                                (sum, inst) => sum + inst.amount,
                                0,
                              );
                              const diff = calculatedTotal - instSum;
                              if (Math.abs(diff) > 0.01) {
                                return (
                                  <div className="p-2.5 rounded border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-950/30 dark:bg-amber-950/20 dark:text-amber-400 text-xs flex flex-col gap-1">
                                    <span className="font-semibold">
                                      Payment Schedule Discrepancy
                                    </span>
                                    <span>
                                      The installments total (Ks{" "}
                                      {instSum.toLocaleString()}) is{" "}
                                      {diff > 0 ? (
                                        <span className="font-bold text-amber-900 dark:text-amber-300">
                                          Ks {diff.toLocaleString()} less
                                        </span>
                                      ) : (
                                        <span className="font-bold text-amber-900 dark:text-amber-300">
                                          Ks {Math.abs(diff).toLocaleString()}{" "}
                                          in excess
                                        </span>
                                      )}{" "}
                                      than the total sale amount (Ks{" "}
                                      {calculatedTotal.toLocaleString()}).
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      You can still save this sale record with
                                      this discrepancy.
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col items-end border-t border-border pt-4 text-sm font-sans space-y-1">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-bold">
                        Ks {calculatedSubtotal.toLocaleString()}
                      </span>
                    </div>
                    {activeDiscountVal > 0 && (
                      <div className="flex gap-4 text-red-600 text-xs">
                        <span>Discount:</span>
                        <span>-Ks {activeDiscountVal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-base font-bold">
                      <span className="text-foreground">Total:</span>
                      <span className="text-primary">
                        Ks {calculatedTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <DialogFooter className="pt-4 gap-2">
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
                      disabled={
                        submitting ||
                        (saleType === "product" && productsCatalog.length === 0)
                      }
                    >
                      {submitting ? "Saving..." : "Save Sale"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card className="border border-border shadow-sm">
          <CardHeader className="p-2 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">
              Sales Log
            </CardTitle>
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
                    <TableHead>Products</TableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {sale.date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.customerSocialName || "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={sale.saleType === "service" ? sale.serviceName : sale.products?.map((p) => p.name).join(", ")}>
                        {sale.saleType === "service" ? (
                          sale.serviceName || "-"
                        ) : sale.products && sale.products.length > 0 ? (
                          sale.products.length > 1
                            ? `${sale.products[0].name} ..`
                            : sale.products[0].name
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {sale.transactionName}
                          </span>
                          <div className="flex gap-1.5 mt-1 items-center">
                            {sale.saleType === "service" ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200 dark:border-purple-800/30 font-normal"
                                >
                                  Service
                                </Badge>
                                {(() => {
                                  const installments = sale.installments || [];
                                  const totalInst = installments.length;
                                  const paidInst = installments.filter(
                                    (i) => i.status === "Paid",
                                  ).length;
                                  const allPaid =
                                    totalInst > 0 && paidInst === totalInst;
                                  const nonePaid = paidInst === 0;

                                  if (allPaid) {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border-green-200 dark:border-green-800/30 font-normal"
                                      >
                                        Fully Paid
                                      </Badge>
                                    );
                                  } else if (nonePaid) {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-800/30 font-normal"
                                      >
                                        Unpaid
                                      </Badge>
                                    );
                                  } else {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30 font-normal"
                                      >
                                        Partially Paid ({paidInst}/{totalInst})
                                      </Badge>
                                    );
                                  }
                                })()}
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30 font-normal"
                              >
                                Product
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-sans font-normal border-border bg-muted/30"
                        >
                          {sale.transactionMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold font-sans">
                        Ks {sale.total.toLocaleString()}
                        {sale.saleType === "service" && sale.installments && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Paid: Ks{" "}
                            {sale.installments
                              .filter((i) => i.status === "Paid")
                              .reduce((sum, i) => sum + i.amount, 0)
                              .toLocaleString()}
                          </div>
                        )}
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

              {/* Sale Type Selector */}
              <div className="space-y-2">
                <RequiredLabel>Sale Type</RequiredLabel>
                <Tabs
                  value={editSaleType}
                  onValueChange={(val) =>
                    setEditSaleType(val as "product" | "service")
                  }
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="product">Product Sale</TabsTrigger>
                    <TabsTrigger value="service">Service Sale</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerName">
                    Customer Social Name
                  </RequiredLabel>
                  <Input
                    id="editCustomerName"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="E.g. John Doe Facebook"
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerEmail">
                    Customer Email
                  </RequiredLabel>
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
                  <RequiredLabel htmlFor="editTransactionName" required>
                    Transaction Name
                  </RequiredLabel>
                  <Input
                    id="editTransactionName"
                    value={editTransactionName}
                    onChange={(e) => setEditTransactionName(e.target.value)}
                    placeholder="E.g. John Doe 26/05/2026"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editDate" required>
                    Date
                  </RequiredLabel>
                  <Input
                    id="editDate"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel htmlFor="editCustomerChannel" required>
                    Source Channel
                  </RequiredLabel>
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

                {(editSaleType === "product" ||
                  (editSaleType === "service" &&
                    editPaymentType === "Full")) && (
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="editMethod" required>
                      Transaction Method (Account)
                    </RequiredLabel>
                    <Select
                      value={editTransactionMethod}
                      onValueChange={(val: string) =>
                        setEditTransactionMethod(val)
                      }
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
                )}
              </div>

              {profile?.role === "admin" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="editVisibility" required>
                      Visibility
                    </RequiredLabel>
                    <Select
                      value={editVisibility}
                      onValueChange={(val: "Shared" | "Only Me") =>
                        setEditVisibility(val)
                      }
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
                  <RequiredLabel htmlFor="editDiscountType">
                    Discount Type
                  </RequiredLabel>
                  <Select
                    value={editDiscountType}
                    onValueChange={(val) => {
                      setEditDiscountType(val);
                      if (val === "None") {
                        setEditDiscountAmount("0");
                      } else if (val !== "Custom") {
                        const selected = predefinedDiscounts.find(
                          (d) => d.id === val,
                        );
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
                  <RequiredLabel htmlFor="editDiscountAmount">
                    Discount Amount (Ks)
                  </RequiredLabel>
                  <Input
                    id="editDiscountAmount"
                    type="number"
                    min="0"
                    value={editDiscountAmount}
                    onChange={(e) => setEditDiscountAmount(e.target.value)}
                    disabled={
                      editDiscountType === "None" ||
                      editDiscountType !== "Custom"
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <RequiredLabel htmlFor="editNote">
                  Note (Optional)
                </RequiredLabel>
                <Input
                  id="editNote"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="E.g. Special request or customer contact details"
                />
              </div>

              {/* Conditional Product Form vs Service Form */}
              {editSaleType === "product" ? (
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
                      No approved products exist. Please add products and
                      approve them first.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editSaleItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:border-none sm:pb-0"
                        >
                          <div className="flex-1 w-full space-y-1 sm:space-y-0">
                            <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                              Product
                            </RequiredLabel>
                            <Select
                              value={item.productId}
                              onValueChange={(val) =>
                                handleEditProductSelect(idx, val)
                              }
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
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                Price
                              </RequiredLabel>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={item.price}
                                onChange={(e) =>
                                  handleEditItemChange(
                                    idx,
                                    "price",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right"
                              />
                            </div>
                            <div className="space-y-1 sm:space-y-0">
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                Qty
                              </RequiredLabel>
                              <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleEditItemChange(
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
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
              ) : (
                <div className="space-y-4 border-t border-border pt-4">
                  {servicesCatalog.length > 0 && (
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="editSelectTemplate">
                        Saved Service Template (Optional)
                      </RequiredLabel>
                      <Select
                        onValueChange={(val) => {
                          if (val !== "custom") {
                            const selected = servicesCatalog.find(
                              (s) => s.id === val,
                            );
                            if (selected) {
                              setEditServiceType(selected.serviceType);
                              setEditServiceName(selected.name);
                              setEditServicePrice(
                                selected.basePrice.toString(),
                              );
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="editSelectTemplate">
                          <SelectValue placeholder="Select a saved service template to autofill" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">
                            Custom (Create from scratch)
                          </SelectItem>
                          {servicesCatalog.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.serviceType} - Ks{" "}
                              {s.basePrice.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="editServiceType" required>
                        Service Type
                      </RequiredLabel>
                      <Select
                        value={editServiceType}
                        onValueChange={(val) => {
                          setEditServiceType(val);
                          setEditServiceName(val);
                        }}
                      >
                        <SelectTrigger id="editServiceType">
                          <SelectValue placeholder="Select Service Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mentorship">Mentorship</SelectItem>
                          <SelectItem value="Zoom Class">Zoom Class</SelectItem>
                          <SelectItem value="Support">Support</SelectItem>
                          <SelectItem value="1 on 1 Class">
                            1 on 1 Class
                          </SelectItem>
                          <SelectItem value="Custom">Custom / Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="editServiceName" required>
                        Service Custom Name
                      </RequiredLabel>
                      <Input
                        id="editServiceName"
                        value={editServiceName}
                        onChange={(e) => setEditServiceName(e.target.value)}
                        placeholder="E.g. Advanced JS Mentorship"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="editServicePrice" required>
                        Price (Ks)
                      </RequiredLabel>
                      <Input
                        id="editServicePrice"
                        type="number"
                        min="1"
                        value={editServicePrice}
                        onChange={(e) => setEditServicePrice(e.target.value)}
                        placeholder="300000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="editPaymentType" required>
                        Payment Term
                      </RequiredLabel>
                      <Select
                        value={editPaymentType}
                        onValueChange={(val: "Full" | "Partial") =>
                          setEditPaymentType(val)
                        }
                      >
                        <SelectTrigger id="editPaymentType">
                          <SelectValue placeholder="Select Payment Term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full">Full Payment</SelectItem>
                          <SelectItem value="Partial">
                            Partial Payment
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {editPaymentType === "Partial" && (
                    <div className="space-y-4 border-t border-border/60 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <RequiredLabel htmlFor="editInstallmentPlan" required>
                            Installment Plan
                          </RequiredLabel>
                          <Select
                            value={editInstallmentPlan}
                            onValueChange={(val: "2" | "3" | "custom") =>
                              setEditInstallmentPlan(val)
                            }
                          >
                            <SelectTrigger id="editInstallmentPlan">
                              <SelectValue placeholder="Select Plan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">
                                2 times paid (50% / 50%)
                              </SelectItem>
                              <SelectItem value="3">
                                3 times paid (33.3% / 33.3% / 33.3%)
                              </SelectItem>
                              <SelectItem value="custom">
                                Custom Plan
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {editInstallmentPlan === "custom" && (
                          <div className="space-y-2">
                            <RequiredLabel
                              htmlFor="editCustomInstallmentCount"
                              required
                            >
                              Number of Payments
                            </RequiredLabel>
                            <Input
                              id="editCustomInstallmentCount"
                              type="number"
                              min="2"
                              max="12"
                              value={editCustomInstallmentCount}
                              onChange={(e) =>
                                setEditCustomInstallmentCount(e.target.value)
                              }
                              required
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block">
                          Payments Schedule
                        </span>
                        {editInstallments.map((inst, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border-b border-border pb-3 sm:pb-0 sm:border-none"
                          >
                            <div className="w-full sm:w-28 text-xs font-semibold text-muted-foreground mb-1 sm:mb-2 self-start sm:self-center">
                              Payment #{idx + 1}
                            </div>
                            <div className="flex-1 w-full space-y-1 sm:space-y-0">
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                Amount (Ks)
                              </RequiredLabel>
                              <Input
                                type="number"
                                value={inst.amount}
                                onChange={(e) => {
                                  const newInsts = [...editInstallments];
                                  newInsts[idx] = {
                                    ...newInsts[idx],
                                    amount: parseFloat(e.target.value) || 0,
                                  };
                                  setEditInstallments(newInsts);
                                }}
                                className="w-full text-right animate-none"
                                disabled={editInstallmentPlan !== "custom"}
                              />
                            </div>
                            <div className="w-full sm:w-32 space-y-1 sm:space-y-0">
                              <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                Status
                              </RequiredLabel>
                              <Select
                                value={inst.status}
                                onValueChange={(val: "Paid" | "Pending") => {
                                  const newInsts = [...editInstallments];
                                  const activeAccount = accounts.find(
                                    (a) => a.id === editTransactionMethod,
                                  );
                                  newInsts[idx] = {
                                    ...newInsts[idx],
                                    status: val,
                                    paidDate:
                                      val === "Paid" ? editDate : undefined,
                                    accountId:
                                      val === "Paid"
                                        ? editTransactionMethod
                                        : undefined,
                                    transactionMethod:
                                      val === "Paid"
                                        ? activeAccount?.name || ""
                                        : undefined,
                                  };
                                  setEditInstallments(newInsts);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Paid">Paid</SelectItem>
                                  <SelectItem value="Pending">
                                    Pending
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {inst.status === "Paid" && (
                              <>
                                <div className="w-full sm:w-36 space-y-1 sm:space-y-0">
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Account
                                  </RequiredLabel>
                                  <Select
                                    value={inst.accountId || ""}
                                    onValueChange={(val) => {
                                      const newInsts = [...editInstallments];
                                      const activeAccount = accounts.find(
                                        (a) => a.id === val,
                                      );
                                      newInsts[idx] = {
                                        ...newInsts[idx],
                                        accountId: val,
                                        transactionMethod:
                                          activeAccount?.name || "",
                                      };
                                      setEditInstallments(newInsts);
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {accounts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                          {a.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="w-full sm:w-32 space-y-1 sm:space-y-0">
                                  <RequiredLabel className="sm:hidden text-xs text-muted-foreground">
                                    Paid Date
                                  </RequiredLabel>
                                  <Input
                                    type="date"
                                    value={inst.paidDate || editDate}
                                    onChange={(e) => {
                                      const newInsts = [...editInstallments];
                                      newInsts[idx] = {
                                        ...newInsts[idx],
                                        paidDate: e.target.value,
                                      };
                                      setEditInstallments(newInsts);
                                    }}
                                    className="w-full"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Discrepancy Banner */}
                        {(() => {
                          const instSum = editInstallments.reduce(
                            (sum, inst) => sum + inst.amount,
                            0,
                          );
                          const diff = editCalculatedTotal - instSum;
                          if (Math.abs(diff) > 0.01) {
                            return (
                              <div className="p-2.5 rounded border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-950/30 dark:bg-amber-950/20 dark:text-amber-400 text-xs flex flex-col gap-1">
                                <span className="font-semibold">
                                  ⚠️ Payment Schedule Discrepancy
                                </span>
                                <span>
                                  The installments total (Ks{" "}
                                  {instSum.toLocaleString()}) is{" "}
                                  {diff > 0 ? (
                                    <span className="font-bold text-amber-900 dark:text-amber-300">
                                      Ks {diff.toLocaleString()} less
                                    </span>
                                  ) : (
                                    <span className="font-bold text-amber-900 dark:text-amber-300">
                                      Ks {Math.abs(diff).toLocaleString()} in
                                      excess
                                    </span>
                                  )}{" "}
                                  than the total sale amount (Ks{" "}
                                  {editCalculatedTotal.toLocaleString()}).
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  You can still save this sale record with this
                                  discrepancy.
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col items-end border-t border-border pt-4 text-sm font-sans space-y-1">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">
                    Ks {editCalculatedSubtotal.toLocaleString()}
                  </span>
                </div>
                {editActiveDiscountVal > 0 && (
                  <div className="flex gap-4 text-red-600 text-xs">
                    <span>Discount:</span>
                    <span>-Ks {editActiveDiscountVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">
                    Ks {editCalculatedTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-4 gap-2">
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
                  disabled={
                    updating ||
                    (editSaleType === "product" && productsCatalog.length === 0)
                  }
                >
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
                <span className="text-right font-medium">
                  {selectedSale.date}
                </span>

                <span className="text-muted-foreground">Customer:</span>
                <span className="text-right font-medium">
                  {selectedSale.customerSocialName || "-"}
                </span>

                <span className="text-muted-foreground">Customer Email:</span>
                <span className="text-right font-medium break-all">
                  {selectedSale.customerEmail}
                </span>

                {selectedSale.customerChannel && (
                  <>
                    <span className="text-muted-foreground">
                      Source Channel:
                    </span>
                    <span className="text-right font-medium capitalize">
                      {selectedSale.customerChannel}
                    </span>
                  </>
                )}

                <span className="text-muted-foreground">Transaction Name:</span>
                <span className="text-right font-medium">
                  {selectedSale.transactionName}
                </span>

                <span className="text-muted-foreground">Method:</span>
                <span className="text-right font-medium">
                  {selectedSale.transactionMethod}
                </span>
              </div>

              {selectedSale.saleType === "service" ? (
                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                      Service & Payments
                    </span>
                    <div className="bg-muted/30 p-2.5 rounded border border-border">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-semibold text-foreground">
                          Service Name:
                        </span>
                        <span className="text-right font-medium">
                          {selectedSale.serviceName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs sm:text-sm mt-1">
                        <span className="font-semibold text-foreground">
                          Service Type:
                        </span>
                        <span className="text-right text-muted-foreground">
                          {selectedSale.serviceType}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                      Installments Checklist
                    </span>
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {selectedSale.installments?.map((inst, idx) => (
                        <div
                          key={inst.id}
                          className="bg-muted/30 p-2.5 rounded border border-border space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="font-medium text-foreground">
                              Payment #{idx + 1}
                            </span>
                            <span className="font-bold text-primary">
                              Ks {inst.amount.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {inst.status === "Paid" ? (
                                  <Badge className="bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-none font-sans font-normal text-[10px] py-0 h-4">
                                    Paid
                                  </Badge>
                                ) : (
                                  <Badge className="bg-zinc-100 hover:bg-zinc-100 text-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400 border-none font-sans font-normal text-[10px] py-0 h-4">
                                    Pending
                                  </Badge>
                                )}
                                {inst.status === "Paid" &&
                                  inst.transactionMethod && (
                                    <span className="text-[10px] text-muted-foreground">
                                      via {inst.transactionMethod} (
                                      {inst.paidDate})
                                    </span>
                                  )}
                              </div>

                              {inst.status === "Pending" &&
                                payingInstallmentId !== inst.id && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setPayingInstallmentId(inst.id);
                                      setPayingAccountId(accounts[0]?.id || "");
                                      setPayingDate(
                                        new Date().toISOString().split("T")[0],
                                      );
                                    }}
                                    className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50/10 hover:text-emerald-500"
                                  >
                                    Mark as Paid
                                  </Button>
                                )}
                            </div>

                            {inst.status === "Pending" &&
                              payingInstallmentId === inst.id && (
                                <div className="flex flex-col gap-2 w-full mt-1 border-t border-border/60 pt-2">
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <Select
                                        value={payingAccountId}
                                        onValueChange={(val) =>
                                          setPayingAccountId(val)
                                        }
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {accounts.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                              {a.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Input
                                      type="date"
                                      value={payingDate}
                                      onChange={(e) =>
                                        setPayingDate(e.target.value)
                                      }
                                      className="h-7 text-xs w-28"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setPayingInstallmentId(null)
                                      }
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        handleMarkInstallmentPaid(inst.id)
                                      }
                                      className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      disabled={!payingAccountId}
                                    >
                                      Confirm Paid
                                    </Button>
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block">
                    Products Breakdown
                  </span>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(() => {
                      const merged: ProductItem[] = [];
                      selectedSale.products.forEach((p) => {
                        const existing = merged.find(
                          (item) => item.productId === p.productId,
                        );
                        if (existing) {
                          existing.quantity += p.quantity;
                        } else {
                          merged.push({ ...p });
                        }
                      });
                      return merged.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-muted/30 p-2 rounded border border-border"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-xs sm:text-sm">
                              {p.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Qty: {p.quantity} @ Ks {p.price.toLocaleString()}
                            </span>
                          </div>
                          <span className="font-bold text-xs sm:text-sm">
                            Ks {(p.price * p.quantity).toLocaleString()}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-end border-t border-border pt-4 space-y-1">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">
                    Ks {selectedSale.subtotal.toLocaleString()}
                  </span>
                </div>
                {selectedSale.discountAmount ? (
                  <div className="flex gap-4 text-red-600 text-xs">
                    <span>
                      Discount ({selectedSale.discountName || "Applied"}):
                    </span>
                    <span>
                      -Ks {selectedSale.discountAmount.toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {selectedSale.note ? (
                  <div className="text-xs text-muted-foreground max-w-full italic mt-2 self-start">
                    Note: {selectedSale.note}
                  </div>
                ) : null}
                <div className="flex gap-4 text-base font-bold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">
                    Ks {selectedSale.total.toLocaleString()}
                  </span>
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
