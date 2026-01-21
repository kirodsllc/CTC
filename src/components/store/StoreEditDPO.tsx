import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DirectPurchaseOrderItem {
  id: string;
  partId: string;
  partNo: string;
  description: string;
  brand: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  amount: number;
  rackId?: string;
  shelfId?: string;
}

interface DirectPurchaseOrder {
  id: string;
  dpo_no: string;
  date: string;
  store_id: string;
  store_name: string;
  supplier_id?: string;
  account?: string;
  description?: string;
  status: string;
  items?: DirectPurchaseOrderItem[];
}

interface StoreEditDPOProps {
  order: DirectPurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface LocationAssignment {
  id: string;
  quantity: string;
  rackId: string;
  shelfId: string;
}

interface OrderItemForm {
  id: string;
  partId: string;
  partNo: string;
  brand: string;
  totalQuantity: string;
  purchasePrice: string;
  salePrice: string;
  locations: LocationAssignment[];
}

interface Rack {
  id: string;
  codeNo: string;
  storeId: string;
  shelves: Shelf[];
}

interface Shelf {
  id: string;
  shelfNo: string;
  rackId: string;
}

export const StoreEditDPO = ({ order, open, onOpenChange, onSuccess }: StoreEditDPOProps) => {
  const [loading, setLoading] = useState(false);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formStore, setFormStore] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState<OrderItemForm[]>([]);
  
