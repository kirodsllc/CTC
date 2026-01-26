import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getCurrentDatePakistan } from "@/utils/dateUtils";

const API_URL_RAW = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '');
const API_URL = API_URL_RAW.replace(/\/api\/?$/, '');

interface Account {
  name: string;
  amount: number;
}

interface SubGroup {
  name: string;
  items: Account[];
  total: number;
}

interface MainGroup {
  name: string;
  items: SubGroup[];
  total: number;
}

interface BalanceSheetData {
  assets: MainGroup[];
  liabilities: MainGroup[];
  equity: MainGroup[];
  netIncome: number;
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalCapital: number;
    totalLiabilitiesAndCapital: number;
  };
}

export const BalanceSheetTab = () => {
  const [selectedDate, setSelectedDate] = useState(() => getCurrentDatePakistan());
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalanceSheet();
  }, [selectedDate]);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/accounting/balance-sheet?as_of_date=${selectedDate}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
      }
    } catch (error) {
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

  const renderMainGroup = (mainGroup: MainGroup) => {
    return (
      <div key={mainGroup.name} className="space-y-1">
        {/* Main Group Header */}
        <div className="flex justify-between items-center py-2 px-2">
          <span className="font-semibold">{mainGroup.name}</span>
          <span className="font-semibold text-right">{formatNumber(mainGroup.total || 0)}</span>
        </div>

        {/* Subgroups */}
        {mainGroup.items && mainGroup.items.map((subgroup) => (
          <div key={subgroup.name} className="pl-4 space-y-1">
            {/* Subgroup Header */}
            <div className="flex justify-between items-center py-1.5 px-2">
              <span className="font-medium">{subgroup.name}</span>
              <span className="text-right">{formatNumber(subgroup.total || 0)}</span>
            </div>

            {/* Accounts under subgroup */}
            {subgroup.items && subgroup.items.length > 0 && (
              <div className="pl-4 space-y-0.5">
                {subgroup.items.map((account, idx) => (
                  <div key={`${account.name}-${idx}`} className="flex justify-between items-center py-1 px-3">
                    <span className="text-sm">{account.name}</span>
                    <span className="text-sm text-right font-mono">{formatNumber(account.amount || 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subgroup Total */}
            <div className="flex justify-between items-center py-1.5 px-2 border-t border-border/30">
              <span className="font-medium">Total {subgroup.name}</span>
              <span className="font-medium text-right">{formatNumber(subgroup.total || 0)}</span>
            </div>
          </div>
        ))}

        {/* Main Group Total */}
        <div className="flex justify-between items-center py-2 px-2 border-t-2 border-border/50 font-semibold mt-1">
          <span>Total {mainGroup.name}</span>
          <span className="text-right">{formatNumber(mainGroup.total || 0)}</span>
        </div>
      </div>
    );
  };

  const totalAssets = data?.totals?.totalAssets || 0;
  const totalLiabilities = data?.totals?.totalLiabilities || 0;
  const totalEquity = data?.totals?.totalEquity || 0;
  const netIncome = data?.netIncome || 0;
  const totalCapital = data?.totals?.totalCapital || (totalEquity + netIncome);
  const totalLiabilitiesAndCapital = data?.totals?.totalLiabilitiesAndCapital || (totalLiabilities + totalCapital);
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndCapital) < 0.01;

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

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading balance sheet data...
        </div>
      ) : !data ? (
        <div className="py-8 text-center text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Assets */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <h2 className="text-lg font-bold mb-4 pb-2 border-b border-border">Assets</h2>
              <div className="space-y-2">
                {data.assets && data.assets.map((mainGroup) => renderMainGroup(mainGroup))}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between items-center py-2 font-bold">
                <span>Total Assets</span>
                <span className="text-right">{formatNumber(totalAssets)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Liabilities + Capital */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              {/* Liabilities Section */}
              <h2 className="text-lg font-bold mb-4 pb-2 border-b border-border">Liabilities</h2>
              <div className="space-y-2">
                {data.liabilities && data.liabilities.map((mainGroup) => renderMainGroup(mainGroup))}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between items-center py-2 font-bold">
                <span>Total Liabilities</span>
                <span className="text-right">{formatNumber(totalLiabilities)}</span>
              </div>

              {/* Capital Section */}
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-4 pb-2 border-b border-border">Capital</h2>
                <div className="space-y-2">
                  {data.equity && data.equity.map((mainGroup) => {
                    // Handle 6-Drawings separately if it exists
                    if (mainGroup.name.includes('6-Drawings') || mainGroup.name.includes('Drawings')) {
                      return (
                        <div key={mainGroup.name} className="space-y-1">
                          <div className="flex justify-between items-center py-2 px-2">
                            <span className="font-semibold">{mainGroup.name}</span>
                            <span className="font-semibold text-right">{formatNumber(mainGroup.total || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-2 border-t border-border/30">
                            <span className="font-medium">Total {mainGroup.name}</span>
                            <span className="font-medium text-right">{formatNumber(mainGroup.total || 0)}</span>
                          </div>
                        </div>
                      );
                    }
                    return renderMainGroup(mainGroup);
                  })}
                </div>
                
                {/* Net Income */}
                <div className="flex justify-between items-center py-2 px-2 mt-2">
                  <span className="font-medium">Net Income</span>
                  <span className="text-right font-mono">{formatNumber(netIncome)}</span>
                </div>

                <Separator className="my-3" />
                
                {/* Total Capital */}
                <div className="flex justify-between items-center py-2 font-bold">
                  <span>Total Capital</span>
                  <span className="text-right">{formatNumber(totalCapital)}</span>
                </div>
              </div>

              <Separator className="my-3" />
              
              {/* Total Liabilities and Capital */}
              <div className={`flex justify-between items-center py-3 font-bold text-lg ${isBalanced ? 'text-green-600' : 'text-orange-600'}`}>
                <span>Total Liabilities and Capital</span>
                <span className="text-right">{formatNumber(totalLiabilitiesAndCapital)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Check */}
      {data && (
        <div className={`p-4 rounded-lg flex items-center justify-center gap-3 ${isBalanced ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          {isBalanced ? (
            <span className="font-medium text-green-600">Balance Sheet is balanced (Assets = Liabilities + Capital)</span>
          ) : (
            <span className="font-medium text-red-600">
              Balance Sheet is not balanced. Difference: {formatNumber(Math.abs(totalAssets - totalLiabilitiesAndCapital))}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
