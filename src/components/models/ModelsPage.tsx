import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";

interface Item {
  id: string;
  masterPartNo: string;
  partNo: string;
  brand: string;
  description: string;
  category: string;
  subCategory: string;
  application: string;
  status: string;
  images: string[];
}

interface Model {
  id: string;
  name: string;
  qtyUsed: number;
  partId: string;
}

export const ModelsPage = () => {
  const [masterPartSearch, setMasterPartSearch] = useState("");
  const [selectedMasterPart, setSelectedMasterPart] = useState<string | null>(null);
  const [partNoSearch, setPartNoSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<Item | null>(null);
  const [showMasterDropdown, setShowMasterDropdown] = useState(false);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  
  // Models state
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Inline editing states
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  
  // Add new model inline state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelQty, setNewModelQty] = useState("");
  
  // Delete state
  const [deleteModelOpen, setDeleteModelOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<Model | null>(null);

  const masterDropdownRef = useRef<HTMLDivElement>(null);
  const partDropdownRef = useRef<HTMLDivElement>(null);

  // State for parts fetched from API
  const [parts, setParts] = useState<Item[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  // Fetch initial parts on mount
  useEffect(() => {
    const fetchInitialParts = async () => {
      setLoadingParts(true);
      try {
        const response = await apiClient.getParts({
          limit: 1000,
          page: 1,
        });
        
        if (response.error) {
          console.error('Error fetching parts:', response.error);
          setParts([]);
        } else {
          const responseData = response.data as any;
          let partsData: any[] = [];
          
          if (Array.isArray(responseData)) {
            partsData = responseData;
          } else if (responseData && Array.isArray(responseData.data)) {
            partsData = responseData.data;
          }

          // Transform API data to Item format
          // SWAPPED: partNo shows master_part_no (actual Part No), masterPartNo shows part_no (Master Part No)
          const transformedParts: Item[] = partsData.map((p: any) => ({
            id: p.id,
            masterPartNo: p.part_no || p.masterPartNo || "",
            partNo: p.master_part_no || p.partNo || "",
            brand: p.brand_name || p.brand || "",
            description: p.description || "",
            category: p.category_name || p.category || "",
            subCategory: p.subcategory_name || p.subcategory || "",
            application: p.application_name || p.application || "",
            status: p.status || "active",
            images: [],
          }));

          setParts(transformedParts);
        }
      } catch (error: any) {
        console.error('Error fetching initial parts:', error);
        setParts([]);
      } finally {
        setLoadingParts(false);
      }
    };

    fetchInitialParts();
  }, []);

  // Get unique master part numbers
  const masterPartNumbers = useMemo(() => {
    const uniqueMasters = [...new Set(parts.map((item) => item.masterPartNo))].filter(Boolean);
    if (masterPartSearch) {
      return uniqueMasters.filter((master) =>
        master.toLowerCase().includes(masterPartSearch.toLowerCase())
      );
    }
    return uniqueMasters;
  }, [parts, masterPartSearch]);

  // State for API-fetched parts (when searching)
  const [apiParts, setApiParts] = useState<Item[]>([]);

  // Fetch parts from API when searching
  useEffect(() => {
    const fetchPartsFromAPI = async () => {
      if (!partNoSearch || partNoSearch.length < 2) {
        setApiParts([]);
        return;
      }

      setLoadingParts(true);
      try {
        const params: any = {
          limit: 100,
          page: 1,
        };

        // Use general search parameter for partial matching (works with 2+ characters)
        // This will search across part_no, master_part_no, description, brand, etc.
        if (partNoSearch && partNoSearch.trim().length >= 2) {
          params.search = partNoSearch.trim();
        }

        const response = await apiClient.getParts(params);
        if (response.error) {
          console.error('Error fetching parts:', response.error);
          setApiParts([]);
        } else {
          const responseData = response.data as any;
          let partsData: any[] = [];
          
          if (Array.isArray(responseData)) {
            partsData = responseData;
          } else if (responseData && Array.isArray(responseData.data)) {
            partsData = responseData.data;
          }

          // Transform API data to Item format
          // SWAPPED: partNo shows master_part_no (actual Part No), masterPartNo shows part_no (Master Part No)
          const transformedParts: Item[] = partsData.map((p: any) => ({
            id: p.id,
            masterPartNo: p.part_no || p.masterPartNo || "",
            partNo: p.master_part_no || p.partNo || "",
            brand: p.brand_name || p.brand || "",
            description: p.description || "",
            category: p.category_name || p.category || "",
            subCategory: p.subcategory_name || p.subcategory || "",
            application: p.application_name || p.application || "",
            status: p.status || "active",
            images: [],
          }));

          setApiParts(transformedParts);
        }
      } catch (error: any) {
        console.error('Error fetching parts from API:', error);
        setApiParts([]);
      } finally {
        setLoadingParts(false);
      }
    };

    // Debounce API calls
    const timeoutId = setTimeout(() => {
      fetchPartsFromAPI();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [partNoSearch]);

  // Filter parts based on search by part_no (not master_part_no)
  const filteredParts = useMemo(() => {
    // Use API-fetched parts if searching, otherwise use parts from state
    const sourceParts = partNoSearch && partNoSearch.length >= 2 ? apiParts : parts;
    
    let filtered = sourceParts;
    
    // Apply client-side filtering for partial matching when searching
    if (partNoSearch && partNoSearch.trim().length >= 2) {
      const searchTerm = partNoSearch.trim().toLowerCase();
      filtered = sourceParts.filter((item) =>
        item.partNo.toLowerCase().includes(searchTerm) ||
        item.masterPartNo.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.brand.toLowerCase().includes(searchTerm)
      );
    } else if (partNoSearch && partNoSearch.length < 2) {
      // For very short searches (1 character), filter from parts array
      filtered = parts.filter(
        (item) =>
          item.partNo.toLowerCase().includes(partNoSearch.toLowerCase()) ||
          item.description.toLowerCase().includes(partNoSearch.toLowerCase()) ||
          item.brand.toLowerCase().includes(partNoSearch.toLowerCase())
      );
    }
    return filtered;
  }, [parts, apiParts, partNoSearch]);

  // Get models for selected part
  const partModels = useMemo(() => {
    if (!selectedPart) return [];
    return models.filter((model) => model.partId === selectedPart.id);
  }, [models, selectedPart]);

  // Fetch models when a part is selected
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedPart) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      try {
        const response = await apiClient.getPart(selectedPart.id);
        
        if (response.error) {
          toast({
            title: "Error",
            description: response.error || "Failed to fetch models",
            variant: "destructive",
          });
          setModels([]);
        } else {
          // The API client returns the response object directly
          // Backend returns: { id, part_no, models: [...], ... }
          // So models are directly on the response object
          const responseData = (response as any).data || response;
          const apiModels = responseData?.models || [];
          
          const transformedModels: Model[] = apiModels.map((m: any) => ({
            id: m.id,
            name: m.name,
            qtyUsed: m.qty_used || m.qtyUsed || 1,
            partId: selectedPart.id,
          }));
          
          setModels(transformedModels);
        }
      } catch (error: any) {
        console.error("Error fetching models:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch models",
          variant: "destructive",
        });
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedPart]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (masterDropdownRef.current && !masterDropdownRef.current.contains(event.target as Node)) {
        setShowMasterDropdown(false);
      }
      if (partDropdownRef.current && !partDropdownRef.current.contains(event.target as Node)) {
        setShowPartDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMasterPart = (master: string) => {
    setSelectedMasterPart(master);
    setMasterPartSearch(master);
    setShowMasterDropdown(false);
    // Reset part selection when master changes
    setSelectedPart(null);
    setPartNoSearch("");
  };

  const handleSelectPart = (part: Item) => {
    setSelectedPart(part);
    setPartNoSearch(part.partNo);
    setShowPartDropdown(false);
    // Clear API parts after selection
    setApiParts([]);
    // Models will be fetched automatically via useEffect
  };

  // Also allow direct part number search (if user types exact part number and presses Enter)
  const handlePartNoKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && partNoSearch && partNoSearch.trim()) {
      // Try to find the part directly by master_part_no (Part No, not part_no which is Master Part No)
      try {
        const params: any = {
          master_part_no: partNoSearch.trim(),
          limit: 1,
        };
        
        const response = await apiClient.getParts(params);
        if (!response.error && response.data) {
          const responseData = response.data as any;
          let partsData: any[] = [];
          
          if (Array.isArray(responseData)) {
            partsData = responseData;
          } else if (responseData && Array.isArray(responseData.data)) {
            partsData = responseData.data;
          }

          if (partsData.length > 0) {
            const part = partsData[0];
            // SWAPPED: partNo shows master_part_no (actual Part No), masterPartNo shows part_no (Master Part No)
            const transformedPart: Item = {
              id: part.id,
              masterPartNo: part.part_no || part.masterPartNo || "",
              partNo: part.master_part_no || part.partNo || "",
              brand: part.brand_name || part.brand || "",
              description: part.description || "",
              category: part.category_name || part.category || "",
              subCategory: part.subcategory_name || part.subcategory || "",
              application: part.application_name || part.application || "",
              status: part.status || "active",
              images: [],
            };
            handleSelectPart(transformedPart);
          }
        }
      } catch (error) {
        console.error('Error searching for part:', error);
      }
    }
  };

  // Save models to backend
  const saveModelsToBackend = async (updatedModels: Model[]) => {
    if (!selectedPart) return;

    try {
      // Transform models to API format
      const modelsForApi = updatedModels.map((m) => ({
        name: m.name,
        qty_used: m.qtyUsed,
      }));

      const response = await apiClient.updatePart(selectedPart.id, {
        models: modelsForApi,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return true;
    } catch (error: any) {
      console.error("Error saving models:", error);
      throw error;
    }
  };

  // Inline Add Model
  const handleStartAddModel = () => {
    setIsAddingNew(true);
    setNewModelName("");
    setNewModelQty("1");
  };

  const handleSaveNewModel = async () => {
    if (!selectedPart || !newModelName.trim()) return;
    
    const newModel: Model = {
      id: Date.now().toString(), // Temporary ID, will be replaced by backend
      name: newModelName.trim(),
      qtyUsed: parseInt(newModelQty) || 1,
      partId: selectedPart.id,
    };
    
    const updatedModels = [...models, newModel];
    
    try {
      await saveModelsToBackend(updatedModels);
      // Refresh models from backend to get the actual IDs
      const response = await apiClient.getPart(selectedPart.id);
      if (!response.error) {
        const responseData = (response as any).data || response;
        const apiModels = responseData?.models || [];
        const transformedModels: Model[] = apiModels.map((m: any) => ({
          id: m.id,
          name: m.name,
          qtyUsed: m.qty_used || m.qtyUsed || 1,
          partId: selectedPart.id,
        }));
        setModels(transformedModels);
      }
      setNewModelName("");
      setNewModelQty("");
      setIsAddingNew(false);
      toast({ title: "Model added successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save model",
        variant: "destructive",
      });
    }
  };

  const handleCancelAddModel = () => {
    setIsAddingNew(false);
    setNewModelName("");
    setNewModelQty("");
  };

  // Inline Edit Model
  const handleStartEdit = (model: Model) => {
    setEditingModelId(model.id);
    setEditName(model.name);
    setEditQty(model.qtyUsed.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingModelId || !editName.trim()) return;
    
    const updatedModels = models.map((m) =>
      m.id === editingModelId
        ? { ...m, name: editName.trim(), qtyUsed: parseInt(editQty) || 1 }
        : m
    );
    
    try {
      await saveModelsToBackend(updatedModels);
      setModels(updatedModels);
      setEditingModelId(null);
      setEditName("");
      setEditQty("");
      toast({ title: "Model updated successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update model",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingModelId(null);
    setEditName("");
    setEditQty("");
  };

  // Delete Model
  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    
    const updatedModels = models.filter((m) => m.id !== modelToDelete.id);
    
    try {
      await saveModelsToBackend(updatedModels);
      setModels(updatedModels);
      setModelToDelete(null);
      setDeleteModelOpen(false);
      toast({ title: "Model deleted successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete model",
        variant: "destructive",
      });
    }
  };

  const openDeleteModel = (model: Model) => {
    setModelToDelete(model);
    setDeleteModelOpen(true);
  };

  const handleRefresh = async () => {
    // Cancel any unsaved new entry
    if (isAddingNew) {
      setIsAddingNew(false);
      setNewModelName("");
      setNewModelQty("");
    }
    // Cancel any editing
    if (editingModelId) {
      setEditingModelId(null);
      setEditName("");
      setEditQty("");
    }
    
      // Re-fetch models from backend
      if (selectedPart) {
        setLoadingModels(true);
        try {
          const response = await apiClient.getPart(selectedPart.id);
          if (response.error) {
            toast({
              title: "Error",
              description: response.error || "Failed to refresh models",
              variant: "destructive",
            });
          } else {
            // The API client returns the response object directly
            const responseData = (response as any).data || response;
            const apiModels = responseData?.models || [];
            const transformedModels: Model[] = apiModels.map((m: any) => ({
              id: m.id,
              name: m.name,
              qtyUsed: m.qty_used || m.qtyUsed || 1,
              partId: selectedPart.id,
            }));
            setModels(transformedModels);
            toast({ title: "Data refreshed" });
          }
        } catch (error: any) {
          console.error("Error refreshing models:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to refresh models",
            variant: "destructive",
          });
        } finally {
          setLoadingModels(false);
        }
      } else {
        toast({ title: "Data refreshed" });
      }
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-8 bg-primary rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Models Management</h1>
            <p className="text-sm text-muted-foreground">
              Select a part to view its models and quantity used
            </p>
          </div>
        </div>
      </div>

      {/* Model Selection Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Model Selection</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Master Part Number Field - Hidden but functionality preserved */}
          <div ref={masterDropdownRef} className="relative hidden">
            <label className="block text-sm font-medium text-foreground mb-2">
              Master Part Number
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search master part number..."
                value={masterPartSearch}
                onChange={(e) => {
                  setMasterPartSearch(e.target.value);
                  setShowMasterDropdown(true);
                  if (e.target.value !== selectedMasterPart) {
                    setSelectedMasterPart(null);
                  }
                }}
                onFocus={() => setShowMasterDropdown(true)}
                className={cn(
                  "pl-10 h-10",
                  showMasterDropdown && "ring-2 ring-primary border-primary"
                )}
              />
            </div>
            {selectedMasterPart && (
              <p className="text-xs text-muted-foreground mt-2">
                Only parts with this master part number will be shown
              </p>
            )}

            {/* Master Part Dropdown */}
            {showMasterDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                {masterPartNumbers.length > 0 ? (
                  masterPartNumbers.map((master) => (
                    <button
                      key={master}
                      onClick={() => handleSelectMasterPart(master)}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors border-b border-border last:border-b-0",
                        selectedMasterPart === master && "bg-muted"
                      )}
                    >
                      {master}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No master part numbers found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Part No Field */}
          <div ref={partDropdownRef} className="relative">
            <label className="block text-sm font-medium text-foreground mb-2">
              Part No <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by part number, description, or brand..."
                value={partNoSearch}
                onChange={(e) => {
                  setPartNoSearch(e.target.value);
                  setShowPartDropdown(true);
                  if (e.target.value !== selectedPart?.partNo) {
                    setSelectedPart(null);
                  }
                }}
                onKeyDown={handlePartNoKeyDown}
                onFocus={() => setShowPartDropdown(true)}
                className={cn(
                  "pl-10 h-10",
                  showPartDropdown && "ring-2 ring-primary border-primary"
                )}
              />
            </div>

            {/* Part Dropdown */}
            {showPartDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-auto">
                {loadingParts ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    Searching...
                  </div>
                ) : filteredParts.length > 0 ? (
                  filteredParts.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => handleSelectPart(part)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-b-0",
                        selectedPart?.id === part.id && "bg-muted"
                      )}
                    >
                      <p className="font-medium text-foreground text-sm">{part.partNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {part.description?.replace(/\s*\(Grade:\s*[A-Z0-9]+\)/gi, '').trim() || ''}
                        {part.application && ` (${part.application})`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Brand: {part.brand} &nbsp;&nbsp; Category: {part.category || "-"}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    {partNoSearch && partNoSearch.length >= 2 
                      ? "No parts found. Try a different search term."
                      : "No parts found"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Models Table */}
      {selectedPart && (
        <div className="mt-6 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Models for {selectedPart.partNo}
                </h2>
                <p className="text-sm text-muted-foreground">{selectedPart.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleStartAddModel} disabled={isAddingNew}>
                <Plus className="w-4 h-4" />
                Add Model
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Model</TableHead>
                  <TableHead className="font-semibold text-center w-40">Qty. Used</TableHead>
                  <TableHead className="font-semibold text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Add New Model Row */}
                {isAddingNew && (
                  <TableRow>
                    <TableCell>
                      <Input
                        placeholder="Enter model name..."
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        className="h-9"
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="1"
                        value={newModelQty}
                        onChange={(e) => setNewModelQty(e.target.value)}
                        className="h-9 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSaveNewModel}>
                          Save
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={handleCancelAddModel}>
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Existing Models */}
                {loadingModels ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Loading models...
                    </TableCell>
                  </TableRow>
                ) : partModels.length > 0 ? (
                  partModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        {editingModelId === model.id ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-9"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-medium cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleStartEdit(model)}
                          >
                            {model.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingModelId === model.id ? (
                          <Input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="h-9 text-center"
                          />
                        ) : (
                          <span className="flex justify-center">{model.qtyUsed}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {editingModelId === model.id ? (
                            <>
                              <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSaveEdit}>
                                Save
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <button
                              onClick={() => openDeleteModel(model)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : !isAddingNew ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No models found for this part. Click "Add Model" to create one.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          
          {/* Reset Button */}
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="px-6"
              onClick={handleRefresh}
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteModelOpen} onOpenChange={setDeleteModelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{modelToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
