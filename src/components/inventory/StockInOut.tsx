import { useState, useEffect } from "react";
import {
  Search,
  Calendar,
  FileText,
  FileSpreadsheet,
  Package
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface StockItem {
  id: string;
  srNo: number;
  oemPartNo: string;
  name: string;
  brand: string;
  model: string;
  uom: string;
  qty: number;
  type: "in" | "out";
  transaction: string;
  store: string;
  rack: string;
  shelf: string;
  date?: string;
  reserved?: number;
  totalQty?: number; // Total quantity for this part
  availableQty?: number; // Available quantity (Total - Reserve)
}

export const StockInOut = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [item, setItem] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ value: string; label: string }[]>([]);
  const [parts, setParts] = useState<{ value: string; label: string }[]>([]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = items.slice(startIndex, endIndex);

  // Fetch categories and parts on mount
  useEffect(() => {
    fetchCategories();
    fetchSubCategories();
    fetchParts();
    fetchStockMovements();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      const categoriesData = (response as any).data || response;
      if (Array.isArray(categoriesData)) {
        setCategories([
          { value: "", label: "All Categories" },
          ...categoriesData.map((cat: any) => ({ value: cat.id, label: cat.name })),
        ]);
      }
    } catch (error) {
    }
  };

  const fetchSubCategories = async () => {
    try {
      const response = await apiClient.getAllSubcategories();
      const subCategoriesData = (response as any).data || response;
      if (Array.isArray(subCategoriesData)) {
        setSubCategories([
          { value: "", label: "All Sub Categories" },
          ...subCategoriesData.map((subCat: any) => ({ value: subCat.id, label: subCat.name })),
        ]);
      }
    } catch (error) {
    }
  };

  const fetchParts = async () => {
    try {
      const response = await apiClient.getParts({ page: 1, limit: 1000 });
      const partsData = (response as any).data || response;
      if (Array.isArray(partsData)) {
        setParts(partsData.map((part: any) => {
          // Remove grade information from description (e.g., "(Grade: O)", "(Grade: B)")
          const cleanDescription = (part.description || '').replace(/\(Grade:\s*[^)]+\)/gi, '').trim();
          const applicationText = part.application_name || part.application?.name || part.application || '';

          return {
            value: part.id,
            label: `${part.master_part_no || ''} - ${cleanDescription} - ${applicationText}`,
          };
        }));
      }
    } catch (error) {
    }
  };

  const fetchStockMovements = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };

      if (item) {
        params.part_id = item;
      }

      if (fromDate) {
        params.from_date = fromDate;
      }

      if (toDate) {
        params.to_date = toDate;
      }

      const response: any = await apiClient.getStockMovements(params);
      
      // Handle both response formats: { data: [...], pagination: {...} } or direct array
      let movementsData: any;
      let paginationData: any;
      
      if (response && Array.isArray(response.data)) {
        // Format: { data: [...], pagination: {...} }
        movementsData = response.data;
        paginationData = response.pagination;
      } else if (Array.isArray(response)) {
        // Format: direct array
        movementsData = response;
        paginationData = null;
      } else if (response && response.data && Array.isArray(response.data)) {
        // Another possible format
        movementsData = response.data;
        paginationData = response.pagination;
      } else {
        movementsData = [];
        paginationData = null;
      }

      if (movementsData && Array.isArray(movementsData)) {
        const startIdx = (currentPage - 1) * itemsPerPage;
        // Filter out stock_reservation type - they don't affect stock in/out calculations
        const filteredMovements = movementsData.filter((movement: any) => {
          const referenceType = (movement.reference_type || '').toLowerCase();
          return referenceType !== 'stock_reservation';
        });
        
        // Calculate reserve quantities and stock balances per part (group by part_id)
        const partDataMap = new Map<string, { reserved: number; currentStock: number; available: number }>();
        
        // First pass: collect all part data from movements
        // If API doesn't provide current_stock, we need to calculate it from movements
        const partStockMap = new Map<string, number>();
        
        filteredMovements.forEach((movement: any) => {
          const partId = movement.part_id;
          if (!partId) return;
          
          // Calculate stock balance from movements (if API doesn't provide it)
          if (!partStockMap.has(partId)) {
            partStockMap.set(partId, 0);
          }
          if (movement.type === 'in') {
            partStockMap.set(partId, (partStockMap.get(partId) || 0) + (movement.quantity || 0));
          } else if (movement.type === 'out') {
            partStockMap.set(partId, (partStockMap.get(partId) || 0) - (movement.quantity || 0));
          }
        });
        
        filteredMovements.forEach((movement: any) => {
          const partId = movement.part_id;
          if (!partId) return;
          
          if (!partDataMap.has(partId)) {
            // Get values from API response (should be same for all movements of same part)
            const reservedQty = movement.reserved_quantity ?? movement.reservedQty ?? movement.reserved ?? 0;
            // Use API value if available, otherwise calculate from movements
            const apiCurrentStock = movement.current_stock ?? movement.currentStock ?? movement.stock;
            const calculatedStock = partStockMap.get(partId) || 0;
            const currentStock = apiCurrentStock !== undefined && apiCurrentStock !== null ? apiCurrentStock : calculatedStock;
            const availableQty = movement.available_quantity ?? movement.availableQuantity ?? movement.available ?? Math.max(0, currentStock - reservedQty);
            
            partDataMap.set(partId, {
              reserved: reservedQty,
              currentStock: currentStock,
              available: availableQty
            });
          }
        });
        
        // Debug: Log sample data - ALWAYS log to help diagnose
        if (filteredMovements.length > 0) {
          const firstMovement = filteredMovements[0];
          const firstPartId = firstMovement.part_id;
          const firstPartData = partDataMap.get(firstPartId);
          
          
          // Check if values are actually 0 or missing
          if ((firstMovement.reserved_quantity === undefined || firstMovement.reserved_quantity === null) &&
              (firstMovement.current_stock === undefined || firstMovement.current_stock === null)) {
          } else {
          }
        }
        
        const formattedItems: StockItem[] = filteredMovements.map((movement: any, index: number) => {
          // Determine transaction type
          let transaction = '';
          const referenceType = (movement.reference_type || '').toLowerCase();
          const type = movement.type === 'in' ? 'in' : 'out';
          const isReserved = movement.is_reserved || false;
          const hasReference = movement.reference_id && movement.reference_type;

          // Get part data from map (same for all movements of same part)
          const partId = movement.part_id;
          const partData = partDataMap.get(partId) || { reserved: 0, currentStock: 0, available: 0 };
          const reservedQty = partData.reserved;
          const currentStock = partData.currentStock;
          const availableQty = partData.available;

          // If stock is reserved but not yet processed, don't show it in Qty column
          const actualQty = isReserved ? 0 : (movement.quantity || 0);

          if (referenceType.includes('dpo') || referenceType.includes('direct_purchase') || referenceType.includes('direct purchase')) {
            transaction = isReserved ? 'Reserved for DPO' : (type === 'in' ? 'Stock In by DPO' : 'Stock Out by DPO Return');
          } else if (referenceType.includes('invoice') || referenceType.includes('sale')) {
            transaction = isReserved ? 'Reserved for Invoice' : (type === 'in' ? 'Stock In by Sales Return' : 'Stock Out by Invoice');
          } else if (referenceType.includes('adjustment')) {
            transaction = type === 'in' ? 'Stock In by Adjustment' : 'Stock Out by Adjustment';
          } else if (referenceType.includes('transfer')) {
            transaction = type === 'in' ? 'Stock In by Transfer' : 'Stock Out by Transfer';
          } else if (referenceType.includes('purchase_order') || referenceType.includes('purchase order')) {
            transaction = isReserved ? 'Reserved for Purchase Order' : (type === 'in' ? 'Stock In by Purchase Order' : 'Stock Out by PO Return');
          } else {
            transaction = type === 'in' ? 'Stock In' : 'Stock Out';
          }

          return {
            id: movement.id,
            srNo: startIdx + index + 1,
            oemPartNo: movement.part_no || '',
            name: movement.part_description || '',
            brand: movement.brand || '',
            model: '', // Models would need to be fetched separately
            uom: 'pcs', // Default UOM
            qty: actualQty,
            type: type,
            transaction: transaction,
            store: movement.store_name || movement.store || '',
            rack: movement.rack_code || movement.rack || '',
            shelf: movement.shelf_no || movement.shelf || '',
            date: movement.created_at || movement.date || '',
            reserved: reservedQty,
            totalQty: currentStock,
            availableQty: availableQty,
          };
        });

        setItems(formattedItems);
        // Adjust total items count to exclude stock_reservation movements
        const allMovements = movementsData || [];
        const totalMovements = paginationData?.total || allMovements.length;
        const stockReservationCount = allMovements.filter((m: any) => 
          (m.reference_type || '').toLowerCase() === 'stock_reservation'
        ).length;
        setTotalItems(totalMovements - stockReservationCount);
      } else {
        // No data or invalid format
        setItems([]);
        setTotalItems(0);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch stock movements');
    } finally {
      setLoading(false);
    }
  };

  // Refetch when pagination changes (skip initial render to avoid double fetch)
  useEffect(() => {
    const hasInitialized = items.length > 0;
    if (hasInitialized) {
      fetchStockMovements();
    }
  }, [currentPage, itemsPerPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    // Reset to page 1 and fetch with current filters
    fetchStockMovements();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(currentItems.map((item) => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter((itemId) => itemId !== id));
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Fetch all movements for report (without pagination)
  const fetchAllMovements = async () => {
    try {
      const params: any = {
        page: 1,
        limit: 10000, // Large limit to get all records
      };

      if (item) {
        params.part_id = item;
      }

      if (fromDate) {
        params.from_date = fromDate;
      }

      if (toDate) {
        params.to_date = toDate;
      }

      const response: any = await apiClient.getStockMovements(params);
      const movementsData = (response as any).data || response;

      if (movementsData && Array.isArray(movementsData.data)) {
        return movementsData.data.map((movement: any) => {
          const isReserved = movement.is_reserved || false;
          const hasReference = movement.reference_id && movement.reference_type;
          const reservedQty = (hasReference && isReserved) ? (movement.reserved_quantity || 0) : 0;
          const actualQty = isReserved ? 0 : (movement.quantity || 0);

          return {
            id: movement.id,
            srNo: 0, // Will be set when generating report
            oemPartNo: movement.part_no || '',
            name: movement.part_description || '',
            brand: movement.brand || '',
            model: '',
            uom: 'pcs',
            qty: actualQty,
            type: movement.type === 'in' ? 'in' : 'out',
            store: movement.store_name || movement.store || '',
            rack: movement.rack_code || movement.rack || '',
            shelf: movement.shelf_no || movement.shelf || '',
            date: movement.created_at || movement.date || '',
            reserved: reservedQty,
          };
        });
      } else if (Array.isArray(movementsData)) {
        return movementsData.map((movement: any) => {
          const isReserved = movement.is_reserved || false;
          const hasReference = movement.reference_id && movement.reference_type;
          const reservedQty = (hasReference && isReserved) ? (movement.reserved_quantity || 0) : 0;
          const actualQty = isReserved ? 0 : (movement.quantity || 0);

          return {
            id: movement.id,
            srNo: 0,
            oemPartNo: movement.part_no || '',
            name: movement.part_description || '',
            brand: movement.brand || '',
            model: '',
            uom: 'pcs',
            qty: actualQty,
            type: movement.type === 'in' ? 'in' : 'out',
            store: movement.store_name || movement.store || '',
            rack: movement.rack_code || movement.rack || '',
            shelf: movement.shelf_no || movement.shelf || '',
            date: movement.created_at || movement.date || '',
            reserved: reservedQty,
          };
        });
      }
      return [];
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch movements for report');
      return [];
    }
  };

  const handlePrintReport = async () => {
    try {
      toast.loading('Generating report...');
      const allMovements = await fetchAllMovements();

      if (allMovements.length === 0) {
        toast.dismiss();
        toast.error('No data available to generate report');
        return;
      }

      // Format date for display
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch {
          return dateStr;
        }
      };

      // Create print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.dismiss();
        toast.error('Please allow popups to generate report');
        return;
      }

      const filterInfo = [];
      if (fromDate) filterInfo.push(`From: ${new Date(fromDate).toLocaleDateString()}`);
      if (toDate) filterInfo.push(`To: ${new Date(toDate).toLocaleDateString()}`);
      if (item) {
        const selectedPart = parts.find(p => p.value === item);
        if (selectedPart) filterInfo.push(`Part: ${selectedPart.label}`);
      }

      const totalIn = allMovements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.qty, 0);
      const totalOut = allMovements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.qty, 0);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stock In/Out Report</title>
          <style>
            @media print {
              @page { margin: 1cm; }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              color: #1a1a1a;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .filters {
              margin-bottom: 20px;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .filters p {
              margin: 5px 0;
              font-size: 14px;
            }
            .summary {
              display: flex;
              justify-content: space-around;
              margin-bottom: 20px;
              padding: 15px;
              background: #f9f9f9;
              border-radius: 5px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-item strong {
              display: block;
              font-size: 18px;
              color: #1a1a1a;
            }
            .summary-item span {
              font-size: 14px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background: #1a1a1a;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #333;
            }
            td {
              padding: 10px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background: #f9f9f9;
            }
            .type-in {
              color: #059669;
              font-weight: bold;
            }
            .type-out {
              color: #dc2626;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Stock In/Out Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
          
          ${filterInfo.length > 0 ? `
          <div class="filters">
            <p><strong>Filters Applied:</strong></p>
            ${filterInfo.map(f => `<p>${f}</p>`).join('')}
          </div>
          ` : ''}
          
          <div class="summary">
            <div class="summary-item">
              <strong>${allMovements.length}</strong>
              <span>Total Records</span>
            </div>
            <div class="summary-item">
              <strong class="type-in">${totalIn}</strong>
              <span>Total Stock In</span>
            </div>
            <div class="summary-item">
              <strong class="type-out">${totalOut}</strong>
              <span>Total Stock Out</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>SR</th>
                <th>Part No</th>
                <th>Description</th>
                <th>Brand</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Store</th>
                <th>Rack</th>
                <th>Shelf</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${allMovements.map((movement, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${movement.oemPartNo}</td>
                  <td>${movement.name}</td>
                  <td>${movement.brand}</td>
                  <td class="type-${movement.type}">${movement.type.toUpperCase()}</td>
                  <td>${movement.qty}</td>
                  <td>${movement.store || '-'}</td>
                  <td>${movement.rack || '-'}</td>
                  <td>${movement.shelf || '-'}</td>
                  <td>${formatDate(movement.date || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>This report was generated from the Inventory ERP System</p>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      toast.dismiss();
      toast.success('Report generated successfully');

      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Failed to generate report');
    }
  };

  const handlePrintExcel = async () => {
    try {
      toast.loading('Generating Excel file...');
      const allMovements = await fetchAllMovements();

      if (allMovements.length === 0) {
        toast.dismiss();
        toast.error('No data available to export');
        return;
      }

      // Format date for CSV
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch {
          return dateStr;
        }
      };

      // CSV Headers
      const headers = [
        'SR No',
        'Part No',
        'Description',
        'Brand',
        'Type',
        'Quantity',
        'UOM',
        'Store',
        'Rack',
        'Shelf',
        'Date'
      ];

      // CSV Data rows
      const csvRows = [
        headers.join(','),
        ...allMovements.map((movement, index) => [
          index + 1,
          `"${movement.oemPartNo}"`,
          `"${movement.name.replace(/"/g, '""')}"`,
          `"${movement.brand}"`,
          movement.type.toUpperCase(),
          movement.qty,
          movement.uom,
          `"${movement.store || ''}"`,
          `"${movement.rack || ''}"`,
          `"${movement.shelf || ''}"`,
          formatDate(movement.date || '')
        ].join(','))
      ];

      // Create CSV content
      const csvContent = csvRows.join('\n');

      // Add BOM for Excel UTF-8 support
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with date and filters
      const dateStr = new Date().toISOString().split('T')[0];
      let filename = `stock-in-out-report-${dateStr}`;
      if (fromDate || toDate) {
        filename += `-filtered`;
      }
      filename += '.csv';

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('Excel file downloaded successfully');
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Failed to generate Excel file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Inventory Stock</h2>
          <p className="text-sm text-muted-foreground">View and manage stock in/out movements</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-4">
        {/* Filter Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Category</label>
            <SearchableSelect
              options={categories}
              value={category}
              onValueChange={setCategory}
              placeholder="Select..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Sub Category</label>
            <SearchableSelect
              options={subCategories}
              value={subCategory}
              onValueChange={setSubCategory}
              placeholder="Select..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Item</label>
            <SearchableSelect
              options={[{ value: "", label: "All Items" }, ...parts]}
              value={item}
              onValueChange={setItem}
              placeholder="Select..."
            />
          </div>
        </div>

        {/* Filter Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">From Date</label>
            <div className="relative">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 bg-background pr-10"
                placeholder="dd/mm/yyyy"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">To Date</label>
            <div className="relative">
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 bg-background pr-10"
                placeholder="dd/mm/yyyy"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSearch}
            disabled={loading}
          >
            <Search className="w-4 h-4" />
            {loading ? "Searching..." : "Search"}
          </Button>
          {/* <Button
            variant="outline"
            className="gap-2 border-primary text-primary hover:bg-primary/10 hover:text-primary"
            onClick={handlePrintReport}
            disabled={loading}
          >
            <FileText className="w-4 h-4" />
            Print Report
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-chart-green text-chart-green hover:bg-chart-green/10 hover:text-chart-green"
            onClick={handlePrintExcel}
            disabled={loading}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Print Excel
          </Button> */}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === currentItems.length && currentItems.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Sr. No</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">OEM/ Part No</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Transaction</TableHead>

              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Brand</TableHead>

              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Uom</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap text-center">Qty</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap text-center">Reserve</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap text-center">Available</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Store</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Racks</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Shelf</TableHead>
              <TableHead className="text-xs font-semibold text-foreground whitespace-nowrap">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  Loading stock movements...
                </TableCell>
              </TableRow>
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  No stock movements found
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((stockItem) => (
                <TableRow
                  key={stockItem.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    selectedItems.includes(stockItem.id) && "bg-primary/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.includes(stockItem.id)}
                      onCheckedChange={(checked) => handleSelectItem(stockItem.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{stockItem.srNo}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">{stockItem.oemPartNo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{stockItem.transaction}</TableCell>

                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{stockItem.brand}</TableCell>

                  <TableCell className="text-sm text-muted-foreground">{stockItem.uom}</TableCell>
                  <TableCell className={cn(
                    "text-sm font-semibold text-center",
                    stockItem.type === "in" ? "text-green-600" : "text-red-600"
                  )}>
                    {stockItem.type === "in" ? stockItem.qty : `-${stockItem.qty}`}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-center text-blue-600">
                    {stockItem.reserved ?? 0}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-center text-green-600">
                    {stockItem.availableQty ?? stockItem.totalQty ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{stockItem.store}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{stockItem.rack}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{stockItem.shelf}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {stockItem.date ? new Date(stockItem.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
            {/* Summary Row */}
            {currentItems.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={10} className="text-right text-sm font-semibold">
                  Totals:
                </TableCell>
                <TableCell className={cn(
                  "text-sm font-bold text-center",
                  (() => {
                    const totalIn = currentItems
                      .filter(item => item.type === "in")
                      .reduce((sum, item) => sum + item.qty, 0);
                    const totalOut = currentItems
                      .filter(item => item.type === "out")
                      .reduce((sum, item) => sum + item.qty, 0);
                    return totalIn - totalOut >= 0 ? "text-green-600" : "text-red-600";
                  })()
                )}>
                  {(() => {
                    const totalIn = currentItems
                      .filter(item => item.type === "in")
                      .reduce((sum, item) => sum + item.qty, 0);
                    const totalOut = currentItems
                      .filter(item => item.type === "out")
                      .reduce((sum, item) => sum + item.qty, 0);
                    const net = totalIn - totalOut;
                    return net >= 0 ? `${net}` : `${net}`;
                  })()}
                </TableCell>
                <TableCell className="text-sm font-bold text-center text-blue-600">
                  {currentItems.reduce((sum, item) => sum + (item.reserved || 0), 0)}
                </TableCell>
                <TableCell className="text-sm font-bold text-center text-green-600">
                  {(() => {
                    // Get unique parts and their reserve/available quantities
                    const partMap = new Map<string, { reserved: number; available: number }>();
                    currentItems.forEach(item => {
                      const partId = item.oemPartNo; // Using partNo as key since we don't have partId in StockItem
                      if (!partMap.has(partId)) {
                        partMap.set(partId, { 
                          reserved: item.reserved || 0, 
                          available: item.availableQty || 0 
                        });
                      }
                    });
                    // Sum available quantities (each part counted once)
                    return Array.from(partMap.values()).reduce((sum, part) => sum + part.available, 0);
                  })()}
                </TableCell>
                <TableCell colSpan={4} className="text-xs text-muted-foreground">
                  <span className="text-green-600">In: {currentItems
                    .filter(item => item.type === "in")
                    .reduce((sum, item) => sum + item.qty, 0)}</span>
                  {' | '}
                  <span className="text-red-600">Out: {currentItems
                    .filter(item => item.type === "out")
                    .reduce((sum, item) => sum + item.qty, 0)}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {endIndex} of {totalItems} Records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="h-8 px-3"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-3"
            >
              Prev
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-12 h-8 text-center text-sm"
                min={1}
                max={totalPages}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 px-3"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 px-3"
            >
              Last
            </Button>
            <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-16 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
