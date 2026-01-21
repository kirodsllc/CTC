import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Scale, Calendar, Printer, FileText, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { getCurrentDatePakistan } from "@/utils/dateUtils";

interface AccountBalance {
  code: string;
  name: string;
  balance: number;
  isSubgroup?: boolean;
  isTotal?: boolean;
  level?: number;
}

export const BalanceSheetReport = () => {
  // Default to current date in Pakistan timezone
  const [asOfDate, setAsOfDate] = useState(() => getCurrentDatePakistan());
  const [assetsData, setAssetsData] = useState<AccountBalance[]>([]);
  const [liabilitiesData, setLiabilitiesData] = useState<AccountBalance[]>([]);
  const [ownerEquity, setOwnerEquity] = useState(0);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getBalanceSheet({
        as_of_date: asOfDate
      });

      if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive"
        });
        return;
      }

      if (response.data) {
        setAssetsData(response.data.assets || []);
        setLiabilitiesData(response.data.liabilities || []);
        setOwnerEquity(response.data.ownerEquity || 0);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch balance sheet",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const handleDateChange = (date: string) => {
    setAsOfDate(date);
    fetchBalanceSheet();
  };

  const formatNumber = (num: number) => {
    if (num < 0) {
      return `(${Math.abs(num).toLocaleString('en-PK')})`;
    }
    return num.toLocaleString('en-PK');
  };

  const totalAssets = assetsData.filter(a => !a.isSubgroup && !a.isTotal).reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilitiesData.filter(a => !a.isSubgroup && !a.isTotal).reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to print the report",
        variant: "destructive"
      });
      return;
    }

    const styles = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .section { border: 1px solid #ddd; }
        .section-header { background: #f5f5f5; padding: 10px; font-weight: bold; font-size: 16px; border-bottom: 1px solid #ddd; }
        .row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; }
        .row.bold { font-weight: bold; }
        .row.total { border-top: 2px solid #333; font-weight: bold; }
        .indent-1 { padding-left: 24px !important; }
        .indent-2 { padding-left: 48px !important; }
        .indent-3 { padding-left: 72px !important; }
        .negative { color: #dc2626; }
        .primary { color: #2563eb; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Balance Sheet - ${asOfDate}</title>
          ${styles}
        </head>
        <body>
          <div class="header">
            <h1>Balance Sheet</h1>
            <p>As of ${new Date(asOfDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="grid">
            <div class="section">
              <div class="section-header">Assets</div>
              ${assetsData.map(item => `
                <div class="row ${item.isTotal ? 'bold' : ''} ${item.isTotal && item.level === 0 ? 'total' : ''} indent-${(item.level || 0) + 1}">
                  <span class="${item.isTotal ? 'primary' : ''}">${item.code && !item.isTotal ? item.code + '-' : ''}${item.name}</span>
                  ${(!item.isSubgroup || item.isTotal) ? `<span class="${item.balance < 0 ? 'negative' : ''}">${formatNumber(item.balance)}</span>` : ''}
                </div>
              `).join('')}
              <div class="row total indent-1">
                <span>Total Assets</span>
                <span>${formatNumber(totalAssets)}</span>
              </div>
            </div>
            <div class="section">
              <div class="section-header">Liabilities</div>
              ${liabilitiesData.map(item => `
                <div class="row ${item.isTotal ? 'bold' : ''} ${item.isTotal && item.level === 0 ? 'total' : ''} indent-${(item.level || 0) + 1}">
                  <span class="${item.isTotal ? 'primary' : ''}">${item.code && !item.isTotal ? item.code + '-' : ''}${item.name}</span>
                  ${(!item.isSubgroup || item.isTotal) ? `<span class="${item.balance < 0 ? 'negative' : ''}">${formatNumber(item.balance)}</span>` : ''}
                </div>
              `).join('')}
              <div class="row total indent-1">
                <span>Total Liabilities</span>
                <span>${formatNumber(totalLiabilities)}</span>
              </div>
              <div class="section-header">Capital</div>
              <div class="row bold indent-2"><span>501-Owner Equity</span><span></span></div>
              <div class="row indent-3"><span>501003-OWNER CAPITAL</span><span>${formatNumber(360000)}</span></div>
              <div class="row bold indent-2"><span class="primary">Total 501-Owner Equity</span><span class="primary">${formatNumber(360000)}</span></div>
              <div class="row indent-2"><span>Retained Earnings</span><span class="${ownerEquity - 360000 < 0 ? 'negative' : ''}">${formatNumber(ownerEquity - 360000)}</span></div>
              <div class="row bold indent-1"><span>Total Capital</span><span class="${ownerEquity < 0 ? 'negative' : ''}">${formatNumber(ownerEquity)}</span></div>
              <div class="row total indent-1">
                <span>Total Liabilities + Capital</span>
                <span>${formatNumber(totalLiabilities + ownerEquity)}</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportPDF = () => {
    toast({
      title: "Export Started",
      description: "PDF is being generated. Use Print and select 'Save as PDF'."
    });
    handlePrint();
  };

  const handleExportCSV = () => {
    const headers = ["Code", "Name", "Balance"];
    const csvContent = [
      headers.join(","),
      ...assetsData.map(item => [item.code || '', item.name, item.balance].join(",")),
      `Total Assets,,${totalAssets}`,
      '',
      ...liabilitiesData.map(item => [item.code || '', item.name, item.balance].join(",")),
      `Total Liabilities,,${totalLiabilities}`,
      `Owner Equity,,${ownerEquity}`,
      `Total Liabilities + Equity,,${totalLiabilities + ownerEquity}`
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `balance_sheet_${asOfDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: "Balance Sheet exported to CSV successfully."
    });
  };

  const getIndent = (level: number = 0) => {
    return { paddingLeft: `${(level + 1) * 24}px` };
  };

  const renderAccountRow = (item: AccountBalance, index: number) => {
    const isMainGroup = item.isSubgroup && item.level === 0;
    const isSubGroup = item.isSubgroup && item.level === 1;
    const isAccount = !item.isSubgroup && !item.isTotal;
    const isGroupTotal = item.isTotal && item.level === 0;
    const isSubTotal = item.isTotal && item.level === 1;

    return (
      <div
        key={index}
        className={`
          flex justify-between items-center border-b border-border/40
          ${isMainGroup ? 'py-3 font-bold' : 'py-2'}
          ${isSubGroup ? 'font-semibold' : ''}
          ${isSubTotal || isGroupTotal ? 'font-semibold' : ''}
          ${isGroupTotal ? 'border-b-2 border-foreground/30' : ''}
        `}
        style={getIndent(item.level || 0)}
      >
        <span className={`
          ${isSubTotal || isGroupTotal ? 'text-primary' : 'text-foreground'}
        `}>
          {item.code && !item.isTotal ? `${item.code}-` : ''}{item.name}
        </span>

        {(isAccount || isSubTotal || isGroupTotal) && (
          <div className="flex items-center">
            {(isSubTotal || isGroupTotal) && (
              <span className={`
                font-mono text-sm min-w-[100px] text-right mr-6
                ${item.balance < 0 ? 'text-destructive' : 'text-primary'}
              `}>
                {formatNumber(item.balance)}
              </span>
            )}
            <span className={`
              font-mono text-sm min-w-[100px] text-right
              ${item.balance < 0 ? 'text-destructive' : ''}
              ${isSubTotal || isGroupTotal ? 'text-primary font-semibold' : ''}
            `}>
              {formatNumber(item.balance)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-sm border bg-card">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-primary" />
            Balance Sheet
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Filter Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Filter
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {/* Balance Sheet Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Assets Column */}
          <div className="border rounded-md">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="font-bold text-lg">Assets</h3>
            </div>
            <div className="px-2">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : assetsData.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data found</div>
              ) : (
                assetsData.map((item, index) => renderAccountRow(item, index))
              )}
              
              {/* Total Assets */}
              <div className="flex justify-between items-center py-3 border-t-2 border-foreground/50 font-bold" style={{ paddingLeft: '24px' }}>
                <span>Total Assets</span>
                <span className="font-mono text-base">{formatNumber(totalAssets)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities & Equity Column */}
          <div className="border rounded-md">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="font-bold text-lg">Liabilities</h3>
            </div>
            <div className="px-2">
              {liabilitiesData.length > 0 && liabilitiesData.map((item, index) => renderAccountRow(item, index))}
              
              {/* Total Liabilities */}
              <div className="flex justify-between items-center py-3 border-t-2 border-foreground/50 font-bold" style={{ paddingLeft: '24px' }}>
                <span>Total Liabilities</span>
                <span className="font-mono">{formatNumber(totalLiabilities)}</span>
              </div>

              {/* Capital Section */}
              <div className="px-4 py-3 border-t bg-muted/30 -mx-2">
                <h3 className="font-bold text-lg">Capital</h3>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/40 font-semibold" style={{ paddingLeft: '48px' }}>
                <span>501-Owner Equity</span>
                <span></span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40" style={{ paddingLeft: '72px' }}>
                <span>501003-OWNER CAPITAL</span>
                <span className="font-mono text-sm">{formatNumber(ownerEquity)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40 font-semibold" style={{ paddingLeft: '48px' }}>
                <span className="text-primary">Total 501-Owner Equity</span>
                <div className="flex">
                  <span className="font-mono text-sm text-primary min-w-[100px] text-right mr-6">{formatNumber(ownerEquity)}</span>
                  <span className="font-mono text-sm text-primary min-w-[100px] text-right">{formatNumber(ownerEquity)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40" style={{ paddingLeft: '48px' }}>
                <span className="font-semibold">Retained Earnings</span>
                <span className={`font-mono text-sm ${(totalAssets - totalLiabilities - ownerEquity) < 0 ? 'text-destructive' : ''}`}>
                  {formatNumber(totalAssets - totalLiabilities - ownerEquity)}
                </span>
              </div>

              {/* Total Capital */}
              <div className="flex justify-between items-center py-3 border-t border-foreground/30 font-bold" style={{ paddingLeft: '24px' }}>
                <span>Total Capital</span>
                <span className={`font-mono ${(totalAssets - totalLiabilities) < 0 ? 'text-destructive' : ''}`}>
                  {formatNumber(totalAssets - totalLiabilities)}
                </span>
              </div>

              {/* Total Liabilities + Capital */}
              <div className="flex justify-between items-center py-3 border-t-2 border-foreground/50 font-bold" style={{ paddingLeft: '24px' }}>
                <span>Total Liabilities + Capital</span>
                <span className="font-mono text-base">{formatNumber(totalLiabilities + ownerEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
