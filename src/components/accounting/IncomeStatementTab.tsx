import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Download, Printer, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface IncomeCategory {
  name: string;
  items: { name: string; amount: number }[];
}

// Use the same API URL detection as api.ts to ensure database isolation
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '');
  }
  
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    const pathname = window.location.pathname;
    
    // If we're in /dev-koncepts path, use /dev-koncepts/api (routes to port 3002)
    if (pathname.startsWith('/dev-koncepts')) {
      return `${origin}/dev-koncepts`;
    }
    
    // Otherwise use /api (routes to port 3001 for main app)
    return origin;
  }
  
  return 'http://localhost:3001';
};

const API_URL = getApiBaseUrl();

export const IncomeStatementTab = () => {
  const [revenueData, setRevenueData] = useState<IncomeCategory[]>([]);
  const [costData, setCostData] = useState<IncomeCategory[]>([]);
  const [expenseData, setExpenseData] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("2025-12-01");
  const [toDate, setToDate] = useState("2025-12-26");
  const [expandedRevenue, setExpandedRevenue] = useState<string[]>([]);
  const [expandedCost, setExpandedCost] = useState<string[]>([]);
  const [expandedExpenses, setExpandedExpenses] = useState<string[]>([]);

  useEffect(() => {
    fetchIncomeStatement();
  }, [fromDate, toDate]);

  const fetchIncomeStatement = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("from_date", fromDate);
      params.append("to_date", toDate);
      
      const response = await fetch(`${API_URL}/api/accounting/income-statement?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRevenueData(data.revenue || []);
        setCostData(data.cost || []);
        setExpenseData(data.expenses || []);
        // Auto-expand first items
        if (data.revenue && data.revenue.length > 0) {
          setExpandedRevenue([data.revenue[0].name]);
        }
        if (data.cost && data.cost.length > 0) {
          setExpandedCost([data.cost[0].name]);
        }
        if (data.expenses && data.expenses.length > 0) {
          setExpandedExpenses([data.expenses[0].name]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching income statement:", errorData.error || response.statusText);
      }
    } catch (error) {
      console.error("Error fetching income statement:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printHTML = `
      <html>
        <head>
          <title>Income Statement</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; }
            .section { margin-top: 20px; }
            .item { padding: 4px 0; }
            .total { font-weight: bold; padding: 8px 0; border-top: 2px solid #333; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>Income Statement - ${fromDate} to ${toDate}</h1>
          <div class="section">
            <h2>Revenue</h2>
            ${revenueData.map(cat => `
              <div class="item">
                <strong>${cat.name}</strong>: Rs ${cat.items.reduce((s, item) => s + item.amount, 0).toLocaleString()}
              </div>
            `).join('')}
            <div class="total">Total Revenue: Rs ${totalRevenue.toLocaleString()}</div>
          </div>
          <div class="section">
            <h2>Expenses</h2>
            ${expenseData.map(cat => `
              <div class="item">
                <strong>${cat.name}</strong>: Rs ${cat.items.reduce((s, item) => s + item.amount, 0).toLocaleString()}
              </div>
            `).join('')}
            <div class="total">Total Expenses: Rs ${totalExpenses.toLocaleString()}</div>
          </div>
          <div class="section">
            <div class="total">Net Income: Rs ${netIncome.toLocaleString()}</div>
          </div>
          <button onclick="window.print()">Print</button>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExport = () => {
    const rows = [];
    rows.push(["Category", "Item", "Amount"]);
    revenueData.forEach(cat => {
      rows.push([cat.name, "", ""]);
      cat.items.forEach(item => {
        rows.push(["", item.name, item.amount]);
      });
    });
    rows.push(["Total Revenue", "", totalRevenue]);
    costData.forEach(cat => {
      rows.push([cat.name, "", ""]);
      cat.items.forEach(item => {
        rows.push(["", item.name, item.amount]);
      });
    });
    rows.push(["Total Cost", "", totalCost]);
    rows.push(["Gross Profit", "", grossProfit]);
    expenseData.forEach(cat => {
      rows.push([cat.name, "", ""]);
      cat.items.forEach(item => {
        rows.push(["", item.name, item.amount]);
      });
    });
    rows.push(["Total Expenses", "", totalExpenses]);
    rows.push(["Net Income", "", netIncome]);
    
    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `income_statement_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };


  const totalRevenue = revenueData.reduce((sum, cat) => 
    sum + cat.items.reduce((s, item) => s + item.amount, 0), 0
  );

  const totalCost = costData.reduce((sum, cat) => 
    sum + cat.items.reduce((s, item) => s + item.amount, 0), 0
  );

  const grossProfit = totalRevenue - totalCost;

  const totalExpenses = expenseData.reduce((sum, cat) => 
    sum + cat.items.reduce((s, item) => s + item.amount, 0), 0
  );

  const netIncome = grossProfit - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">Rs {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold text-orange-600">Rs {totalCost.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-600">Rs {grossProfit.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netIncome >= 0 ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'} transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  Rs {netIncome.toLocaleString()}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full ${netIncome >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                <DollarSign className={`h-6 w-6 ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Income Statement */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Income Statement
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Profit & Loss Statement</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">From:</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">To:</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Button 
                variant="default" 
                size="sm" 
                onClick={fetchIncomeStatement}
                className="transition-all duration-200 hover:scale-105"
              >
                Search
              </Button>
              <Button variant="outline" size="sm" className="transition-all duration-200 hover:scale-105" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" className="transition-all duration-200 hover:scale-105" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Simple Table Format matching screenshot */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Account</TableHead>
                      <TableHead className="text-right font-semibold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue Section */}
                    {revenueData.length > 0 ? (
                      revenueData.map((category) => (
                        category.items.map((item) => (
                          <TableRow key={`rev-${item.name}`}>
                            <TableCell className="pl-8">{item.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No revenue accounts</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total Revenue</TableCell>
                      <TableCell className="text-right font-mono">{totalRevenue.toLocaleString()}</TableCell>
                    </TableRow>

                    {/* Cost Section */}
                    {costData.length > 0 ? (
                      costData.map((category) => (
                        category.items.map((item) => (
                          <TableRow key={`cost-${item.name}`}>
                            <TableCell className="pl-8">{item.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No cost accounts</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total Cost</TableCell>
                      <TableCell className="text-right font-mono">{totalCost.toLocaleString()}</TableCell>
                    </TableRow>

                    {/* Gross Profit */}
                    <TableRow className="bg-green-500/10 font-semibold">
                      <TableCell className="text-green-600">Gross Profit</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{grossProfit.toLocaleString()}</TableCell>
                    </TableRow>

                    {/* Expenses Section */}
                    {expenseData.length > 0 ? (
                      expenseData.map((category) => (
                        category.items.map((item) => (
                          <TableRow key={`exp-${item.name}`}>
                            <TableCell className="pl-8">{item.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No expense accounts</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total Expenses</TableCell>
                      <TableCell className="text-right font-mono">{totalExpenses.toLocaleString()}</TableCell>
                    </TableRow>

                    {/* Net Income */}
                    <TableRow className={`font-bold ${netIncome >= 0 ? 'bg-orange-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                      <TableCell>Net Income</TableCell>
                      <TableCell className="text-right font-mono">{netIncome.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
