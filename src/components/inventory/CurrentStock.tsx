import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Package, 
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";

interface StockItem {
  part_id: string;
  part_no: string;
  master_part_no: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  location: string | null;
  current_stock: number;
  cost: number | null;
  price: number | null;
  value: number;
}

type StockStatusFilter = "all" | "in_stock" | "out_of_stock" | "low_stock";

export const CurrentStock = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch stock data when filters change
  useEffect(() => {
    fetchStockData();
  }, [selectedCategory, stockStatusFilter, currentPage, itemsPerPage]);

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchStockData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      const data = Array.isArray(response) ? response : (response as any).data || [];
      const categoryNames = data
        .map((cat: any) => cat.name || cat.category_name)
        .filter((name: string) => name && name.trim() !== '');
      setCategories(['all', ...categoryNames]);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories(['all']);
    }
  };

  const fetchStockData = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };

      if (selectedCategory !== "all") {
        // Find category by name
        const response = await apiClient.getCategories();
        const data = Array.isArray(response) ? response : (response as any).data || [];
        const category = data.find((cat: any) => 
          (cat.name || cat.category_name) === selectedCategory
        );
        if (category) {
          params.category_id = category.id;
        }
      }

      if (stockStatusFilter === "in_stock") {
        params.in_stock = true;
      } else if (stockStatusFilter === "out_of_stock") {
        params.out_of_stock = true;
      } else if (stockStatusFilter === "low_stock") {
        params.low_stock = true;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await apiClient.getStockBalances(params);
      let data = (response as any).data || [];
      const pagination = (response as any).pagination;

      // Client-side enforcement of stock status filter (in case backend doesn't apply it)
      if (stockStatusFilter === "in_stock") {
        data = data.filter((item: StockItem) => (item.current_stock ?? 0) > 0);
      } else if (stockStatusFilter === "out_of_stock") {
        data = data.filter((item: StockItem) => (item.current_stock ?? 0) <= 0);
      }

      setStockData(data);
      if (pagination) {
        setTotalItems(pagination.total || 0);
        setTotalPages(pagination.totalPages || 0);
      } else {
        setTotalItems(data.length);
        setTotalPages(1);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.error || "Failed to fetch stock data",
        variant: "destructive",
      });
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return `Rs ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString('en-PK');
  };

  const handleExport = () => {
    // Create CSV content
    const headers = [
      "Part No",
      "Master Part No",
      "Brand",
      "Category",
      "Description",
      "Location",
      "Stock",
      "Cost",
      "Price",
      "Value"
    ];

    const csvRows = [
      headers.join(","),
      ...stockData.map(item => [
        `"${item.part_no || ''}"`,
        `"${item.master_part_no || ''}"`,
        `"${item.brand || ''}"`,
        `"${item.category || ''}"`,
        `"${item.description || ''}"`,
        `"${item.location || ''}"`,
        item.current_stock || 0,
        item.cost || 0,
        item.price || 0,
        item.value || 0,
      ].join(","))
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `current-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Stock data exported to CSV",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Current Stock</h1>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by part no, description, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={stockStatusFilter}
            onValueChange={(v) => { setStockStatusFilter(v as StockStatusFilter); setCurrentPage(1); }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in_stock">In stock only</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(itemsPerPage)} onValueChange={(v) => {
            setItemsPerPage(Number(v));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
              <SelectItem value="200">200 per page</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || selectedCategory !== "all" || stockStatusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setStockStatusFilter("all");
                setCurrentPage(1);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Part No</TableHead>
                <TableHead className="w-[120px]">Master Part No</TableHead>
                <TableHead className="w-[100px]">Brand</TableHead>
                <TableHead className="w-[150px]">Category</TableHead>
                <TableHead className="w-[200px]">Description</TableHead>
                <TableHead className="w-[80px]">Location</TableHead>
                <TableHead className="w-[80px] text-right">Stock</TableHead>
                <TableHead className="w-[100px] text-right">Cost</TableHead>
                <TableHead className="w-[100px] text-right">Price</TableHead>
                <TableHead className="w-[100px] text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="ml-2">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : stockData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No stock data found
                  </TableCell>
                </TableRow>
              ) : (
                stockData.map((item) => (
                  <TableRow key={item.part_id}>
                    <TableCell className="font-medium">{item.part_no || "-"}</TableCell>
                    <TableCell>{item.master_part_no || "-"}</TableCell>
                    <TableCell>{item.brand || "-"}</TableCell>
                    <TableCell>{item.category || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.description || ""}>
                      {item.description || "-"}
                    </TableCell>
                    <TableCell>{item.location || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(item.current_stock)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.value)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
