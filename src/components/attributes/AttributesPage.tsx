import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction, 
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";

// Types
interface Category {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  subcategoryCount: number;
}

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  status: "Active" | "Inactive";
}

interface Brand {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

interface Application {
  id: string;
  name: string;
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export const AttributesPage = () => {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [subcategoryCategoryFilter, setSubcategoryCategoryFilter] = useState("all");
  const [brandSearch, setBrandSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [applicationSubcategoryFilter, setApplicationSubcategoryFilter] = useState("all");

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"category" | "subcategory" | "brand" | "application">("category");
  const [deleteId, setDeleteId] = useState<string>("");

  // Edit states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);

  // Form states
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryStatus, setNewCategoryStatus] = useState<"Active" | "Inactive">("Active");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState("");
  const [newSubcategoryStatus, setNewSubcategoryStatus] = useState<"Active" | "Inactive">("Active");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandStatus, setNewBrandStatus] = useState<"Active" | "Inactive">("Active");
  const [newApplicationName, setNewApplicationName] = useState("");
  const [newApplicationSubcategoryId, setNewApplicationSubcategoryId] = useState("");
  const [newApplicationStatus, setNewApplicationStatus] = useState<"Active" | "Inactive">("Active");

  // Filtered data
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch = cat.name.toLowerCase().includes(categorySearch.toLowerCase());
      const matchesFilter = categoryFilter === "all" || cat.id === categoryFilter;
      return matchesSearch && matchesFilter;
    });
  }, [categories, categorySearch, categoryFilter]);

  const filteredSubcategories = useMemo(() => {
    return subcategories.filter((sub) => {
      const matchesSearch = sub.name.toLowerCase().includes(subcategorySearch.toLowerCase());
      const matchesCategory = subcategoryCategoryFilter === "all" || sub.categoryId === subcategoryCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [subcategories, subcategorySearch, subcategoryCategoryFilter]);

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch = brand.name.toLowerCase().includes(brandSearch.toLowerCase());
      const matchesFilter = brandFilter === "all" || brand.id === brandFilter;
      return matchesSearch && matchesFilter;
    });
  }, [brands, brandSearch, brandFilter]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch = app.name.toLowerCase().includes(applicationSearch.toLowerCase());
      const matchesFilter = applicationFilter === "all" || app.id === applicationFilter;
      const matchesSubcategory = applicationSubcategoryFilter === "all" || app.subcategoryId === applicationSubcategoryFilter;
      return matchesSearch && matchesFilter && matchesSubcategory;
    });
  }, [applications, applicationSearch, applicationFilter, applicationSubcategoryFilter]);

  // Fetch data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, subcategoriesRes, brandsRes, applicationsRes] = await Promise.all([
        apiClient.getAllCategories(),
        apiClient.getAllSubcategories(),
        apiClient.getAllBrands(),
        apiClient.getAllApplications(),
      ]);

      // API client returns data directly (not wrapped in data property)
      // Handle categories
      if (categoriesRes.error) {
      } else if (Array.isArray(categoriesRes)) {
        setCategories(categoriesRes);
      } else if (categoriesRes.data && Array.isArray(categoriesRes.data)) {
        setCategories(categoriesRes.data);
      }

      // Handle subcategories
      if (subcategoriesRes.error) {
      } else if (Array.isArray(subcategoriesRes)) {
        setSubcategories(subcategoriesRes);
      } else if (subcategoriesRes.data && Array.isArray(subcategoriesRes.data)) {
        setSubcategories(subcategoriesRes.data);
      }

      // Handle brands
      if (brandsRes.error) {
      } else {
        const brandsArray = Array.isArray(brandsRes) ? brandsRes : (brandsRes.data && Array.isArray(brandsRes.data) ? brandsRes.data : []);
        setBrands(brandsArray.map((b: any) => ({
          ...b,
          createdAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
        })));
      }

      // Handle applications
      if (applicationsRes.error) {
      } else {
        const applicationsArray = Array.isArray(applicationsRes) ? applicationsRes : (applicationsRes.data && Array.isArray(applicationsRes.data) ? applicationsRes.data : []);
        setApplications(applicationsArray.map((a: any) => ({
          ...a,
          createdAt: a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
        })));
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load attributes data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }
    try {
      if (editingCategory) {
        const response = await apiClient.updateCategory(editingCategory.id, {
          name: newCategoryName,
          status: newCategoryStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        // API returns data directly
        if (!response.error) {
          const categoryData = response.data || response;
          setCategories((prev) =>
            prev.map((c) => (c.id === editingCategory.id ? categoryData : c))
          );
          toast({ title: "Success", description: "Category updated successfully" });
        }
      } else {
        const response = await apiClient.createCategory({
          name: newCategoryName,
          status: newCategoryStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        const categoryData = response.data || response;
        if (!response.error) {
          setCategories((prev) => [categoryData, ...prev]);
          toast({ title: "Success", description: "Category added successfully" });
        }
      }
      resetCategoryForm();
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save category", variant: "destructive" });
    }
  };

  const handleAddSubcategory = async () => {
    if (!newSubcategoryName.trim() || !newSubcategoryCategoryId) {
      toast({ title: "Error", description: "Subcategory name and category are required", variant: "destructive" });
      return;
    }
    try {
      if (editingSubcategory) {
        const response = await apiClient.updateSubcategory(editingSubcategory.id, {
          name: newSubcategoryName,
          category_id: newSubcategoryCategoryId,
          status: newSubcategoryStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        if (!response.error) {
          const subcategoryData = response.data || response;
          setSubcategories((prev) =>
            prev.map((s) => (s.id === editingSubcategory.id ? subcategoryData : s))
          );
          toast({ title: "Success", description: "Subcategory updated successfully" });
        }
      } else {
        const response = await apiClient.createSubcategory({
          name: newSubcategoryName,
          category_id: newSubcategoryCategoryId,
          status: newSubcategoryStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        const subcategoryData = response.data || response;
        if (!response.error) {
          setSubcategories((prev) => [subcategoryData, ...prev]);
          toast({ title: "Success", description: "Subcategory added successfully" });
        }
      }
      resetSubcategoryForm();
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save subcategory", variant: "destructive" });
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      toast({ title: "Error", description: "Brand name is required", variant: "destructive" });
      return;
    }
    try {
      if (editingBrand) {
        const response = await apiClient.updateBrand(editingBrand.id, {
          name: newBrandName,
          status: newBrandStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        if (!response.error) {
          const brandData = response.data || response;
          setBrands((prev) =>
            prev.map((b) => (b.id === editingBrand.id ? {
              ...brandData,
              createdAt: brandData.createdAt ? new Date(brandData.createdAt).toLocaleDateString("en-GB") : b.createdAt,
            } : b))
          );
          toast({ title: "Success", description: "Brand updated successfully" });
        }
      } else {
        const response = await apiClient.createBrand({
          name: newBrandName,
          status: newBrandStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        const brandData = response.data || response;
        if (!response.error) {
          setBrands((prev) => [{
            ...brandData,
            createdAt: brandData.createdAt ? new Date(brandData.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
          }, ...prev]);
          toast({ title: "Success", description: "Brand added successfully" });
        }
      }
      resetBrandForm();
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save brand", variant: "destructive" });
    }
  };

  const handleAddApplication = async () => {
    if (!newApplicationName.trim() || !newApplicationSubcategoryId) {
      toast({ title: "Error", description: "Application name and subcategory are required", variant: "destructive" });
      return;
    }
    try {
      if (editingApplication) {
        const response = await apiClient.updateApplication(editingApplication.id, {
          name: newApplicationName,
          subcategory_id: newApplicationSubcategoryId,
          status: newApplicationStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        if (!response.error) {
          const applicationData = response.data || response;
          setApplications((prev) =>
            prev.map((a) => (a.id === editingApplication.id ? {
              ...applicationData,
              createdAt: applicationData.createdAt ? new Date(applicationData.createdAt).toLocaleDateString("en-GB") : a.createdAt,
            } : a))
          );
          toast({ title: "Success", description: "Application updated successfully" });
        }
      } else {
        const response = await apiClient.createApplication({
          name: newApplicationName,
          subcategory_id: newApplicationSubcategoryId,
          status: newApplicationStatus,
        });
        if (response.error) {
          toast({ title: "Error", description: response.error, variant: "destructive" });
          return;
        }
        const applicationData = response.data || response;
        if (!response.error) {
          setApplications((prev) => [{
            ...applicationData,
            createdAt: applicationData.createdAt ? new Date(applicationData.createdAt).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
          }, ...prev]);
          toast({ title: "Success", description: "Application added successfully" });
        }
      }
      resetApplicationForm();
      await fetchAllData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save application", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      let response;
      if (deleteType === "category") {
        response = await apiClient.deleteCategory(deleteId);
      } else if (deleteType === "subcategory") {
        response = await apiClient.deleteSubcategory(deleteId);
      } else if (deleteType === "brand") {
        response = await apiClient.deleteBrand(deleteId);
      } else {
        response = await apiClient.deleteApplication(deleteId);
      }

      if (response.error) {
        toast({ 
          title: "Error", 
          description: response.error, 
          variant: "destructive" 
        });
        setDeleteDialogOpen(false);
        return;
      }

      // Remove from local state
      if (deleteType === "category") {
        setCategories((prev) => prev.filter((c) => c.id !== deleteId));
        toast({ title: "Success", description: "Category deleted successfully" });
      } else if (deleteType === "subcategory") {
        setSubcategories((prev) => prev.filter((s) => s.id !== deleteId));
        toast({ title: "Success", description: "Subcategory deleted successfully" });
      } else if (deleteType === "brand") {
        setBrands((prev) => prev.filter((b) => b.id !== deleteId));
        toast({ title: "Success", description: "Brand deleted successfully" });
      } else {
        setApplications((prev) => prev.filter((a) => a.id !== deleteId));
        toast({ title: "Success", description: "Application deleted successfully" });
      }
      setDeleteDialogOpen(false);
      await fetchAllData();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete", 
        variant: "destructive" 
      });
      setDeleteDialogOpen(false);
    }
  };

  const resetCategoryForm = () => {
    setNewCategoryName("");
    setNewCategoryStatus("Active");
    setEditingCategory(null);
    setCategoryDialogOpen(false);
  };

  const resetSubcategoryForm = () => {
    setNewSubcategoryName("");
    setNewSubcategoryCategoryId("");
    setNewSubcategoryStatus("Active");
    setEditingSubcategory(null);
    setSubcategoryDialogOpen(false);
  };

  const resetBrandForm = () => {
    setNewBrandName("");
    setNewBrandStatus("Active");
    setEditingBrand(null);
    setBrandDialogOpen(false);
  };

  const resetApplicationForm = () => {
    setNewApplicationName("");
    setNewApplicationSubcategoryId("");
    setNewApplicationStatus("Active");
    setEditingApplication(null);
    setApplicationDialogOpen(false);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryStatus(category.status);
    setCategoryDialogOpen(true);
  };

  const openEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setNewSubcategoryName(subcategory.name);
    setNewSubcategoryCategoryId(subcategory.categoryId);
    setNewSubcategoryStatus(subcategory.status);
    setSubcategoryDialogOpen(true);
  };

  const openEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setNewBrandName(brand.name);
    setNewBrandStatus(brand.status);
    setBrandDialogOpen(true);
  };

  const openEditApplication = (application: Application) => {
    setEditingApplication(application);
    setNewApplicationName(application.name);
    setNewApplicationSubcategoryId(application.subcategoryId);
    setNewApplicationStatus(application.status);
    setApplicationDialogOpen(true);
  };

  const openDeleteDialog = (type: "category" | "subcategory" | "brand" | "application", id: string) => {
    setDeleteType(type);
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  // Status toggle handlers
  const toggleCategoryStatus = async (category: Category) => {
    const newStatus = category.status === "Active" ? "Inactive" : "Active";
    
    // If trying to set inactive, check for active subcategories
    if (newStatus === "Inactive") {
      const activeSubcategories = subcategories.filter(
        (s) => s.categoryId === category.id && s.status === "Active"
      );
      if (activeSubcategories.length > 0) {
        toast({ 
          title: "Cannot Deactivate Category", 
          description: `This category has ${activeSubcategories.length} active subcategorie(s). Please deactivate all subcategories first before deactivating this category.`, 
          variant: "destructive" 
        });
        return;
      }
    }
    
    try {
      const response = await apiClient.updateCategory(category.id, {
        name: category.name,
        status: newStatus,
      });
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
        return;
      }
      if (!response.error) {
        const categoryData = response.data || response;
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? categoryData : c))
        );
        toast({ title: "Status Updated", description: `Category "${category.name}" is now ${newStatus}` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  };

  const toggleSubcategoryStatus = async (subcategory: Subcategory) => {
    const newStatus = subcategory.status === "Active" ? "Inactive" : "Active";
    
    try {
      const response = await apiClient.updateSubcategory(subcategory.id, {
        name: subcategory.name,
        category_id: subcategory.categoryId,
        status: newStatus,
      });
      if (response.error) {
        toast({ 
          title: "Error", 
          description: response.error, 
          variant: "destructive" 
        });
        return;
      }
      if (!response.error) {
        const subcategoryData = response.data || response;
        setSubcategories((prev) =>
          prev.map((s) => (s.id === subcategory.id ? subcategoryData : s))
        );
        toast({ title: "Status Updated", description: `Subcategory "${subcategory.name}" is now ${newStatus}` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  };

  const toggleBrandStatus = async (brand: Brand) => {
    const newStatus = brand.status === "Active" ? "Inactive" : "Active";
    try {
      const response = await apiClient.updateBrand(brand.id, {
        name: brand.name,
        status: newStatus,
      });
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
        return;
      }
      if (!response.error) {
        const brandData = response.data || response;
        setBrands((prev) =>
          prev.map((b) => (b.id === brand.id ? {
            ...brandData,
            createdAt: brandData.createdAt ? new Date(brandData.createdAt).toLocaleDateString("en-GB") : b.createdAt,
          } : b))
        );
        toast({ title: "Status Updated", description: `Brand "${brand.name}" is now ${newStatus}` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  };

  const toggleApplicationStatus = async (application: Application) => {
    const newStatus = application.status === "Active" ? "Inactive" : "Active";
    try {
      const response = await apiClient.updateApplication(application.id, {
        name: application.name,
        subcategory_id: application.subcategoryId,
        status: newStatus,
      });
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
        return;
      }
      if (!response.error) {
        const applicationData = response.data || response;
        setApplications((prev) =>
          prev.map((a) => (a.id === application.id ? {
            ...applicationData,
            createdAt: applicationData.createdAt ? new Date(applicationData.createdAt).toLocaleDateString("en-GB") : a.createdAt,
          } : a))
        );
        toast({ title: "Status Updated", description: `Application "${application.name}" is now ${newStatus}` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading attributes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Attributes</h1>
      </div>

      {/* Four Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Categories List */}
        <div className="bg-card rounded-xl border border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between mb-3 min-h-[40px]">
              <div>
                <h3 className="text-base font-semibold text-foreground">Categories List</h3>
              </div>
              <Button size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => setCategoryDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add New
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32 h-8 text-xs border-border">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm text-muted-foreground">All ({filteredCategories.length})</p>
          </div>
          <div className="p-3 space-y-2">
            {filteredCategories.map((category) => (
              <div key={category.id} className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{category.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEditCategory(category)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => openDeleteDialog("category", category.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub Category List */}
        <div className="bg-card rounded-xl border border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between mb-3 min-h-[40px]">
              <div>
                <h3 className="text-base font-semibold text-foreground">Sub Category List</h3>
              </div>
              <Button size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => setSubcategoryDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add New
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={subcategoryCategoryFilter} onValueChange={setSubcategoryCategoryFilter}>
                <SelectTrigger className="w-32 h-8 text-xs border-border">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search sub categories..."
                value={subcategorySearch}
                onChange={(e) => setSubcategorySearch(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm text-muted-foreground">All ({filteredSubcategories.length})</p>
          </div>
          <div className="p-3 space-y-2">
            {filteredSubcategories.map((subcategory) => (
              <div key={subcategory.id} className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {subcategory.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subcategory.categoryName}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEditSubcategory(subcategory)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => openDeleteDialog("subcategory", subcategory.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brands List */}
        <div className="bg-card rounded-xl border border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between mb-3 min-h-[40px]">
              <div>
                <h3 className="text-base font-semibold text-foreground">Brands List</h3>
              </div>
              <Button size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => setBrandDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add New
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-32 h-8 text-xs border-border">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm text-muted-foreground">All ({filteredBrands.length})</p>
          </div>
          <div className="p-3 space-y-2">
            {filteredBrands.map((brand) => (
              <div key={brand.id} className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{brand.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEditBrand(brand)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => openDeleteDialog("brand", brand.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Applications List */}
        <div className="bg-card rounded-xl border border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between mb-3 min-h-[40px]">
              <div>
                <h3 className="text-base font-semibold text-foreground">Applications List</h3>
              </div>
              <Button size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => setApplicationDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add New
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={applicationSubcategoryFilter} onValueChange={setApplicationSubcategoryFilter}>
                <SelectTrigger className="w-32 h-8 text-xs border-border">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search applications..."
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm text-muted-foreground">All ({filteredApplications.length})</p>
          </div>
          <div className="p-3 space-y-2">
            {filteredApplications.map((application) => (
              <div key={application.id} className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {application.name}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openEditApplication(application)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => openDeleteDialog("application", application.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={(open) => { if (!open) resetCategoryForm(); else setCategoryDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Category Name *</label>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Enter category name" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Status</label>
              <Select value={newCategoryStatus} onValueChange={(v) => setNewCategoryStatus(v as "Active" | "Inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCategoryForm}>Cancel</Button>
            <Button onClick={handleAddCategory}>{editingCategory ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subcategoryDialogOpen} onOpenChange={(open) => { if (!open) resetSubcategoryForm(); else setSubcategoryDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edit Subcategory" : "Add New Subcategory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Subcategory Name *</label>
              <Input value={newSubcategoryName} onChange={(e) => setNewSubcategoryName(e.target.value)} placeholder="Enter subcategory name" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Parent Category *</label>
              <Select value={newSubcategoryCategoryId} onValueChange={setNewSubcategoryCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Status</label>
              <Select value={newSubcategoryStatus} onValueChange={(v) => setNewSubcategoryStatus(v as "Active" | "Inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetSubcategoryForm}>Cancel</Button>
            <Button onClick={handleAddSubcategory}>{editingSubcategory ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Dialog */}
      <Dialog open={brandDialogOpen} onOpenChange={(open) => { if (!open) resetBrandForm(); else setBrandDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Add New Brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Brand Name *</label>
              <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Enter brand name" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Status</label>
              <Select value={newBrandStatus} onValueChange={(v) => setNewBrandStatus(v as "Active" | "Inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetBrandForm}>Cancel</Button>
            <Button onClick={handleAddBrand}>{editingBrand ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteType}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteType}? This action cannot be undone.
              {deleteType === "category" && " All subcategories under this category will also be deleted."}
              {deleteType === "application" && " This application will be removed from all parts using it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};