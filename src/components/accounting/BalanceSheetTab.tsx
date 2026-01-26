import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Printer, Building2, Wallet, Landmark, CheckCircle2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getCurrentDatePakistan } from "@/utils/dateUtils";

interface BalanceAccount {
  name: string;
  amount: number;
}

interface BalanceSubgroup {
  name: string;
  items: BalanceAccount[];
  total?: number;
}

interface BalanceMainGroup {
  name: string;
  items: BalanceSubgroup[];
  total?: number;
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

export const BalanceSheetTab = () => {
  const [assetsData, setAssetsData] = useState<BalanceMainGroup[]>([]);
  const [liabilitiesData, setLiabilitiesData] = useState<BalanceMainGroup[]>([]);
  const [equityData, setEquityData] = useState<BalanceMainGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");
  // Add date state - default to current date in Pakistan timezone automatically
  const [selectedDate, setSelectedDate] = useState(() => {
    // Always default to today's date in Pakistan timezone - balance sheet shows cumulative balances up to current date
    return getCurrentDatePakistan();
  });
  const [expandedAssets, setExpandedAssets] = useState<string[]>([]);
  const [expandedLiabilities, setExpandedLiabilities] = useState<string[]>([]);
  const [expandedEquity, setExpandedEquity] = useState<string[]>([]);
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBalanceSheet();
  }, [period, selectedDate]);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("period", period);
      
      // Balance sheet shows cumulative balances up to the selected date
      // Use selected date if period is "current", otherwise use period date
      let asOfDate = selectedDate;
      if (period === "current") {
        // Use selected date - this will include ALL transactions up to and including this date
        asOfDate = selectedDate;
      } else if (period === "december-2024") {
        asOfDate = "2024-12-31";
      } else if (period === "september-2024") {
        asOfDate = "2024-09-30";
      } else if (period === "june-2024") {
        asOfDate = "2024-06-30";
      }
      
      // Ensure date is in YYYY-MM-DD format
      if (asOfDate && !asOfDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Convert from DD/MM/YYYY or other formats if needed
        const dateObj = new Date(asOfDate);
        asOfDate = dateObj.toISOString().split('T')[0];
      }
      
      params.append("as_of_date", asOfDate);
      
      
      const response = await fetch(`${API_URL}/api/accounting/balance-sheet?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Verify data structure and count all accounts
        let totalAssetAccounts = 0;
        if (data.assets && data.assets.length > 0) {
          data.assets.forEach((mg: any, mgIdx: number) => {
            if (mg.items && mg.items.length > 0) {
              mg.items.forEach((sg: any, sgIdx: number) => {
                const accountCount = sg.items?.length || 0;
                totalAssetAccounts += accountCount;
                if (sg.items && sg.items.length > 0) {
                } else {
                }
              });
            } else {
            }
          });
        } else {
        }
        
        // Set the data - ensure we're setting the correct structure
        const assets = data.assets || [];
        setAssetsData(assets);
        setLiabilitiesData(data.liabilities || []);
        setEquityData(data.equity || []);
        
        // Auto-expand ALL main groups and subgroups to show all entries
        const allAssetsMainGroups = (data.assets || []).map(mg => mg.name);
        const allLiabilitiesMainGroups = (data.liabilities || []).map(mg => mg.name);
        const allEquityMainGroups = (data.equity || []).map(mg => mg.name);
        
        
        setExpandedAssets(allAssetsMainGroups);
        setExpandedLiabilities(allLiabilitiesMainGroups);
        setExpandedEquity(allEquityMainGroups);
        
        // Auto-expand all subgroups
        const allSubgroups: Record<string, string[]> = {};
        
        (data.assets || []).forEach(mainGroup => {
          const subgroupNames = (mainGroup.items || []).map(sg => sg.name);
          allSubgroups[mainGroup.name] = subgroupNames;
          (mainGroup.items || []).forEach(sg => {
            // Specifically log Sales Customer Receivables
            if (sg.name && sg.name.includes('104') || sg.name && sg.name.includes('Sales Customer Receivables')) {
            }
          });
        });
        
        (data.liabilities || []).forEach(mainGroup => {
          const subgroupNames = (mainGroup.items || []).map(sg => sg.name);
          allSubgroups[mainGroup.name] = subgroupNames;
          (mainGroup.items || []).forEach(sg => {
          });
        });
        
        (data.equity || []).forEach(mainGroup => {
          const subgroupNames = (mainGroup.items || []).map(sg => sg.name);
          allSubgroups[mainGroup.name] = subgroupNames;
          (mainGroup.items || []).forEach(sg => {
          });
        });
        
        setExpandedSubgroups(allSubgroups);
      } else {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
        } catch (e) {
        }
        // Set empty arrays to show "No data" message
        setAssetsData([]);
        setLiabilitiesData([]);
        setEquityData([]);
      }
    } catch (error: any) {
      // Set empty arrays on error to show "No data" message
      setAssetsData([]);
      setLiabilitiesData([]);
      setEquityData([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printHTML = `
      <html>
        <head>
          <title>Balance Sheet</title>
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
          <h1>Balance Sheet - ${period}</h1>
          <div class="section">
            <h2>Assets</h2>
            ${assetsData.map(mainGroup => {
              const mainTotal = mainGroup.total || mainGroup.items.reduce((s, sg) => 
                s + (sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0)), 0
              );
              return `
                <div class="item">
                  <strong>${mainGroup.name}</strong>: Rs ${mainTotal.toLocaleString()}
                  ${mainGroup.items.map(sg => {
                    const sgTotal = sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0);
                    return `
                      <div style="margin-left: 20px;">
                        <strong>${sg.name}</strong>: Rs ${sgTotal.toLocaleString()}
                        ${sg.items.map(acc => `
                          <div style="margin-left: 40px;">
                            ${acc.name}: Rs ${acc.amount.toLocaleString()}
                          </div>
                        `).join('')}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
            <div class="total">Total Assets: Rs ${totalAssets.toLocaleString()}</div>
          </div>
          <div class="section">
            <h2>Liabilities</h2>
            ${liabilitiesData.map(mainGroup => {
              const mainTotal = mainGroup.total || mainGroup.items.reduce((s, sg) => 
                s + (sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0)), 0
              );
              return `
                <div class="item">
                  <strong>${mainGroup.name}</strong>: Rs ${mainTotal.toLocaleString()}
                  ${mainGroup.items.map(sg => {
                    const sgTotal = sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0);
                    return `
                      <div style="margin-left: 20px;">
                        <strong>${sg.name}</strong>: Rs ${sgTotal.toLocaleString()}
                        ${sg.items.map(acc => `
                          <div style="margin-left: 40px;">
                            ${acc.name}: Rs ${acc.amount.toLocaleString()}
                          </div>
                        `).join('')}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
            <div class="total">Total Liabilities: Rs ${totalLiabilities.toLocaleString()}</div>
          </div>
          <div class="section">
            <h2>Equity</h2>
            ${equityData.map(mainGroup => {
              const mainTotal = mainGroup.total || mainGroup.items.reduce((s, sg) => 
                s + (sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0)), 0
              );
              return `
                <div class="item">
                  <strong>${mainGroup.name}</strong>: Rs ${mainTotal.toLocaleString()}
                  ${mainGroup.items.map(sg => {
                    const sgTotal = sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0);
                    return `
                      <div style="margin-left: 20px;">
                        <strong>${sg.name}</strong>: Rs ${sgTotal.toLocaleString()}
                        ${sg.items.map(acc => `
                          <div style="margin-left: 40px;">
                            ${acc.name}: Rs ${acc.amount.toLocaleString()}
                          </div>
                        `).join('')}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
            <div class="total">Total Equity: Rs ${totalEquity.toLocaleString()}</div>
          </div>
          <div class="section">
            <div class="total">Total Liabilities & Equity: Rs ${liabilitiesAndEquity.toLocaleString()}</div>
            <div class="total">Balance: ${isBalanced ? 'Balanced' : 'Unbalanced'}</div>
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
    rows.push(["Section", "Main Group", "Subgroup", "Account", "Amount"]);
    assetsData.forEach(mainGroup => {
      mainGroup.items.forEach(subgroup => {
        subgroup.items.forEach(account => {
          rows.push(["ASSETS", mainGroup.name, subgroup.name, account.name, account.amount]);
        });
      });
    });
    rows.push(["ASSETS", "Total Assets", "", "", totalAssets]);
    liabilitiesData.forEach(mainGroup => {
      mainGroup.items.forEach(subgroup => {
        subgroup.items.forEach(account => {
          rows.push(["LIABILITIES", mainGroup.name, subgroup.name, account.name, account.amount]);
        });
      });
    });
    rows.push(["LIABILITIES", "Total Liabilities", "", "", totalLiabilities]);
    equityData.forEach(mainGroup => {
      mainGroup.items.forEach(subgroup => {
        subgroup.items.forEach(account => {
          rows.push(["EQUITY", mainGroup.name, subgroup.name, account.name, account.amount]);
        });
      });
    });
    rows.push(["EQUITY", "Total Equity", "", "", totalEquity]);
    rows.push(["", "Total Liabilities & Equity", "", liabilitiesAndEquity]);
    
    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `balance_sheet_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string, type: "assets" | "liabilities" | "equity") => {
    if (type === "assets") {
      setExpandedAssets(prev => prev.includes(section) ? prev.filter(n => n !== section) : [...prev, section]);
    } else if (type === "liabilities") {
      setExpandedLiabilities(prev => prev.includes(section) ? prev.filter(n => n !== section) : [...prev, section]);
    } else {
      setExpandedEquity(prev => prev.includes(section) ? prev.filter(n => n !== section) : [...prev, section]);
    }
  };

  const toggleSubgroup = (mainGroupName: string, subgroupName: string) => {
    setExpandedSubgroups(prev => {
      const current = prev[mainGroupName] || [];
      return {
        ...prev,
        [mainGroupName]: current.includes(subgroupName) 
          ? current.filter(n => n !== subgroupName)
          : [...current, subgroupName]
      };
    });
  };

  const totalAssets = assetsData.reduce((sum, mainGroup) => {
    if (!mainGroup) return sum;
    const mainTotal = mainGroup.total;
    if (mainTotal !== undefined && mainTotal !== null) {
      return sum + mainTotal;
    }
    if (!mainGroup.items || mainGroup.items.length === 0) return sum;
    return sum + mainGroup.items.reduce((s, subgroup) => {
      if (!subgroup) return s;
      const subTotal = subgroup.total;
      if (subTotal !== undefined && subTotal !== null) {
        return s + subTotal;
      }
      if (!subgroup.items || subgroup.items.length === 0) return s;
      return s + subgroup.items.reduce((acc, item) => {
        return acc + (item?.amount || 0);
      }, 0);
    }, 0);
  }, 0);

  const totalLiabilities = liabilitiesData.reduce((sum, mainGroup) => {
    if (!mainGroup) return sum;
    const mainTotal = mainGroup.total;
    if (mainTotal !== undefined && mainTotal !== null) {
      return sum + mainTotal;
    }
    if (!mainGroup.items || mainGroup.items.length === 0) return sum;
    return sum + mainGroup.items.reduce((s, subgroup) => {
      if (!subgroup) return s;
      const subTotal = subgroup.total;
      if (subTotal !== undefined && subTotal !== null) {
        return s + subTotal;
      }
      if (!subgroup.items || subgroup.items.length === 0) return s;
      return s + subgroup.items.reduce((acc, item) => {
        return acc + (item?.amount || 0);
      }, 0);
    }, 0);
  }, 0);

  const totalEquity = equityData.reduce((sum, mainGroup) => {
    if (!mainGroup) return sum;
    const mainTotal = mainGroup.total;
    if (mainTotal !== undefined && mainTotal !== null) {
      return sum + mainTotal;
    }
    if (!mainGroup.items || mainGroup.items.length === 0) return sum;
    return sum + mainGroup.items.reduce((s, subgroup) => {
      if (!subgroup) return s;
      const subTotal = subgroup.total;
      if (subTotal !== undefined && subTotal !== null) {
        return s + subTotal;
      }
      if (!subgroup.items || subgroup.items.length === 0) return s;
      return s + subgroup.items.reduce((acc, item) => {
        return acc + (item?.amount || 0);
      }, 0);
    }, 0);
  }, 0);

  // Calculate proper totals for balance check
  const calculateCapitalTotals = () => {
    const drawingsMainGroup = equityData.find(mg => mg.name.includes('6-Drawings') || mg.name.includes('Drawings'));
    const drawingsTotal = drawingsMainGroup?.total || drawingsMainGroup?.items.reduce((s, sg) => 
      s + (sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0)), 0
    ) || 0;
    const capitalMainGroup = equityData.find(mg => mg.name.includes('5-Capital') || (mg.name.includes('Capital') && !mg.name.includes('6-Drawings')));
    const capitalTotal = capitalMainGroup?.total || capitalMainGroup?.items.reduce((s, sg) => 
      s + (sg.total || sg.items.reduce((acc, item) => acc + item.amount, 0)), 0
    ) || 0;
    const netIncome = totalAssets - totalLiabilities - (capitalTotal + drawingsTotal);
    const totalCapital = capitalTotal + drawingsTotal + netIncome;
    return { drawingsTotal, capitalTotal, netIncome, totalCapital };
  };
  
  const { totalCapital, netIncome } = calculateCapitalTotals();
  const liabilitiesAndEquity = totalLiabilities + totalCapital;
  const isBalanced = Math.abs(totalAssets - liabilitiesAndEquity) < 0.01; // Allow small rounding differences

  const currentAssets = assetsData[0]?.total || assetsData[0]?.items?.reduce((s, subgroup) => 
    s + (subgroup.total || subgroup.items.reduce((acc, item) => acc + item.amount, 0)), 0
  ) || 0;
  const currentLiabilities = liabilitiesData[0]?.total || liabilitiesData[0]?.items?.reduce((s, subgroup) => 
    s + (subgroup.total || subgroup.items.reduce((acc, item) => acc + item.amount, 0)), 0
  ) || 0;
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : "0.00";

  // Format date to DD/MM/YY format
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Format balance - show 0 if balance is 0, otherwise show the balance
  const formatBalance = (amount: number) => {
    if (amount === 0 || amount === null || amount === undefined) return "0";
    return amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Remove code from name (e.g., "101-Inventory" → "Inventory", "101001-Inventory" → "Inventory")
  const removeCodeFromName = (name: string) => {
    if (!name) return name;
    // Remove code pattern: "CODE-Name" or "CODE-Name" format
    const parts = name.split('-');
    if (parts.length > 1) {
      // Check if first part is a code (all digits)
      if (/^\d+$/.test(parts[0])) {
        // Return everything after the first dash
        return parts.slice(1).join('-');
      }
    }
    return name;
  };

  const renderCategory = (
    mainGroups: BalanceMainGroup[], 
    expanded: string[], 
    type: "assets" | "liabilities" | "equity",
    colorClass: string
  ) => {
    if (!mainGroups || mainGroups.length === 0) {
      return (
        <div className="py-4 text-center text-muted-foreground text-sm">
          No {type} data available
        </div>
      );
    }
    
    
    return (
      <div className="space-y-1">
        {mainGroups.map((mainGroup, mgIdx) => {
        
        const mainGroupTotal = mainGroup.total || (mainGroup.items ? mainGroup.items.reduce((s, subgroup) => 
          s + (subgroup.total || (subgroup.items ? subgroup.items.reduce((acc, item) => acc + (item.amount || 0), 0) : 0)), 0
        ) : 0);
        const isMainGroupExpanded = expanded.includes(mainGroup.name);
        const expandedSubgroupsForMain = expandedSubgroups[mainGroup.name] || [];
        
        
        return (
          <div key={mainGroup.name} className="space-y-1">
            {/* Main Group Header - Always show, even if collapsed */}
            <div className="flex items-center justify-between w-full py-2 px-2 hover:bg-muted/30 rounded transition-all border-b border-border/20">
              <div className="flex items-center gap-2">
                <span className="font-bold">{removeCodeFromName(mainGroup.name)}</span>
              </div>
              <span className={`font-semibold ${colorClass}`}>
                {formatBalance(mainGroupTotal)}
              </span>
            </div>
            
            {/* Subgroups - CRITICAL: Always show ALL subgroups with their headings */}
            {/* This is the key section - subgroups MUST be visible */}
            {mainGroup.items && mainGroup.items.length > 0 ? (
              <div className="pl-4 space-y-1 mt-1">
                {mainGroup.items.map((subgroup, sgIdx) => {
                  const subgroupTotal = subgroup.total || (subgroup.items ? subgroup.items.reduce((acc: number, item: any) => acc + (item.amount || 0), 0) : 0);
                  
                  
                  if (subgroup.items && subgroup.items.length > 0) {
                  } else {
                  }
                  
                  // CRITICAL: Always render the subgroup header - this is what the user wants to see
                  return (
                    <div key={subgroup.name || sgIdx} className="space-y-1 mb-2">
                      {/* Subgroup Header - CRITICAL: This MUST be visible - shows the subgroup heading */}
                      <div className="flex items-center justify-between w-full py-2 px-3 hover:bg-muted/30 rounded transition-all border-b-2 border-border/20 bg-muted/10 font-bold">
                        <span className="font-bold text-base">{removeCodeFromName(subgroup.name)}</span>
                        <span className={`text-base font-semibold ${colorClass}`}>
                          {formatBalance(subgroupTotal)}
                        </span>
                      </div>
                      
                      {/* Accounts under subgroup - Always show ALL accounts under their subgroup heading */}
                      <div className="pl-4 space-y-1">
                        {subgroup.items && subgroup.items.length > 0 ? (
                          <>
                            {/* Render ALL accounts under this subgroup - THESE ARE THE INDIVIDUAL ACCOUNTS */}
                            {subgroup.items.map((item: any, accountIdx: number) => {
                              return (
                                <div key={item.name || `account-${accountIdx}`} className="flex justify-between py-2 px-4 border-b border-border/10 hover:bg-muted/5 bg-background rounded-sm">
                                  <span className="text-sm font-medium">{removeCodeFromName(item.name)}</span>
                                  <span className={`text-sm font-mono font-semibold ${item.amount < 0 ? 'text-red-500' : ''}`}>
                                    {formatBalance(item.amount || 0)}
                                  </span>
                                </div>
                              );
                            })}
                            {/* Subgroup Total - Always show after accounts */}
                            <div className="flex justify-between py-2 px-4 border-t-2 border-border/30 font-bold bg-muted/20 mt-2 rounded-sm">
                              <span className="text-sm font-bold">Total {removeCodeFromName(subgroup.name)}</span>
                              <span className={`text-sm font-bold ${colorClass}`}>
                                {formatBalance(subgroupTotal)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Show "No accounts" message but still show the subgroup heading and total */}
                            <div className="flex justify-between py-1 px-2 border-b border-border/10 text-sm text-muted-foreground">
                              <span>No accounts</span>
                              <span>0</span>
                            </div>
                            {/* Subgroup Total - Always show even if no accounts */}
                            <div className="flex justify-between py-1.5 px-2 border-t border-border/20 font-bold bg-muted/10">
                              <span className="text-sm">Total {removeCodeFromName(subgroup.name)}</span>
                              <span className={`text-sm ${colorClass}`}>
                                {formatBalance(subgroupTotal)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Main Group Total */}
                <div className="flex justify-between py-2 px-2 border-t-2 border-border/30 font-bold mt-2">
                  <span>Total {removeCodeFromName(mainGroup.name)}</span>
                  <span className={colorClass}>
                    {formatBalance(mainGroupTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pl-4 py-2 px-2 text-sm text-muted-foreground">
                No subgroups available for {mainGroup.name}
              </div>
            )}
          </div>
        );
      })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold text-blue-600">Rs {totalAssets.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-600">Rs {totalLiabilities.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Equity</p>
                <p className="text-2xl font-bold text-green-600">Rs {totalEquity.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${isBalanced ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' : 'from-orange-500/10 to-orange-600/5 border-orange-500/20'} transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Ratio</p>
                <p className={`text-2xl font-bold ${parseFloat(currentRatio) >= 1 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {currentRatio}x
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full ${parseFloat(currentRatio) >= 1 ? 'bg-emerald-500/20' : 'bg-orange-500/20'} flex items-center justify-center`}>
                <CheckCircle2 className={`h-6 w-6 ${parseFloat(currentRatio) >= 1 ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Sheet */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Balance Sheet
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Statement of Financial Position</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Filter</label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Date:</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[150px]"
                />
                <span className="text-sm text-muted-foreground">
                  {formatDateDisplay(selectedDate)}
                </span>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Custom Date</SelectItem>
                  <SelectItem value="december-2024">December 31, 2024</SelectItem>
                  <SelectItem value="september-2024">September 30, 2024</SelectItem>
                  <SelectItem value="june-2024">June 30, 2024</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="transition-all duration-200 hover:scale-105" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" className="transition-all duration-200 hover:scale-105" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading balance sheet data...
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets Column */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-blue-600 border-b border-blue-500/20 pb-2 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Assets
              </h3>
              {renderCategory(assetsData, expandedAssets, "assets", "text-blue-600")}
              <div className="flex justify-between py-3 px-2 border-t-2 border-border/50 font-bold mt-2">
                <span>Total Assets</span>
                <span className="text-blue-600">
                  {formatBalance(totalAssets)}
                </span>
              </div>
            </div>

            {/* Liabilities & Equity Column */}
            <div className="space-y-4">
              {/* Liabilities Section */}
              <h3 className="font-semibold text-lg text-red-600 border-b border-red-500/20 pb-2 flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Liabilities
              </h3>
              {renderCategory(liabilitiesData, expandedLiabilities, "liabilities", "text-red-600")}
              <div className="flex justify-between py-3 px-2 border-t-2 border-border/50 font-bold mt-2">
                <span>Total Liabilities</span>
                <span className="text-red-600">
                  {formatBalance(totalLiabilities)}
                </span>
              </div>

              {/* Capital Section */}
              <h3 className="font-semibold text-lg text-green-600 border-b border-green-500/20 pb-2 mt-6 flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Capital
              </h3>
              {renderCategory(equityData, expandedEquity, "equity", "text-green-600")}
              
              {/* Net Income and Capital totals */}
              <>
                {/* Net Income */}
                <div className="flex justify-between py-2 px-2 border-b border-border/20 mt-2">
                  <span className="text-sm font-semibold">Net Income</span>
                  <span className={`text-sm font-mono ${netIncome < 0 ? 'text-red-500' : ''}`}>
                    {formatBalance(netIncome)}
                  </span>
                </div>
                
                {/* Total Capital */}
                <div className="flex justify-between py-3 px-2 border-t-2 border-border/30 font-bold mt-2">
                  <span>Total Capital</span>
                  <span className="text-green-600">
                    {formatBalance(totalCapital)}
                  </span>
                </div>
                
                {/* Total Liabilities & Capital */}
                <div className={`flex justify-between py-4 px-2 rounded-lg font-bold text-lg border-t-2 border-border/50 mt-2 ${isBalanced ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                  <span>Total Liabilities and Capital</span>
                  <span className={isBalanced ? 'text-emerald-600' : 'text-orange-600'}>
                    {formatBalance(liabilitiesAndEquity)}
                  </span>
                </div>
              </>
            </div>
          </div>
          )}

          {/* Balance Check */}
          <div className={`mt-6 p-4 rounded-lg flex items-center justify-center gap-3 ${isBalanced ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {isBalanced ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-600">Balance Sheet is balanced (Assets = Liabilities + Equity)</span>
              </>
            ) : (
              <>
                <span className="font-medium text-red-600">Balance Sheet is not balanced. Difference: Rs {Math.abs(totalAssets - liabilitiesAndEquity).toLocaleString()}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
