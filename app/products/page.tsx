"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, Edit } from "lucide-react";
import { RequiredLabel } from "@/components/required-label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  createdBy: string;
  createdAt: string;
}

export default function ProductsPage() {
  const { profile } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Categories states
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

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

  // Predefined categories real-time listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: { id: string; name: string }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name
        });
      });
      setCategories(list);
    }, (err) => {
      console.error("Categories subscription error:", err);
    });
    return () => unsubscribe();
  }, [profile]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    if (!newCategoryName.trim()) {
      setCategoryError("Category name is required.");
      return;
    }

    setSavingCategory(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: newCategoryName.trim(),
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString()
      });
      setNewCategoryName("");
    } catch (err) {
      console.error("Error creating category:", err);
      setCategoryError("Failed to save category.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (err) {
      console.error("Error deleting category:", err);
    }
  };

  const createProductsQuery = React.useCallback(() => {
    return query(collection(db, "products"), orderBy("createdAt", "desc"));
  }, []);

  const {
    items: products,
    loading,
    page,
    pageSize,
    setPageSize,
    totalCount,
    hasMore,
    nextPage,
    prevPage,
    refresh
  } = useFirestorePagination<Product>(
    createProductsQuery,
    10,
    [],
    !!profile
  );

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
      await addDoc(collection(db, "products"), {
        name: name.trim(),
        price: parsedPrice,
        category: category.trim(),
        createdBy: profile?.uid || "",
        createdAt: new Date().toISOString(),
      });
      
      setName("");
      setPrice("");
      setCategory("");
      setCreateDialogOpen(false);
      await refresh();
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
      const updatedFields = {
        name: editName.trim(),
        price: parsedPrice,
        category: editCategory.trim(),
      };
      
      await updateDoc(doc(db, "products", editingProduct.id), updatedFields);
      setEditDialogOpen(false);
      setEditingProduct(null);
      await refresh();
    } catch (err) {
      console.error("Error updating product:", err);
      setEditFormError("Failed to update product.");
    } finally {
      setUpdating(false);
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
      await refresh();
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

          <div className="flex flex-wrap gap-2 items-center">
            {/* Manage Categories Dialog */}
            <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Manage Categories</DialogTitle>
                  <DialogDescription>
                    Create or delete product categories.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <form onSubmit={handleAddCategory} className="flex gap-2">
                    <Input
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      required
                    />
                    <Button type="submit" disabled={savingCategory}>
                      {savingCategory ? "Adding..." : "Add"}
                    </Button>
                  </form>
                  {categoryError && (
                    <p className="text-xs text-destructive">{categoryError}</p>
                  )}
                  <div className="border-t border-border pt-4">
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider block mb-2">Category List</span>
                    {categories.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-4 text-center">
                        No categories created.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {categories.map((cat) => (
                          <div key={cat.id} className="flex justify-between items-center bg-muted/40 p-2 rounded border border-border">
                            <span className="font-medium text-sm">{cat.name}</span>
                            <Button
                              onClick={() => handleDeleteCategory(cat.id)}
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
                  <Button onClick={() => setManageCategoriesOpen(false)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Product Dialog */}
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
                    {categories.length === 0 ? (
                      <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                        No categories created. Please add one first using &quot;Manage Categories&quot;.
                      </div>
                    ) : (
                      <Select
                        value={category}
                        onValueChange={setCategory}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                    <Button type="submit" disabled={submitting || categories.length === 0}>
                      {submitting ? "Saving..." : "Save Product"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 sm:p-6 border-b border-border">
            <CardTitle className="text-md font-bold font-sans">Products List</CardTitle>
            <CardDescription className="text-xs font-sans">
              {totalCount} products total in database.
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
                      <TableCell className="text-right">Ks {product.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleOpenEdit(product)}
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-primary border-border"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {profile?.role === "admin" && (
                            <Button
                              onClick={() => triggerDelete(product.id)}
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
          {!loading && products.length > 0 && (
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
                {categories.length === 0 ? (
                  <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                    No categories created. Please add one first using &quot;Manage Categories&quot;.
                  </div>
                ) : (
                  <Select
                    value={editCategory}
                    onValueChange={setEditCategory}
                  >
                    <SelectTrigger id="edit-category">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                <Button type="submit" disabled={updating || categories.length === 0}>
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
