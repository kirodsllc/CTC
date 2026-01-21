import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentDatePakistan } from "@/utils/dateUtils";

const API_URL_RAW = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '');
const API_URL = API_URL_RAW.replace(/\/api\/?$/, '');

interface TrialBalanceAccount {
  accountId: string;
  label: string;
  debit: number;
  credit: number;
}

interface TrialBalanceSubGroup {
  subGroupCode: string;
  subGroupName: string;
  subGroupLabel: string;
  accounts: TrialBalanceAccount[];
  subTotalDebit: number;
  subTotalCredit: number;
}

interface TrialBalanceData {
  date: string;
  rows: TrialBalanceSubGroup[];
  totalDebit: number;
  totalCredit: number;
}

export const TrialBalanceTab = () => {
  const [selectedDate, setSelectedDate] = useState(() => getCurrentDatePakistan());
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrialBalance();
  }, [selectedDate]);

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      // Use the existing accounting endpoint with to_date set to selected date
      const response = await fetch(`${API_URL}/api/accounting/trial-balance?to_date=${selectedDate}`);
      if (response.ok) {
        const flatData = await response.json();
        
        // Transform flat data to grouped structure
        // The data comes in order: mainGroup, subgroup, accounts, subgroup, accounts, etc.
        const subgroupMap = new Map<string, TrialBalanceSubGroup>();
        let currentSubgroup: TrialBalanceSubGroup | null = null;
        let totalDebit = 0;
        let totalCredit = 0;
        
        flatData.forEach((item: any) => {
          if (item.type === 'subgroup') {
            // Create or get subgroup
            if (!subgroupMap.has(item.name)) {
              const parts = item.name.split('-');
              const code = parts[0];
              const name = parts.slice(1).join('-');
              currentSubgroup = {
                subGroupCode: code,
                subGroupName: name,
                subGroupLabel: item.name,
                accounts: [],
                subTotalDebit: 0,
                subTotalCredit: 0,
              };
              subgroupMap.set(item.name, currentSubgroup);
            } else {
              currentSubgroup = subgroupMap.get(item.name)!;
            }
          } else if (item.type === 'account' && currentSubgroup) {
            // Add account to current subgroup
            currentSubgroup.accounts.push({
              accountId: item.accountCode || '',
              label: item.accountName,
              debit: item.debit || 0,
              credit: item.credit || 0,
            });
            currentSubgroup.subTotalDebit += item.debit || 0;
            currentSubgroup.subTotalCredit += item.credit || 0;
            totalDebit += item.debit || 0;
            totalCredit += item.credit || 0;
          }
        });
        
        // Convert map to array and sort by subgroup code
        const rows = Array.from(subgroupMap.values()).sort((a, b) => {
          return a.subGroupCode.localeCompare(b.subGroupCode);
        });
        
        // Sort accounts within each subgroup by account code
        rows.forEach(row => {
          row.accounts.sort((a, b) => {
            const codeA = a.label.split('-')[0];
            const codeB = b.label.split('-')[0];
            return codeA.localeCompare(codeB);
          });
        });
        
        setData({
          date: selectedDate,
          rows,
          totalDebit,
          totalCredit,
        });
      } else {
        const errorText = await response.text();
        console.error("Failed to fetch trial balance:", response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error("Error fetching trial balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num === 0) return "0";
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Filter</Label>
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Date:</Label>
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
      </div>

      {/* Trial Balance Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold underline">Account</TableHead>
                  <TableHead className="font-semibold underline text-right">Dr</TableHead>
                  <TableHead className="font-semibold underline text-right">Cr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Loading trial balance data...
                    </TableCell>
                  </TableRow>
                ) : !data || data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {data.rows.map((subgroup, sgIdx) => (
                      <React.Fragment key={subgroup.subGroupLabel}>
                        {/* Subgroup Header Row */}
                        <TableRow className="bg-muted/20 font-medium">
                          <TableCell className="font-semibold">
                            {subgroup.subGroupLabel}
                          </TableCell>
                          <TableCell className="text-right"></TableCell>
                          <TableCell className="text-right"></TableCell>
                        </TableRow>
                        
                        {/* Account Rows under Subgroup */}
                        {subgroup.accounts.map((account, accIdx) => (
                          <TableRow key={`${account.accountId}-${accIdx}`} className="hover:bg-muted/30">
                            <TableCell className="pl-8 text-sm">
                              {account.label}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatNumber(account.debit)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatNumber(account.credit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                    
                    {/* Total Row */}
                    <TableRow className="bg-muted/40 font-bold border-t-2 border-border">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatNumber(data.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatNumber(data.totalCredit)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Balance Check */}
      {data && (
        <div className={`p-4 rounded-lg flex items-center justify-center gap-3 ${data.totalDebit === data.totalCredit ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          {data.totalDebit === data.totalCredit ? (
            <span className="font-medium text-green-600">
              ✓ Trial Balance is balanced - Debits equal Credits
            </span>
          ) : (
            <span className="font-medium text-red-600">
              ⚠ Trial Balance is not balanced - Difference: {formatNumber(Math.abs(data.totalDebit - data.totalCredit))}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
