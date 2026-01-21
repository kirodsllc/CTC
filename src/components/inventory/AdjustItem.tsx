import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButtonTooltip } from "@/components/ui/action-button-tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface AdjustmentItem {
  id: string;
  itemId: string;
  itemName: string;
  qtyInStock: number;
  quantity: number;
  lastPurchaseRate: number;
  rate: number;
  total: number;
}

interface AdjustmentRecord {
  id: string;
  date: string;
  subject: string;
  store: string;
  store_id?: string;
  addInventory: boolean;
  items: AdjustmentItem[];
  notes: string;
  totalAmount: number;
}

export const AdjustItem = () => {
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [selectedRecord, setSelectedRecord] = useState<AdjustmentRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [recordToView, setRecordToView] = useState<AdjustmentRecord | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Form state
  const [addInventory, setAddInventory] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [store, setStore] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([
    { id: "1", itemId: "", itemName: "", qtyInStock: 0, quantity: 0, lastPurchaseRate: 0, rate: 0, total: 0 }
  ]);

  // API data
  const [records, setRecords] = useState<AdjustmentRecord[]>([]);
  const [stores, setStores] = useState<{ value: string; label: string }[]>([]);
  const [parts, setParts] = useState<{ id: string; partNo: string; description: string; qtyInStock: number; lastPurchaseRate: number }[]>([]);
  const [stockBalances, setStockBalances] = useState<Record<string, { qty: number; rate: number }>>({});

  // Fetch adjustments
  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const response: any = await apiClient.getAdjustments({
        page: currentPage,
        limit: itemsPerPage,
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }

      const data = response.data || [];
      const pagination = response.pagination || { total: 0 };

      setRecords(data.map((a: any) => ({
        id: a.id,
        date: new Date(a.date).toLocaleDateString('en-GB'),
        subject: a.subject || '',
        store: a.store_name || 'N/A',
        store_id: a.store_id,
        addInventory: a.add_inventory,
        items: [],
        notes: a.notes || '',
        totalAmount: a.total_amount || 0,
      })));
      setTotalRecords(pagination.total || 0);
    } catch (error: any) {
      toast.error(`Error fetching adjustments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stores
  const fetchStores = async () => {
    try {
      const response: any = await apiClient.getStores();
      if (response.error) {
        console.error('Error fetching stores:', response.error);
        toast.error(`Error fetching stores: ${response.error}`);
        return;
      }
      // Handle both response formats: { data: [...] } or direct array
      const storesData = response.data || response;
      if (Array.isArray(storesData) && storesData.length > 0) {
        setStores(storesData.map((s: any) => ({
          value: s.id,
          label: s.name || `${s.code || ''} - ${s.name || ''}`.trim() || 'Unnamed Store'
        })));
      } else {
        console.warn('No stores found or invalid response format:', storesData);
        setStores([]);
      }
    } catch (error: any) {
      console.error('Error fetching stores:', error);
      toast.error(`Error fetching stores: ${error.message || error}`);
    }
  };

  // Fetch parts and stock balances
  const fetchParts = async () => {
    try {
      const [partsResponse, balancesResponse]: any[] = await Promise.all([
        apiClient.getParts({ page: 1, limit: 1000 }),
        apiClient.getStockBalances({ store_id: store || undefined }),
      ]);

      if (partsResponse.error) {
        console.error('Error fetching parts:', partsResponse.error);
        toast.error(`Error fetching parts: ${partsResponse.error}`);
        return;
      }

      if (balancesResponse.error) {
        console.error('Error fetching balances:', balancesResponse.error);
        // Don't show error for balances, just continue without them
      }

      // Handle both response formats: { data: [...] } or direct array
      const partsData = partsResponse.data || partsResponse;
      const balancesData = balancesResponse.data || balancesResponse || [];

      if (!Array.isArray(partsData)) {
        console.error('Invalid parts response format:', partsData);
        return;
      }

      // Create balance map
      const balanceMap: Record<string, { qty: number; rate: number }> = {};
      if (Array.isArray(balancesData)) {
        balancesData.forEach((b: any) => {
          balanceMap[b.part_id || b.partId] = {
            qty: b.quantity || b.qty || 0,
            rate: b.avg_cost || b.avgCost || b.rate || 0
          };
        });
      }

      setStockBalances(balanceMap);
      setParts(partsData.map((p: any) => {
        // Remove grade information from description (e.g., "(Grade: O)", "(Grade: B)")
        const cleanDescription = (p.description || '').replace(/\(Grade:\s*[^)]+\)/gi, '').trim();

        // NOTE: Database fields are swapped!
        // - p.master_part_no actually contains the PART NUMBER (e.g., "abc123", "123456")
        // - p.part_no actually contains the MASTER PART NUMBER (e.g., "XK13-2007-00153")
        // So we use master_part_no to get the actual part number

        return {
          id: p.id,
          // Use master_part_no because it actually contains the part number (database field is mislabeled)
          partNo: p.master_part_no || p.masterPartNo || '',
          description: cleanDescription || p.master_part_no || p.masterPartNo || '',
          qtyInStock: balanceMap[p.id]?.qty || 0,
          // Use cost price from Part Entry (parts table), NOT from stock balances
          lastPurchaseRate: p.cost || 0,
        };
      }));
    } catch (error: any) {
      console.error('Error fetching parts:', error);
      toast.error(`Error fetching parts: ${error.message || error}`);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (view === "create" || view === "edit") {
      fetchParts();
    }
  }, [view, store]);

  // Pagination logic
  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Total amount calculation
  const totalAmount = useMemo(() => {
    return adjustmentItems.reduce((sum, item) => sum + item.total, 0);
  }, [adjustmentItems]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(records.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleAddItem = () => {
    const newItem: AdjustmentItem = {
      id: Date.now().toString(),
      itemId: "",
      itemName: "",
      qtyInStock: 0,
      quantity: 0,
      lastPurchaseRate: 0,
      rate: 0,
      total: 0
    };
    setAdjustmentItems([...adjustmentItems, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (adjustmentItems.length > 1) {
      setAdjustmentItems(adjustmentItems.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof AdjustmentItem, value: string | number) => {
    setAdjustmentItems(adjustmentItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };

        // Auto-calculate total
        if (field === "quantity" || field === "rate") {
          updated.total = updated.quantity * updated.rate;
        }

        // When item is selected, populate fields
        if (field === "itemId") {
          const selectedPart = parts.find(p => p.id === value);
          if (selectedPart) {
            updated.itemName = selectedPart.description;
            updated.qtyInStock = selectedPart.qtyInStock;
            updated.lastPurchaseRate = selectedPart.lastPurchaseRate;
            updated.rate = selectedPart.lastPurchaseRate;
            updated.total = updated.quantity * updated.rate;
          }
        }

        return updated;
      }
      return item;
    }));
  };

  const handleReset = () => {
    setAddInventory(true);
    setDate(new Date().toISOString().split("T")[0]);
    setSubject("");
    setStore("");
    setCategory("");
    setSubCategory("");
    setNotes("");
    setAdjustmentItems([
      { id: "1", itemId: "", itemName: "", qtyInStock: 0, quantity: 0, lastPurchaseRate: 0, rate: 0, total: 0 }
    ]);
  };

  const handleSave = async () => {
    if (!store) {
      toast.error("Please select a store");
      return;
    }

    const validItems = adjustmentItems.filter(item => item.itemId && item.quantity > 0 && item.rate > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one item with quantity and rate");
      return;
    }

    try {
      setLoading(true);
      const adjustmentData = {
        date: date,
        subject: subject || undefined,
        store_id: store,
        add_inventory: addInventory,
        notes: notes || undefined,
        items: validItems.map(item => ({
          part_id: item.itemId,
          quantity: item.quantity,
          cost: item.rate,
        })),
      };

      let response: any;
      if (view === "edit" && selectedRecord) {
        response = await apiClient.updateAdjustment(selectedRecord.id, adjustmentData);
      } else {
        response = await apiClient.createAdjustment(adjustmentData);
      }

      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success(view === "edit" ? "Adjustment updated successfully" : "Adjustment created successfully");
      handleReset();
      setView("list");
      fetchAdjustments();
    } catch (error: any) {
      toast.error(`Error saving adjustment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (record: AdjustmentRecord) => {
    try {
      setLoading(true);
      const response: any = await apiClient.getAdjustment(record.id);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      const adjustment = response;
      const viewRecord: AdjustmentRecord = {
        id: adjustment.id,
        date: new Date(adjustment.date).toLocaleDateString('en-GB'),
        subject: adjustment.subject || '',
        store: adjustment.store_name || 'N/A',
        store_id: adjustment.store_id,
        addInventory: adjustment.add_inventory,
        items: (adjustment.items || []).map((item: any) => ({
          id: item.id,
          itemId: item.part_id,
          itemName: item.part_description || item.part_no,
          qtyInStock: 0,
          quantity: item.quantity,
          lastPurchaseRate: item.cost || 0,
          rate: item.cost || 0,
          total: item.quantity * (item.cost || 0),
        })),
        notes: adjustment.notes || '',
        totalAmount: adjustment.total_amount || 0,
      };

      setRecordToView(viewRecord);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error(`Error fetching adjustment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (record: AdjustmentRecord) => {
    try {
      setLoading(true);
      const response: any = await apiClient.getAdjustment(record.id);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      const adjustment = response;
      setSelectedRecord(record);
      setAddInventory(adjustment.add_inventory);
      setDate(new Date(adjustment.date).toISOString().split("T")[0]);
      setSubject(adjustment.subject || "");
      setStore(adjustment.store_id || "");
      setNotes(adjustment.notes || "");

      const items = (adjustment.items || []).map((item: any, index: number) => ({
        id: (index + 1).toString(),
        itemId: item.part_id,
        itemName: item.part_description || item.part_no,
        qtyInStock: 0,
        quantity: item.quantity,
        lastPurchaseRate: item.cost || 0,
        rate: item.cost || 0,
        total: item.quantity * (item.cost || 0),
      }));

      setAdjustmentItems(items.length > 0 ? items : [
        { id: "1", itemId: "", itemName: "", qtyInStock: 0, quantity: 0, lastPurchaseRate: 0, rate: 0, total: 0 }
      ]);
      setView("edit");
    } catch (error: any) {
      toast.error(`Error fetching adjustment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      setLoading(true);
      const response: any = await apiClient.deleteAdjustment(recordToDelete);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success("Adjustment deleted successfully");
      setRecordToDelete(null);
      fetchAdjustments();
    } catch (error: any) {
      toast.error(`Error deleting adjustment: ${error.message}`);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleCancel = () => {
    handleReset();
    setSelectedRecord(null);
    setView("list");
  };

  // List View
  if (view === "list") {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-8 bg-primary rounded-full" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Adjust Inventory</h2>
              <p className="text-xs text-muted-foreground">Manage inventory adjustments and stock corrections</p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView("create")}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Adjust
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === records.length && records.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold">ID</TableHead>
                  <TableHead className="text-xs font-semibold">TOTAL</TableHead>
                  <TableHead className="text-xs font-semibold">DATE</TableHead>
                  <TableHead className="text-xs font-semibold text-center">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                      No adjustments found
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/20">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(record.id)}
                          onCheckedChange={(checked) => handleSelectOne(record.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-medium">{record.id.substring(0, 8)}</TableCell>
                      <TableCell className="text-xs">{record.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{record.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <ActionButtonTooltip label="View" variant="view">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(record)}
                              className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Button>
                          </ActionButtonTooltip>
                          <ActionButtonTooltip label="Edit" variant="edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(record)}
                              className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </ActionButtonTooltip>
                          <ActionButtonTooltip label="Delete" variant="delete">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(record.id)}
                              className="text-destructive hover:text-destructive/80 flex items-center gap-1 text-xs font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </Button>
                          </ActionButtonTooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalRecords)} of {totalRecords} Records
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  className="w-10 h-7 text-xs text-center"
                  min={1}
                  max={totalPages}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Last
              </Button>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-14 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10" className="text-xs">10</SelectItem>
                  <SelectItem value="25" className="text-xs">25</SelectItem>
                  <SelectItem value="50" className="text-xs">50</SelectItem>
                  <SelectItem value="100" className="text-xs">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                  <Eye className="w-3 h-3 text-primary-foreground" />
                </div>
                View Adjustment Details
              </DialogTitle>
            </DialogHeader>
            {recordToView && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">ID</Label>
                    <p className="text-xs font-medium">{recordToView.id.substring(0, 8)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Date</Label>
                    <p className="text-xs font-medium">{recordToView.date}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Store</Label>
                    <p className="text-xs font-medium">{recordToView.store}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Total Amount</Label>
                    <p className="text-xs font-medium text-primary">{recordToView.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Add Inventory</Label>
                  <p className="text-xs font-medium">{recordToView.addInventory ? "Yes" : "No"}</p>
                </div>
                {recordToView.subject && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Subject</Label>
                    <p className="text-xs font-medium">{recordToView.subject}</p>
                  </div>
                )}
                {recordToView.notes && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <p className="text-xs font-medium">{recordToView.notes}</p>
                  </div>
                )}
                {recordToView.items.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs mb-2 block">Items</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs">Quantity</TableHead>
                            <TableHead className="text-xs">Rate</TableHead>
                            <TableHead className="text-xs">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recordToView.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-xs">{item.itemName}</TableCell>
                              <TableCell className="text-xs">{item.quantity}</TableCell>
                              <TableCell className="text-xs">{item.rate.toFixed(2)}</TableCell>
                              <TableCell className="text-xs">{item.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this adjustment? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
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
  }

  // Create/Edit Form
  return (
    <div className="space-y-3">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <Plus className="w-3 h-3 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {view === "edit" ? "Edit Adjustment" : "Adjust Item Stock"}
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="p-3 space-y-4">
          {/* Add/Remove Inventory Toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">{addInventory ? "Add Inventory" : "Remove Inventory"}</Label>
            <Switch checked={addInventory} onCheckedChange={setAddInventory} />
          </div>

          {/* Top Row - Date, Subject, Store */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input
                placeholder="Enter subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Store <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={stores}
                value={store}
                onValueChange={setStore}
                placeholder="Select store..."
              />
              {!store && <p className="text-[10px] text-destructive">Required</p>}
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            {/* Add Button and Filters Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddItem}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add
              </Button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="min-w-[160px] text-xs">Item</TableHead>
                    <TableHead className="min-w-[80px] text-xs">Qty in Stock</TableHead>
                    <TableHead className="min-w-[100px] text-xs">Quantity</TableHead>
                    <TableHead className="min-w-[100px] text-xs">Cost Price</TableHead>
                    <TableHead className="min-w-[100px] text-xs">Rate</TableHead>
                    <TableHead className="min-w-[80px] text-xs">Total</TableHead>
                    <TableHead className="w-12 text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustmentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <SearchableSelect
                          options={parts.map(p => ({
                            value: p.id,
                            label: `${p.partNo} - ${p.description}`
                          }))}
                          value={item.itemId}
                          onValueChange={(v) => handleItemChange(item.id, "itemId", v)}
                          placeholder="Select item"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.qtyInStock}
                          disabled
                          className="h-8 text-xs bg-muted"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Input
                            type="number"
                            placeholder="Enter quantity"
                            value={item.quantity || ""}
                            onChange={(e) => handleItemChange(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-primary/50 focus:border-primary"
                          />
                          {!item.quantity && <p className="text-[10px] text-destructive">Required</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.lastPurchaseRate}
                          disabled
                          className="h-8 text-xs bg-muted"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Input
                            type="number"
                            placeholder="Enter rate"
                            value={item.rate || ""}
                            onChange={(e) => handleItemChange(item.id, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-primary/50 focus:border-primary"
                          />
                          {!item.rate && <p className="text-[10px] text-destructive">Required</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.total}
                          disabled
                          className="h-8 text-xs bg-muted"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total Amount - below items table */}
            <div className="flex justify-end">
              <div className="bg-muted/30 border border-border rounded-lg px-4 py-2 text-right">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold text-primary">{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs max-w-md min-h-[50px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={loading}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
