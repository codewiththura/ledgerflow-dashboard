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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, Plus, Trash2, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  approved: boolean;
  createdBy: string;
  createdAt: string;
}

export default function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Custom delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productIdToDelete, setProductIdToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form fields
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form fields
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let productsQuery;
    if (profile.role === "admin") {
      productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
    } else {
      productsQuery = query(
        collection(db, "products"), 
        where("approved", "==", true),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({ 
          id: doc.id, 
          name: data.name,
          price: data.price,
          category: data.category || "General",
          approved: data.approved,
          createdBy: data.createdBy,
          createdAt: data.createdAt
        } as Product);
      });
      setProducts(items);
      setLoading(false);
    }, (error) => {
      console.error("Products subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedPrice = parseFloat(price);

    if (!name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!category.trim()) {
      setFormError("Category is required.");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError("Price must be a valid positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const isApproved = profile?.role === "admin";
      await addDoc(collection(db, "products"), {
        name: name.trim(),
        price: parsedPrice,
        category: category.trim(),
        approved: isApproved,
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });
      
      setName("");
      setPrice("");
      setCategory("");
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Error creating product:", err);
      setFormError("Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    setEditCategory(product.category);
    setEditFormError(null);
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    setEditFormError(null);
    const parsedPrice = parseFloat(editPrice);

    if (!editName.trim()) {
      setEditFormError("Product name is required.");
      return;
    }
    if (!editCategory.trim()) {
      setEditFormError("Category is required.");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setEditFormError("Price must be a valid positive number.");
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, "products", editingProduct.id), {
        name: editName.trim(),
        price: parsedPrice,
        category: editCategory.trim(),
      });
      setEditDialogOpen(false);
      setEditingProduct(null);
    } catch (err) {
      console.error("Error updating product:", err);
      setEditFormError("Failed to update product.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "products", id), { approved: true });
    } catch (err) {
      console.error("Error approving product:", err);
    }
  };

  const triggerDelete = (id: string) => {
    setProductIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productIdToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "products", productIdToDelete));
      setDeleteConfirmOpen(false);
      setProductIdToDelete(null);
    } catch (err) {
      console.error("Error deleting product:", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <NavLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-sans tracking-tight">Product Catalog</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Manage items offered for sale.
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Enter details for the new product.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProduct} className="space-y-4 py-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <RequiredLabel htmlFor="name" required>Product Name</RequiredLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Product Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="category" required>Category</RequiredLabel>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="E.g. Electronics, Clothing"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="price" required>Standard Price</RequiredLabel>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Product"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Products List</CardTitle>
            <CardDescription className="text-xs font-sans">
              {products.length} products total in database.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-sans text-sm">
                No products found. Add a product to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Standard Price</TableHead>
                    {profile?.role === "admin" && (
                      <TableHead className="text-center">Status</TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-sans font-normal">
                          {product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${product.price.toFixed(2)}</TableCell>
                      {profile?.role === "admin" && (
                        <TableCell className="text-center">
                          {product.approved ? (
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
                          {/* Edit button available to creators/admins */}
                          {(profile?.role === "admin" || !product.approved) && (
                            <Button
                              onClick={() => handleOpenEdit(product)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-primary border-border"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {profile?.role === "admin" && (
                            <>
                              {!product.approved && (
                                <Button
                                  onClick={() => handleApprove(product.id)}
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() => triggerDelete(product.id)}
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

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the details of the product.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-4 py-4">
              {editFormError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{editFormError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-name" required>Product Name</RequiredLabel>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Product Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-category" required>Category</RequiredLabel>
                <Input
                  id="edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="E.g. Electronics, Clothing"
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="edit-price" required>Standard Price</RequiredLabel>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
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

      {/* Reusable ConfirmDialog for delete action */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Product"
        description="Are you sure you want to permanently delete this product? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </NavLayout>
  );
}
