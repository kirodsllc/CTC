import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Loader2, Package, Edit, Trash2, RefreshCw, ChevronDown, ChevronRight, Archive, Layers, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types
interface Rack {
  id: string;
  codeNo: string;
  store: string;
  storeId?: string;
  description: string;
  status: "Active" | "Inactive";
  shelfCount: number;
  itemsCount?: number;
  remainingQuantity?: number;
  items?: Array<{ partNo: string; description: string; quantity: number }>;
}

interface Shelf {
  id: string;
  shelfNo: string;
  rackId: string;
  rackCode: string;
  store: string;
  description: string;
  status: "Active" | "Inactive";
  itemsCount?: number;
  remainingQuantity?: number;
  items?: Array<{ partNo: string; description: string; quantity: number }>;
}

interface Store {
  id: string;
  name: string;
}

type FormMode = "list" | "create-rack" | "edit-rack" | "create-shelf" | "edit-shelf";

export const RackAndShelf = () => {
  // Data state
  const [racks, setRacks] = useState<Rack[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [rackStoreId, setRackStoreId] = useState("");
  const [stockData, setStockData] = useState<Record<string, { 
    itemsCount: number; 
    remainingQuantity: number;
    items: Array<{ partNo: string; description: string; quantity: number }>;
  }>>({});

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");

  // Form mode
  const [formMode, setFormMode] = useState<FormMode>("list");
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  
  // Dialog states
  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [shelfDialogOpen, setShelfDialogOpen] = useState(false);
  const [combinedDialogOpen, setCombinedDialogOpen] = useState(false);
  
  // Combined form state (rack + shelves)
  const [combinedStoreId, setCombinedStoreId] = useState("");
  const [combinedRackName, setCombinedRackName] = useState("");
  const [combinedShelfNames, setCombinedShelfNames] = useState<string[]>([""]);

  // Rack form state
  const [rackCodeNo, setRackCodeNo] = useState("");
  const [rackStore, setRackStore] = useState("");
  const [rackDescription, setRackDescription] = useState("");
  const [rackStatus, setRackStatus] = useState<"Active" | "Inactive">("Active");

  // Load data on mount
  useEffect(() => {
    loadStores();
    loadRacks();
    loadShelves();
  }, []);

  // Load stock data when racks/shelves change
  useEffect(() => {
    if (racks.length > 0 || shelves.length > 0) {
      // Add a small delay to ensure racks/shelves are fully loaded
      const timer = setTimeout(() => {
      loadStockData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [racks, shelves]);
  
  // Also reload stock data on component mount after a delay to catch any async updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (racks.length > 0 || shelves.length > 0) {
        loadStockData();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const loadStores = async () => {
    try {
      const response = await apiClient.getStores("active");
      const storesData = response.data || response;
      if (Array.isArray(storesData)) {
        setStores(storesData.map((s: any) => ({ id: s.id, name: s.name })));
      }
    } catch (error: any) {
    }
  };

  const loadRacks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRacks();
      const racksData = response.data || response;
      if (Array.isArray(racksData)) {
        setRacks(racksData.map((r: any) => ({
          id: r.id,
          codeNo: r.codeNo || r.code_no,
          store: r.store_name || 'No Store',
          storeId: r.store_id || r.storeId,
          description: r.description || '',
          status: r.status === 'Active' ? 'Active' : 'Inactive',
          shelfCount: r.shelves_count || 0,
        })));
      }
    } catch (error: any) {
      toast.error(error.error || 'Failed to load racks');
    } finally {
      setLoading(false);
    }
  };

  const loadShelves = async () => {
    try {
      const response = await apiClient.getShelves();
      const shelvesData = response.data || response;
      if (Array.isArray(shelvesData)) {
        setShelves(shelvesData.map((s: any) => ({
          id: s.id,
          shelfNo: s.shelfNo || s.shelf_no,
          rackId: s.rackId || s.rack_id,
          rackCode: s.rack_code || '',
          store: s.store_name || 'No Store',
          description: s.description || '',
          status: s.status === 'Active' ? 'Active' : 'Inactive',
        })));
      }
    } catch (error: any) {
      toast.error(error.error || 'Failed to load shelves');
    }
  };

  const loadStockData = async () => {
    try {
      // Fetch all parts to get part information
      let partsResponse: any = { data: [] };
      try {
        partsResponse = await apiClient.getParts({ limit: 1000 }) as any;
      } catch (error: any) {
        try {
          partsResponse = await apiClient.getParts({ limit: 100 }) as any;
        } catch (retryError: any) {
          partsResponse = { data: [] };
        }
      }
      const partsData = Array.isArray(partsResponse) ? partsResponse : (partsResponse?.data || []);
      const partsMap = new Map<string, { partNo: string; description: string }>();
      partsData.forEach((part: any) => {
        const partId = part.id;
        const partNo = part.master_part_no || part.masterPartNo || part.part_no || part.partNo || '';
        const description = part.description || '';
        if (partId) {
          partsMap.set(partId, { partNo, description });
        }
      });
      
      // Fetch DirectPurchaseOrders with rack/shelf assignments
      // This is the primary source of location assignments
      let dpoResponse: any = { data: [] };
      try {
        // Fetch all DPOs regardless of status to get all items with locations
        dpoResponse = await apiClient.getDirectPurchaseOrders({ limit: 1000 }) as any;
      } catch (error: any) {
        try {
          dpoResponse = await apiClient.getDirectPurchaseOrders({ limit: 100 }) as any;
        } catch (retryError: any) {
          dpoResponse = { data: [] };
        }
      }
      
      // Handle both direct array and paginated response
      let dpoData: any[] = [];
      if (Array.isArray(dpoResponse)) {
        dpoData = dpoResponse;
      } else if (dpoResponse?.data && Array.isArray(dpoResponse.data)) {
        dpoData = dpoResponse.data;
      } else if (dpoResponse && typeof dpoResponse === 'object') {
        // Sometimes the response might be the data directly
        dpoData = Object.values(dpoResponse).find(v => Array.isArray(v)) as any[] || [];
      }
      

      // Calculate stock by rack and shelf from DPO items
      const stockByLocation: Record<string, { 
        itemsCount: number; 
        remainingQuantity: number;
        items: Array<{ partNo: string; description: string; quantity: number }>;
      }> = {};
      const partIdsByLocation: Record<string, Set<string>> = {};
      const partQuantitiesByLocation: Record<string, Record<string, number>> = {};
      const partInfoByLocation: Record<string, Record<string, { partNo: string; description: string }>> = {};
      
      // Process DPO items - this is the source of truth for location assignments
      let totalItemsProcessed = 0;
      let itemsWithLocations = 0;
      
      // Fetch individual DPO details for DPOs that have items but items array is missing
      // The API sometimes returns items_count but not the items array
      const dposWithItems = dpoData.filter(dpo => dpo.items_count > 0);
      const dposNeedingDetails = dposWithItems.filter(dpo => {
        const hasItems = dpo.items && Array.isArray(dpo.items) && dpo.items.length > 0;
        return !hasItems;
      });
      
      
      // Fetch details for DPOs missing items (limit to first 20 to avoid too many requests)
      if (dposNeedingDetails.length > 0) {
        const detailPromises = dposNeedingDetails.slice(0, 20).map(async (dpo) => {
          try {
            const detailResponse = await apiClient.getDirectPurchaseOrder(dpo.id);
            const detailData = detailResponse.data || detailResponse;
            if (detailData && detailData.items && Array.isArray(detailData.items)) {
              dpo.items = detailData.items;
            } else {
            }
          } catch (error: any) {
          }
        });
        
        await Promise.all(detailPromises);
      }
      
      for (const dpo of dpoData) {
        // Check if items exist - handle various response formats
        let itemsArray = dpo.items;
        
        // If items is not an array but items_count > 0, try alternative fields
        if ((!itemsArray || !Array.isArray(itemsArray)) && dpo.items_count > 0) {
          itemsArray = dpo.items_array || dpo.Items || null;
        }
        
        // Skip if no items array or empty
        if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
          if (dpo.items_count > 0) {
          }
          continue;
        }
        
        totalItemsProcessed += itemsArray.length;
        
        for (const item of itemsArray) {
          // Get rack ID from various possible fields (handle all API response formats)
          // Convert to string to ensure consistent matching
          const rackId = item.rack_id || item.rackId || item.rack?.id || null;
          const shelfId = item.shelf_id || item.shelfId || item.shelf?.id || null;
          const partId = item.part_id || item.partId || item.part?.id || null;
          const quantity = item.quantity || 0;
          
          // Get rack and shelf codes for display
          const rackCode = item.rack?.codeNo || item.rack_code || item.rackCode || item.rack_name || null;
          const shelfNo = item.shelf?.shelfNo || item.shelf_no || item.shelfNo || item.shelf_name || null;
          
          // Normalize IDs to strings for consistent matching
          const normalizedRackId = rackId ? String(rackId).trim() : null;
          const normalizedShelfId = shelfId ? String(shelfId).trim() : null;
          const normalizedPartId = partId ? String(partId).trim() : null;
          
          
          // Skip if no location or part assigned
          if ((!normalizedRackId && !normalizedShelfId) || !normalizedPartId || quantity <= 0) {
            continue;
          }
          
          // Item has a location assignment
          itemsWithLocations++;
          
          if (itemsWithLocations <= 5) { // Log first 5 items with locations for debugging
          }
          
          // Get part information from various possible fields
          let partNo = item.part_no || item.partNo || item.part?.partNo || item.part?.part_no || '';
          let description = item.part_description || item.partDescription || item.part?.description || item.description || '';
          
          // Fallback to partsMap
          if (normalizedPartId) {
            const partInfo = partsMap.get(normalizedPartId);
            if (partInfo) {
              partNo = partNo || partInfo.partNo;
              description = description || partInfo.description;
            }
          }

          // Process rack assignment
          if (normalizedRackId) {
            const key = `rack_${normalizedRackId}`;
            if (!stockByLocation[key]) {
              stockByLocation[key] = { itemsCount: 0, remainingQuantity: 0, items: [] };
              partIdsByLocation[key] = new Set();
              partQuantitiesByLocation[key] = {};
              partInfoByLocation[key] = {};
            }
            
            // Track unique parts
            if (!partIdsByLocation[key].has(normalizedPartId)) {
              partIdsByLocation[key].add(normalizedPartId);
              stockByLocation[key].itemsCount++;
              partInfoByLocation[key][normalizedPartId] = { partNo, description };
            }
            
            // Add quantity
            if (!partQuantitiesByLocation[key][normalizedPartId]) {
              partQuantitiesByLocation[key][normalizedPartId] = 0;
            }
            partQuantitiesByLocation[key][normalizedPartId] += quantity;
            stockByLocation[key].remainingQuantity += quantity;
          }

          // Process shelf assignment
          if (normalizedShelfId) {
            const key = `shelf_${normalizedShelfId}`;
            if (!stockByLocation[key]) {
              stockByLocation[key] = { itemsCount: 0, remainingQuantity: 0, items: [] };
              partIdsByLocation[key] = new Set();
              partQuantitiesByLocation[key] = {};
              partInfoByLocation[key] = {};
            }
            
            // Track unique parts
            if (!partIdsByLocation[key].has(normalizedPartId)) {
              partIdsByLocation[key].add(normalizedPartId);
              stockByLocation[key].itemsCount++;
              partInfoByLocation[key][normalizedPartId] = { partNo, description };
            }
            
            // Add quantity
            if (!partQuantitiesByLocation[key][normalizedPartId]) {
              partQuantitiesByLocation[key][normalizedPartId] = 0;
            }
            partQuantitiesByLocation[key][normalizedPartId] += quantity;
            stockByLocation[key].remainingQuantity += quantity;
          }
        }
      }

      // Build items array for each location
      Object.keys(stockByLocation).forEach(key => {
        const items: Array<{ partNo: string; description: string; quantity: number }> = [];
        const partIds = Array.from(partIdsByLocation[key] || []);
        
        partIds.forEach(partId => {
          const quantity = partQuantitiesByLocation[key]?.[partId] || 0;
          const partInfo = partInfoByLocation[key]?.[partId];
          
          if (quantity > 0) {
            items.push({
              partNo: partInfo?.partNo || partId.substring(0, 8) || 'Unknown',
              description: partInfo?.description || '',
              quantity: quantity,
            });
          }
        });
        
        stockByLocation[key].items = items;
      });

      // Ensure stock data is set even if empty, and reload if racks/shelves have changed
      setStockData(stockByLocation);
      
      // Trigger a re-render to ensure items are displayed
      if (racks.length > 0 || shelves.length > 0) {
      }
    } catch (error: any) {
    }
  };

  // Shelf form state
  const [shelfNo, setShelfNo] = useState("");
  const [shelfRackId, setShelfRackId] = useState("");
  const [shelfDescription, setShelfDescription] = useState("");
  const [shelfStatus, setShelfStatus] = useState<"Active" | "Inactive">("Active");

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "rack" | "shelf"; item: Rack | Shelf } | null>(null);

  // Expanded racks state for hierarchical view
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());

  // Toggle rack expansion
  const toggleRackExpansion = (rackId: string) => {
    setExpandedRacks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rackId)) {
        newSet.delete(rackId);
      } else {
        newSet.add(rackId);
      }
      return newSet;
    });
  };

  // Get shelves for a specific rack
  const getShelvesForRack = (rackId: string): Shelf[] => {
    const rackShelves = shelves
      .filter(shelf => shelf.rackId === rackId)
      .map(shelf => {
        const normalizedShelfId = String(shelf.id).trim();
        const stockKey = `shelf_${normalizedShelfId}`;
        const stock = stockData[stockKey] || { itemsCount: 0, remainingQuantity: 0, items: [] };
        return {
          ...shelf,
          itemsCount: stock.itemsCount,
          remainingQuantity: stock.remainingQuantity,
          items: stock.items || [],
        };
      });
    
    // If there's a search term, filter shelves to only show those that match
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return rackShelves.filter(shelf => {
        // Match shelf name
        const matchesShelfName = shelf.shelfNo.toLowerCase().includes(searchLower);
        
        // Match items in shelf
        const matchesShelfItems = shelf.items && shelf.items.some(item => 
          item.partNo.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
        
        return matchesShelfName || matchesShelfItems;
      });
    }
    
    return rackShelves;
  };

  // Organize racks by store for better grouping
  const racksByStore = useMemo(() => {
    const grouped: Record<string, Rack[]> = {};
    racks.forEach(rack => {
      const normalizedRackId = String(rack.id).trim();
      const stockKey = `rack_${normalizedRackId}`;
      const stock = stockData[stockKey] || { itemsCount: 0, remainingQuantity: 0, items: [] };
      const rackWithItems = {
        ...rack,
        itemsCount: stock.itemsCount,
        remainingQuantity: stock.remainingQuantity,
        items: stock.items || [],
      };
      const storeKey = rack.storeId || rack.store || 'Unknown';
      if (!grouped[storeKey]) {
        grouped[storeKey] = [];
      }
      grouped[storeKey].push(rackWithItems);
    });
    return grouped;
  }, [racks, stockData]);

  // Combined list of racks and shelves
  const combinedItems = useMemo(() => {
    const items: Array<{ type: 'rack' | 'shelf'; data: Rack | Shelf }> = [];
    
    racks.forEach(rack => {
      // Normalize ID to string for consistent matching
      const normalizedRackId = String(rack.id).trim();
      const stockKey = `rack_${normalizedRackId}`;
      const stock = stockData[stockKey] || { itemsCount: 0, remainingQuantity: 0, items: [] };
      items.push({
        type: 'rack',
        data: {
          ...rack,
          itemsCount: stock.itemsCount,
          remainingQuantity: stock.remainingQuantity,
          items: stock.items || [],
        }
      });
    });

    shelves.forEach(shelf => {
      // Normalize ID to string for consistent matching
      const normalizedShelfId = String(shelf.id).trim();
      const stockKey = `shelf_${normalizedShelfId}`;
      const stock = stockData[stockKey] || { itemsCount: 0, remainingQuantity: 0, items: [] };
      items.push({
        type: 'shelf',
        data: {
          ...shelf,
          itemsCount: stock.itemsCount,
          remainingQuantity: stock.remainingQuantity,
          items: stock.items || [],
        }
      });
    });

    return items.filter(item => {
      // Filter by store first
      if (selectedStoreFilter !== "all") {
        if (item.type === 'rack') {
          const rack = item.data as Rack;
          const rackStoreId = rack.storeId || stores.find(s => s.name === rack.store)?.id;
          if (rackStoreId !== selectedStoreFilter) {
            return false;
          }
        } else {
          const shelf = item.data as Shelf;
          // For shelves, we need to find the rack's store
          const parentRack = racks.find(r => r.id === shelf.rackId);
          if (parentRack) {
            const shelfStoreId = parentRack.storeId || stores.find(s => s.name === parentRack.store)?.id;
            if (shelfStoreId !== selectedStoreFilter) {
              return false;
            }
          } else {
            // If rack not found, check shelf's store directly
            const shelfStoreId = stores.find(s => s.name === shelf.store)?.id;
            if (shelfStoreId !== selectedStoreFilter) {
              return false;
            }
          }
        }
      }

      // Then filter by search term
      const searchLower = searchTerm.toLowerCase();
      if (item.type === 'rack') {
        const rack = item.data as Rack;
        return rack.codeNo.toLowerCase().includes(searchLower) ||
               rack.store.toLowerCase().includes(searchLower);
      } else {
        const shelf = item.data as Shelf;
        return shelf.shelfNo.toLowerCase().includes(searchLower) ||
               shelf.rackCode.toLowerCase().includes(searchLower) ||
               shelf.store.toLowerCase().includes(searchLower);
      }
    });
  }, [racks, shelves, stockData, searchTerm, selectedStoreFilter, stores]);

  // Reset forms
  const resetRackForm = () => {
    setRackCodeNo("");
    setRackStore("");
    setRackStoreId("");
    setRackDescription("");
    setRackStatus("Active");
    setSelectedRack(null);
  };

  const resetShelfForm = () => {
    setShelfNo("");
    setShelfRackId("");
    setShelfDescription("");
    setShelfStatus("Active");
    setSelectedShelf(null);
  };

  const resetCombinedForm = () => {
    setCombinedStoreId("");
    setCombinedRackName("");
    setCombinedShelfNames([""]);
  };

  // Handlers
  const handleCreateRack = () => {
    resetCombinedForm();
    setCombinedDialogOpen(true);
  };

  const handleAddShelfField = () => {
    setCombinedShelfNames([...combinedShelfNames, ""]);
  };

  const handleRemoveShelfField = (index: number) => {
    if (combinedShelfNames.length > 1) {
      setCombinedShelfNames(combinedShelfNames.filter((_, i) => i !== index));
    }
  };

  const handleUpdateShelfName = (index: number, value: string) => {
    const updated = [...combinedShelfNames];
    updated[index] = value;
    setCombinedShelfNames(updated);
  };

  const handleSaveCombined = async () => {
    if (!combinedRackName.trim()) {
      toast.error("Please enter rack name");
      return;
    }
    if (!combinedStoreId) {
      toast.error("Please select a store");
      return;
    }

    // Filter out empty shelf names
    const validShelfNames = combinedShelfNames.filter(name => name.trim() !== "");

    if (validShelfNames.length === 0) {
      toast.error("Please add at least one shelf name");
      return;
    }

    try {
      // Create the rack first
      const rackResponse = await apiClient.createRack({
        codeNo: combinedRackName.trim(),
        storeId: combinedStoreId,
        status: "Active",
      });

      // Get the created rack ID - check response structure
      let createdRackId = rackResponse?.data?.id || rackResponse?.id;
      
      // If ID not in response, reload racks and find it
      if (!createdRackId) {
        await loadRacks();
        // Small delay to ensure rack is saved
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadRacks();
        // Find the rack we just created by matching code and store
        const selectedStoreName = stores.find(s => s.id === combinedStoreId)?.name;
        const createdRack = racks.find(r => 
          r.codeNo === combinedRackName.trim() && 
          (r.storeId === combinedStoreId || r.store === selectedStoreName)
        );
        if (createdRack) {
          createdRackId = createdRack.id;
        } else {
          // Try one more time with a longer delay
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadRacks();
          const retryRack = racks.find(r => 
            r.codeNo === combinedRackName.trim() && 
            (r.storeId === combinedStoreId || r.store === selectedStoreName)
          );
          if (retryRack) {
            createdRackId = retryRack.id;
          }
        }
      }

      if (!createdRackId) {
        throw new Error("Failed to get created rack ID. Please try again.");
      }

      // Create all shelves for this rack
      const shelfPromises = validShelfNames.map(shelfName =>
        apiClient.createShelf({
          shelfNo: shelfName.trim(),
          rackId: createdRackId,
          status: "Active",
        })
      );

      await Promise.all(shelfPromises);

      // Reload data
      await loadRacks();
      await loadShelves();
      await loadStockData();

      toast.success(`Rack "${combinedRackName.trim()}" with ${validShelfNames.length} ${validShelfNames.length === 1 ? 'shelf' : 'shelves'} created successfully`);
      resetCombinedForm();
      setCombinedDialogOpen(false);
    } catch (error: any) {
      toast.error(error.error || 'Failed to create rack and shelves');
    }
  };

  const handleEditRack = (rack: Rack) => {
    setSelectedRack(rack);
    setRackCodeNo(rack.codeNo);
    if (rack.storeId) {
      setRackStoreId(rack.storeId);
    } else {
      const store = stores.find(s => s.name === rack.store);
      setRackStoreId(store?.id || '');
    }
    setRackStore(rack.store);
    setRackDescription(rack.description);
    setRackStatus(rack.status);
    setFormMode("edit-rack");
  };

  const handleDeleteRack = (rack: Rack) => {
    setItemToDelete({ type: "rack", item: rack });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteRack = async (rack: Rack) => {
    try {
      await apiClient.deleteRack(rack.id);
      await loadRacks();
      await loadShelves();
      await loadStockData();
      toast.success(`Rack "${rack.codeNo}" deleted`);
    } catch (error: any) {
      toast.error(error.error || 'Failed to delete rack');
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleSaveRack = async () => {
    if (!rackCodeNo.trim()) {
      toast.error("Please enter rack code");
      return;
    }
    if (!rackStoreId) {
      toast.error("Please select a store");
      return;
    }

    try {
      if (formMode === "create-rack") {
        await apiClient.createRack({
          codeNo: rackCodeNo.trim(),
          storeId: rackStoreId,
          description: rackDescription.trim() || undefined,
          status: rackStatus,
        });
        await loadRacks();
        await loadStockData();
        toast.success("Rack created successfully");
        resetRackForm();
        setFormMode("list");
        setRackDialogOpen(false);
      } else if (formMode === "edit-rack" && selectedRack) {
        await apiClient.updateRack(selectedRack.id, {
          codeNo: rackCodeNo.trim(),
          description: rackDescription.trim() || undefined,
          status: rackStatus,
        });
        await loadRacks();
        await loadShelves();
        await loadStockData();
        toast.success("Rack updated successfully");
        resetRackForm();
        setFormMode("list");
        setRackDialogOpen(false);
      }
    } catch (error: any) {
      toast.error(error.error || 'Failed to save rack');
    }
  };

  const handleCreateShelf = () => {
    resetShelfForm();
    setFormMode("create-shelf");
    setShelfDialogOpen(true);
  };

  const handleEditShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setShelfNo(shelf.shelfNo);
    setShelfRackId(shelf.rackId);
    setShelfDescription(shelf.description);
    setShelfStatus(shelf.status);
    setFormMode("edit-shelf");
    setShelfDialogOpen(true);
  };

  const handleDeleteShelf = (shelf: Shelf) => {
    setItemToDelete({ type: "shelf", item: shelf });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteShelf = async (shelf: Shelf) => {
    try {
      await apiClient.deleteShelf(shelf.id);
      await loadShelves();
      await loadRacks();
      await loadStockData();
      toast.success(`Shelf "${shelf.shelfNo}" deleted`);
    } catch (error: any) {
      toast.error(error.error || 'Failed to delete shelf');
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "rack") {
      confirmDeleteRack(itemToDelete.item as Rack);
    } else {
      confirmDeleteShelf(itemToDelete.item as Shelf);
    }
  };

  const handleSaveShelf = async () => {
    if (!shelfNo.trim()) {
      toast.error("Please enter shelf number");
      return;
    }
    if (!shelfRackId) {
      toast.error("Please select a rack");
      return;
    }

    const rack = racks.find((r) => r.id === shelfRackId);
    if (!rack) {
      toast.error("Selected rack not found");
      return;
    }

    try {
      if (formMode === "create-shelf") {
        await apiClient.createShelf({
          shelfNo: shelfNo.trim(),
          rackId: shelfRackId,
          description: shelfDescription.trim() || undefined,
          status: shelfStatus,
        });
        await loadShelves();
        await loadRacks();
        await loadStockData();
        toast.success("Shelf created successfully");
        resetShelfForm();
        setFormMode("list");
        setShelfDialogOpen(false);
      } else if (formMode === "edit-shelf" && selectedShelf) {
        await apiClient.updateShelf(selectedShelf.id, {
          shelfNo: shelfNo.trim(),
          description: shelfDescription.trim() || undefined,
          status: shelfStatus,
        });
        await loadShelves();
        await loadRacks();
        await loadStockData();
        toast.success("Shelf updated successfully");
        resetShelfForm();
        setFormMode("list");
        setShelfDialogOpen(false);
      }
    } catch (error: any) {
      toast.error(error.error || 'Failed to save shelf');
    }
  };

  const handleCancel = () => {
    resetRackForm();
    resetShelfForm();
    resetCombinedForm();
    setFormMode("list");
    setRackDialogOpen(false);
    setShelfDialogOpen(false);
    setCombinedDialogOpen(false);
  };

  // Render rack form dialog
  const renderRackDialog = () => (
    <Dialog open={rackDialogOpen} onOpenChange={setRackDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formMode === "create-rack" ? "Create New Rack" : "Edit Rack"}
          </DialogTitle>
          <DialogDescription>
            {formMode === "create-rack" ? "Add a new storage rack" : "Update rack information"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Code No *</Label>
            <Input
              value={rackCodeNo}
              onChange={(e) => setRackCodeNo(e.target.value)}
              placeholder="Enter rack number"
              className="text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Store *</Label>
            <Select 
              value={rackStoreId} 
              onValueChange={(value) => {
                setRackStoreId(value);
                const store = stores.find(s => s.id === value);
                setRackStore(store?.name || '');
              }}
            >
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select Store..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Description</Label>
          <Textarea
            value={rackDescription}
            onChange={(e) => setRackDescription(e.target.value)}
            placeholder="Enter rack description..."
            className="text-sm resize-none"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Status</Label>
          <Select value={rackStatus} onValueChange={(value: "Active" | "Inactive") => setRackStatus(value)}>
            <SelectTrigger className="w-32 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSaveRack} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {formMode === "create-rack" ? "Create" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Render shelf form dialog
  const renderShelfDialog = () => (
    <Dialog open={shelfDialogOpen} onOpenChange={setShelfDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formMode === "create-shelf" ? "Create New Shelf" : "Edit Shelf"}
          </DialogTitle>
          <DialogDescription>
            {formMode === "create-shelf" ? "Add a new shelf to a rack" : "Update shelf information"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Shelf No *</Label>
            <Input
              value={shelfNo}
              onChange={(e) => setShelfNo(e.target.value)}
              placeholder="Enter shelf number"
              className="text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Rack *</Label>
            <Select 
              value={shelfRackId} 
              onValueChange={setShelfRackId}
              disabled={formMode === "edit-shelf"}
            >
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select Rack..." />
              </SelectTrigger>
              <SelectContent>
                {racks.map((rack) => (
                  <SelectItem key={rack.id} value={rack.id}>
                    {rack.codeNo} - {rack.store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formMode === "edit-shelf" && (
              <p className="text-xs text-muted-foreground mt-1">Rack cannot be changed after creation</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Description</Label>
          <Textarea
            value={shelfDescription}
            onChange={(e) => setShelfDescription(e.target.value)}
            placeholder="Enter shelf description..."
            className="text-sm resize-none"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Status</Label>
          <Select value={shelfStatus} onValueChange={(value: "Active" | "Inactive") => setShelfStatus(value)}>
            <SelectTrigger className="w-32 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSaveShelf} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {formMode === "create-shelf" ? "Create" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Render combined rack and shelf creation dialog
  const renderCombinedDialog = () => (
    <Dialog open={combinedDialogOpen} onOpenChange={setCombinedDialogOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Rack with Shelves</DialogTitle>
          <DialogDescription>
            Create a new rack and add shelves to it in one step
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Store Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm">Store *</Label>
            <Select 
              value={combinedStoreId} 
              onValueChange={setCombinedStoreId}
            >
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Select Store..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rack Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">Rack Name *</Label>
            <Input
              value={combinedRackName}
              onChange={(e) => setCombinedRackName(e.target.value)}
              placeholder="Enter rack name"
              className="text-sm h-9"
            />
          </div>

          {/* Shelves Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Shelf Names *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddShelfField}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Shelf
              </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {combinedShelfNames.map((shelfName, index) => (
                <div key={index} className="flex items-center gap-2 w-full">
                  <Input
                    value={shelfName}
                    onChange={(e) => handleUpdateShelfName(index, e.target.value)}
                    placeholder={`Enter shelf name ${index + 1}`}
                    className="text-sm h-9 flex-1 min-w-0"
                  />
                  {combinedShelfNames.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShelfField(index)}
                      className="h-9 w-9 p-0 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {combinedShelfNames.length === 1 && (
                    <div className="w-9 h-9 flex-shrink-0" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Add one or more shelves to this rack
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            resetCombinedForm();
            setCombinedDialogOpen(false);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveCombined} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Rack & Shelves"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Render list view with hierarchical layout
  const renderListView = () => {
    // Get filtered racks based on store filter and search
    const filteredRacks = racks
      .map(rack => {
        const normalizedRackId = String(rack.id).trim();
        const stockKey = `rack_${normalizedRackId}`;
        const stock = stockData[stockKey] || { itemsCount: 0, remainingQuantity: 0, items: [] };
        return {
          ...rack,
          itemsCount: stock.itemsCount,
          remainingQuantity: stock.remainingQuantity,
          items: stock.items || [],
        };
      })
      .filter(rack => {
        // Filter by store
        if (selectedStoreFilter !== "all") {
          const rackStoreId = rack.storeId || stores.find(s => s.name === rack.store)?.id;
          if (rackStoreId !== selectedStoreFilter) {
            return false;
          }
        }
        
        // If no search term, include all racks (after store filter)
        if (!searchTerm.trim()) {
          return true;
        }
        
        // Filter by search - check rack name, store, and items
        const searchLower = searchTerm.toLowerCase();
        
        // Check rack code/name and store
        const matchesRackName = rack.codeNo.toLowerCase().includes(searchLower) ||
                                rack.store.toLowerCase().includes(searchLower);
        
        // Check items in rack
        const matchesRackItems = rack.items && rack.items.some(item => 
          item.partNo.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
        
        // Check shelves and their items
        const rackShelves = shelves.filter(s => {
          const normalizedRackId = String(rack.id).trim();
          const normalizedShelfRackId = String(s.rackId).trim();
          return normalizedRackId === normalizedShelfRackId;
        });
        
        const matchesShelfNames = rackShelves.some(shelf => 
          shelf.shelfNo.toLowerCase().includes(searchLower)
        );
        
        const matchesShelfItems = rackShelves.some(shelf => {
          const normalizedShelfId = String(shelf.id).trim();
          const stockKey = `shelf_${normalizedShelfId}`;
          const shelfStock = stockData[stockKey] || { items: [] };
          return shelfStock.items && shelfStock.items.some((item: { partNo: string; description: string; quantity: number }) => 
            item.partNo.toLowerCase().includes(searchLower) ||
            (item.description && item.description.toLowerCase().includes(searchLower))
          );
        });
        
        return matchesRackName || matchesRackItems || matchesShelfNames || matchesShelfItems;
      });

    return (
    <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Racks & Shelves Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Organize and track inventory locations across all stores
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleCreateRack} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Create Rack with Shelves
            </Button>
            <Button 
              onClick={async () => {
                await loadStockData();
                toast.success("Stock data refreshed");
              }} 
              variant="outline" 
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Locations
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-sm mb-2 block">Filter by Store</Label>
                <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[250px]">
                <Label className="text-sm mb-2 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by rack name, shelf name, or item/part number"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
                  {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Loading racks and shelves...</p>
                        </div>
            </CardContent>
          </Card>
        ) : filteredRacks.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No racks found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || selectedStoreFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Get started by creating your first rack"}
                </p>
                {!searchTerm && selectedStoreFilter === "all" && (
                  <Button onClick={handleCreateRack} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Rack
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Hierarchical Rack View */
          <div className="space-y-4">
            {filteredRacks.map((rack) => {
              const rackShelves = getShelvesForRack(rack.id);
              const isExpanded = expandedRacks.has(rack.id);
              const totalItemsOnRack = rack.itemsCount || 0;
              const totalQuantityOnRack = rack.remainingQuantity || 0;

                        return (
                <Card key={rack.id} className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
                  {/* Rack Header */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 border-b">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleRackExpansion(rack.id)}>
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-4 flex-1 cursor-pointer group">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              )}
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Archive className="w-6 h-6 text-primary" />
                                  </div>
                              </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold">{rack.codeNo}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {rack.store}
                                </Badge>
                                <Badge
                                  variant={rack.status === "Active" ? "default" : "secondary"}
                                  className={rack.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                                >
                                  {rack.status}
                                </Badge>
                                    </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Layers className="w-4 h-4" />
                                  {rackShelves.length} {rackShelves.length === 1 ? 'Shelf' : 'Shelves'}
                                </span>
                                {totalItemsOnRack > 0 && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <Package className="w-4 h-4" />
                                      {totalItemsOnRack} {totalItemsOnRack === 1 ? 'Item' : 'Items'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      Qty: {totalQuantityOnRack}
                                    </span>
                                  </>
                                )}
                                  </div>
                              {rack.description && (
                                <p className="text-xs text-muted-foreground mt-1">{rack.description}</p>
                                )}
                              </div>
                              </div>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRack(rack);
                            }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRack(rack);
                            }}
                            className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                                    </div>

                      {/* Rack Items (if any) */}
                      {rack.items && rack.items.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-2">ITEMS ON THIS RACK:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {rack.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{item.partNo}</p>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                  )}
                                  </div>
                                <Badge variant="outline" className="ml-2 flex-shrink-0">Qty: {item.quantity}</Badge>
                              </div>
                            ))}
                                    </div>
                                  </div>
                                )}

                      {/* Shelves List */}
                      <CollapsibleContent>
                        <div className="pt-4 space-y-3">
                          {rackShelves.length === 0 ? (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                              No shelves in this rack. <Button variant="link" className="p-0 h-auto" onClick={handleCreateShelf}>Add one</Button>
                              </div>
                          ) : (
                            rackShelves.map((shelf) => (
                              <Card key={shelf.id} className="border-l-4 border-l-primary/30 bg-muted/30">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 flex-1">
                                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Layers className="w-5 h-5 text-primary" />
                              </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                          <h4 className="font-semibold">Shelf {shelf.shelfNo}</h4>
                              <Badge
                                variant={shelf.status === "Active" ? "default" : "secondary"}
                                className={shelf.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600 text-xs" : "text-xs"}
                              >
                                {shelf.status}
                              </Badge>
                                          {shelf.itemsCount > 0 && (
                                            <>
                                              <Badge variant="outline" className="text-xs">
                                                <Package className="w-3 h-3 mr-1" />
                                                {shelf.itemsCount} {shelf.itemsCount === 1 ? 'Item' : 'Items'}
                                              </Badge>
                                              <Badge variant="outline" className="text-xs">
                                                Qty: {shelf.remainingQuantity}
                                              </Badge>
                                            </>
                                          )}
                                        </div>
                                        {shelf.description && (
                                          <p className="text-xs text-muted-foreground mb-2">{shelf.description}</p>
                                        )}
                                        {/* Shelf Items */}
                                        {shelf.items && shelf.items.length > 0 ? (
                                          <div className="mt-3 space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">ITEMS ON THIS SHELF:</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {shelf.items.map((item, idx) => (
                                                <div key={idx} className="p-2 bg-background rounded border text-sm">
                                                  <p className="font-medium truncate">{item.partNo}</p>
                                                  {item.description && (
                                                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground mt-2">No items assigned to this shelf</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEditShelf(shelf)} 
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteShelf(shelf)}
                                        className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
            </div>
          </CardContent>
        </Card>
                            ))
                          )}
      </div>
                      </CollapsibleContent>
                    </Collapsible>
    </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderListView()}

      {/* Combined Rack & Shelf Creation Dialog */}
      {renderCombinedDialog()}

      {/* Rack Dialog (for editing only) */}
      {(formMode === "edit-rack") && renderRackDialog()}

      {/* Shelf Dialog (for editing only) */}
      {(formMode === "edit-shelf") && renderShelfDialog()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "rack" ? (
                <>
                  Are you sure you want to delete rack "{(itemToDelete.item as Rack).codeNo}"?
                  This will also delete all shelves associated with this rack.
                </>
              ) : (
                <>
                  Are you sure you want to delete shelf "{(itemToDelete?.item as Shelf)?.shelfNo}"?
                </>
              )}
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