  // Dropdown data
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);

  useEffect(() => {
    if (open && order) {
      loadOrderData();
    }
    
    if (open) {
      fetchDropdownData();
    }
  }, [open, order]);

  useEffect(() => {
    // Load racks when store is set (either from order or user selection)
    if (open && formStore) {
      fetchRacks();
    } else if (open && !formStore) {
      // If no store selected yet, still try to load all racks as fallback
      fetchRacks();
    }
  }, [open, formStore]);

  const loadOrderData = async () => {
    if (!order) return;

    try {
      // Fetch full order details
      const response = await apiClient.getDirectPurchaseOrder(order.id);
      const orderData: any = response.data || response;
      
      if (orderData) {
        // Load order data
        const storeId = orderData.store_id || order.store_id || "";
        setFormDate(new Date(orderData.date || order.date));
        setFormStore(storeId);
        setFormDescription(orderData.description || order.description || "");
        
        // Load items with location assignments
        if (orderData.items && orderData.items.length > 0) {
          // Group items by partId to combine quantities
          const itemsMap = new Map<string, OrderItemForm>();
          
          orderData.items.forEach((item: any, idx: number) => {
            const partId = item.part_id || item.partId || "";
            if (!partId) return;
            
            if (!itemsMap.has(partId)) {
              itemsMap.set(partId, {
                id: String(idx + 1),
                partId: partId,
                partNo: item.part_no || item.partNo || "",
                brand: item.brand || item.brand_name || "N/A",
                totalQuantity: String(item.quantity || ""),
                purchasePrice: String(item.purchase_price || item.purchasePrice || ""),
                salePrice: String(item.sale_price || item.salePrice || 0),
                locations: [],
              });
            }
            
            // Add location assignment
            const existingItem = itemsMap.get(partId)!;
            existingItem.locations.push({
              id: `${partId}_${existingItem.locations.length + 1}`,
              quantity: String(item.quantity || ""),
              rackId: (item.rack_id || item.rackId || "").toString(),
              shelfId: (item.shelf_id || item.shelfId || "").toString(),
            });
          });
          
          setFormItems(Array.from(itemsMap.values()));
        } else if (order.items && order.items.length > 0) {
          // Group items by partId
          const itemsMap = new Map<string, OrderItemForm>();
          
          order.items.forEach((item, idx) => {
            if (!item.partId) return;
            
            if (!itemsMap.has(item.partId)) {
              itemsMap.set(item.partId, {
                id: String(idx + 1),
                partId: item.partId,
                partNo: item.partNo || "",
                brand: item.brand || "N/A",
                totalQuantity: String(item.quantity),
                purchasePrice: String(item.purchasePrice),
                salePrice: String(item.salePrice || 0),
                locations: [],
              });
            }
            
            const existingItem = itemsMap.get(item.partId)!;
            existingItem.locations.push({
              id: `${item.partId}_${existingItem.locations.length + 1}`,
              quantity: String(item.quantity),
              rackId: (item.rackId || "").toString(),
              shelfId: (item.shelfId || "").toString(),
            });
          });
          
          setFormItems(Array.from(itemsMap.values()));
        } else {
          setFormItems([{ 
            id: "1", 
            partId: "", 
            partNo: "", 
            brand: "", 
            totalQuantity: "", 
            purchasePrice: "", 
            salePrice: "", 
            locations: [{ id: "1", quantity: "", rackId: "", shelfId: "" }]
          }]);
        }
        
        // Load racks immediately with the store ID from order
        await fetchRacks(storeId);
      }
    } catch (error: any) {
      console.error("Error loading order data:", error);
      toast.error("Failed to load order details");
    }
  };

  const fetchDropdownData = async () => {
    try {
      // Fetch stores
      const storesResponse = await apiClient.getStores("active");
      const storesData = storesResponse.data || storesResponse;
      if (Array.isArray(storesData)) {
        setStores(storesData.map((s: any) => ({ id: s.id, name: s.name })));
      }
    } catch (error: any) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const fetchRacks = async (storeId?: string) => {
    try {
      const effectiveStoreId = (storeId || formStore) && (storeId || formStore) !== "all" ? (storeId || formStore) : undefined;
      const response = await apiClient.getRacks(effectiveStoreId);
      const racksData = response.data || response;

      // Fallback: if a specific store filter returns no racks, load all racks
      let resolvedRacksData: any = racksData;
      if (effectiveStoreId && Array.isArray(racksData) && racksData.length === 0) {
        const fallbackResponse = await apiClient.getRacks(undefined);
        resolvedRacksData = fallbackResponse.data || fallbackResponse;
      }

      if (Array.isArray(resolvedRacksData)) {
        setRacks(
          resolvedRacksData.map((r: any) => ({
            id: r.id,
            codeNo: r.codeNo || r.code_no,
            storeId: r.storeId || r.store_id,
            shelves: (r.shelves || []).map((s: any) => ({
              id: s.id,
              shelfNo: s.shelfNo || s.shelf_no,
              rackId: s.rackId || s.rack_id,
            })),
          }))
        );
      }
    } catch (error: any) {
      console.error("Error fetching racks:", error);
    }
  };

  const getShelvesForRack = (rackId: string): Shelf[] => {
    const rack = racks.find((r) => r.id === rackId);
    return rack?.shelves || [];
  };

  const handleRemoveItem = (itemId: string) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((item) => item.id !== itemId));
    }
  };

  const handleItemChange = (itemId: string, field: keyof OrderItemForm, value: string) => {
    setFormItems(formItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleAddLocation = (itemId: string) => {
    setFormItems(formItems.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          locations: [
            ...item.locations,
            { id: `${itemId}_${item.locations.length + 1}`, quantity: "", rackId: "", shelfId: "" }
          ]
        };
      }
      return item;
    }));
  };

  const handleRemoveLocation = (itemId: string, locationId: string) => {
    setFormItems(formItems.map((item) => {
      if (item.id === itemId) {
        const newLocations = item.locations.filter(loc => loc.id !== locationId);
        // Ensure at least one location
        if (newLocations.length === 0) {
          return {
            ...item,
            locations: [{ id: `${itemId}_1`, quantity: "", rackId: "", shelfId: "" }]
          };
        }
        return { ...item, locations: newLocations };
      }
      return item;
    }));
  };

  const handleLocationChange = (itemId: string, locationId: string, field: keyof LocationAssignment, value: string) => {
    setFormItems(formItems.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          locations: item.locations.map((loc) => {
            if (loc.id === locationId) {
              const updated = { ...loc, [field]: value };
              // Reset shelf when rack changes
              if (field === "rackId") {
                updated.shelfId = "";
              }
              return updated;
            }
            return loc;
          })
        };
      }
      return item;
    }));
  };

  const calculateRemainingQuantity = (item: OrderItemForm): number => {
    const total = Number(item.totalQuantity) || 0;
    const assigned = item.locations.reduce((sum, loc) => sum + (Number(loc.quantity) || 0), 0);
    return total - assigned;
  };

  const handleSubmit = async () => {
    if (!order) return;

    // Validation
    if (!formStore) {
      toast.error("Please select a store");
      return;
    }

    // Validate items
    for (const item of formItems) {
      if (!item.partId || !item.totalQuantity) {
        toast.error("Please fill in all item fields");
        return;
      }
      
      const total = Number(item.totalQuantity) || 0;
      const assigned = item.locations.reduce((sum, loc) => sum + (Number(loc.quantity) || 0), 0);
      
      if (assigned > total) {
        toast.error(`Assigned quantity (${assigned}) exceeds total quantity (${total}) for item ${item.partNo}`);
        return;
      }
      
      for (const loc of item.locations) {
        if (loc.quantity && (!loc.rackId || !loc.shelfId)) {
          toast.error("Please select both rack and shelf for all location assignments");
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Prepare items for API - create one item per location assignment
      const itemsForUpdate: any[] = [];
      
      formItems.forEach(item => {
        if (!item.partId || !item.totalQuantity) return;
        
        const purchasePrice = Number(item.purchasePrice) || 0;
        const quantity = Number(item.totalQuantity) || 0;
        const amount = purchasePrice * quantity;
        
        // If no locations assigned, create one item with total quantity
        if (item.locations.length === 0 || item.locations.every(loc => !loc.quantity)) {
          itemsForUpdate.push({
            part_id: item.partId,
            quantity: quantity,
            purchase_price: purchasePrice,
            sale_price: Number(item.salePrice) || 0,
            amount: amount,
            rack_id: null,
            shelf_id: null,
          });
        } else {
          // Create one item per location assignment
          item.locations.forEach(loc => {
            if (loc.quantity && loc.rackId && loc.shelfId) {
              const locQuantity = Number(loc.quantity) || 0;
              const locAmount = purchasePrice * locQuantity;
              itemsForUpdate.push({
                part_id: item.partId,
                quantity: locQuantity,
                purchase_price: purchasePrice,
                sale_price: Number(item.salePrice) || 0,
                amount: locAmount,
                rack_id: loc.rackId || null,
                shelf_id: loc.shelfId || null,
              });
            }
          });
          
          // Add remaining unassigned quantity if any
          const remaining = calculateRemainingQuantity(item);
          if (remaining > 0) {
            const remainingAmount = purchasePrice * remaining;
            itemsForUpdate.push({
              part_id: item.partId,
              quantity: remaining,
              purchase_price: purchasePrice,
              sale_price: Number(item.salePrice) || 0,
              amount: remainingAmount,
              rack_id: null,
              shelf_id: null,
            });
          }
        }
      });

      // Update DPO
      await apiClient.updateDirectPurchaseOrder(order.id, {
        date: formDate.toISOString(),
        store_id: formStore,
        description: formDescription || undefined,
        items: itemsForUpdate,
      });

      toast.success("Direct Purchase Order updated successfully");
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error updating DPO:", error);
      toast.error(error.error || "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Direct Purchase Order - {order.dpo_no}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formDate && "text-muted-foreground"
                      )}
                    >
                      {formDate ? format(formDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formDate}
                      onSelect={(date) => date && setFormDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Store *</Label>
                <Select value={formStore || undefined} onValueChange={setFormStore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id || "unknown"}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
              </div>
              <div className="space-y-4">
                {formItems.map((item) => {
                  const partDisplay = item.partNo && item.brand 
                    ? `${item.partNo} - ${item.brand}` 
                    : item.partNo || item.brand || "N/A";
                  const remaining = calculateRemainingQuantity(item);
                  
                  return (
                    <div key={item.id} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{partDisplay}</div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Total Quantity</Label>
                              <Input
                                type="number"
                                value={item.totalQuantity}
                                onChange={(e) => handleItemChange(item.id, "totalQuantity", e.target.value)}
                                placeholder="Total Qty"
                                min="1"
                                className="w-32"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Remaining</Label>
                              <div className={`text-sm font-medium ${remaining > 0 ? "text-warning" : remaining < 0 ? "text-destructive" : "text-success"}`}>
                                {remaining}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={formItems.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Location Assignments</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddLocation(item.id)}
                            className="text-xs h-7"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Location
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Quantity</TableHead>
                                <TableHead className="w-[150px]">Rack</TableHead>
                                <TableHead className="w-[150px]">Shelf</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.locations.map((location) => {
                                const shelves = location.rackId ? getShelvesForRack(location.rackId) : [];
                                return (
                                  <TableRow key={location.id}>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={location.quantity}
                                        onChange={(e) => handleLocationChange(item.id, location.id, "quantity", e.target.value)}
                                        placeholder="Qty"
                                        min="1"
                                        className="w-20"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={location.rackId || ""}
                                        onValueChange={(value) => handleLocationChange(item.id, location.id, "rackId", value)}
                                      >
                                        <SelectTrigger className="w-[140px]">
                                          <SelectValue placeholder="Select Rack" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {racks.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No racks available</div>
                                          ) : (
                                            racks.map((rack) => (
                                              <SelectItem key={rack.id} value={rack.id}>
                                                {rack.codeNo}
                                              </SelectItem>
                                            ))
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={location.shelfId || ""}
                                        onValueChange={(value) => handleLocationChange(item.id, location.id, "shelfId", value)}
                                        disabled={!location.rackId}
                                      >
                                        <SelectTrigger className="w-[140px]">
                                          <SelectValue placeholder={location.rackId ? "Select Shelf" : "Select Rack first"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {shelves.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                              {location.rackId ? "No shelves available" : "Select rack first"}
                                            </div>
                                          ) : (
                                            shelves.map((shelf) => (
                                              <SelectItem key={shelf.id} value={shelf.id}>
                                                {shelf.shelfNo}
                                              </SelectItem>
                                            ))
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveLocation(item.id, location.id)}
                                        disabled={item.locations.length === 1}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

