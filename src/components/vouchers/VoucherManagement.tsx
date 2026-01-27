import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CreditCard, Receipt, FileText, ArrowRightLeft, List, Plus } from "lucide-react";
import { PaymentVoucherForm } from "./PaymentVoucherForm";
import { ReceiptVoucherForm } from "./ReceiptVoucherForm";
import { JournalVoucherForm } from "./JournalVoucherForm";
import { ContraVoucherForm } from "./ContraVoucherForm";
import { ViewVouchersTab } from "./ViewVouchersTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: "receipt" | "payment" | "journal" | "contra";
  date: string;
  narration: string;
  cashBankAccount: string;
  chequeNumber?: string;
  chequeDate?: string;
  entries: VoucherEntry[];
  totalDebit: number;
  totalCredit: number;
  status: "draft" | "posted" | "cancelled";
  createdAt: string;
}

export interface VoucherEntry {
  id: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
}

type MainTab = "new" | "view";
type VoucherTab = "payment" | "receipt" | "journal" | "contra";

const mainTabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
  { id: "new", label: "New Voucher", icon: Plus },
  { id: "view", label: "View Vouchers", icon: List },
];

const voucherTabs: { id: VoucherTab; label: string; icon: React.ElementType }[] = [
  { id: "payment", label: "Payment Voucher", icon: CreditCard },
  { id: "receipt", label: "Receipt Voucher", icon: Receipt },
  { id: "journal", label: "Journal Voucher", icon: FileText },
  { id: "contra", label: "Contra Voucher", icon: ArrowRightLeft },
];

// Sample accounts
const initialAccounts = [
  { value: "cash-in-hand", label: "Cash in Hand" },
  { value: "cash-at-bank-hbl", label: "Cash at Bank - HBL" },
  { value: "cash-at-bank-mcb", label: "Cash at Bank - MCB" },
  { value: "cash-at-bank-ubl", label: "Cash at Bank - UBL" },
  { value: "petty-cash", label: "Petty Cash" },
  { value: "sales-revenue", label: "Sales Revenue" },
  { value: "purchase-account", label: "Purchase Account" },
  { value: "accounts-receivable", label: "Accounts Receivable" },
  { value: "accounts-payable", label: "Accounts Payable" },
  { value: "salary-expense", label: "Salary Expense" },
  { value: "rent-expense", label: "Rent Expense" },
  { value: "utility-expense", label: "Utility Expense" },
  { value: "office-supplies", label: "Office Supplies" },
  { value: "furniture-fixtures", label: "Furniture & Fixtures" },
  { value: "equipment", label: "Equipment" },
  { value: "capital-account", label: "Capital Account" },
  { value: "drawings", label: "Drawings" },
  { value: "interest-income", label: "Interest Income" },
  { value: "interest-expense", label: "Interest Expense" },
];

export const VoucherManagement = () => {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("view");
  const [activeTab, setActiveTab] = useState<VoucherTab>("payment");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic data states
  const [mainGroups, setMainGroups] = useState<{ id: string, name: string, code: string }[]>([]);
  const [subgroups, setSubgroups] = useState<{ id: string, name: string, code: string, mainGroupId: string }[]>([]);
  const [accountsList, setAccountsList] = useState<{ value: string, label: string }[]>([]);

  // Dialog states
  const [showSubgroupDialog, setShowSubgroupDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [newSubgroupCode, setNewSubgroupCode] = useState("");
  const [selectedMainGroup, setSelectedMainGroup] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCode, setNewAccountCode] = useState("");
  const [selectedSubgroup, setSelectedSubgroup] = useState("");

  const [voucherCounters, setVoucherCounters] = useState({
    receipt: 1019,
    payment: 2881,
    journal: 4633,
    contra: 100,
  });

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [vouchersRes, accountsRes, subgroupsRes, mainGroupsRes] = await Promise.all([
          apiClient.getVouchers({ limit: 1000 }),
          apiClient.getAccounts(),
          apiClient.getSubgroups(),
          apiClient.getMainGroups()
        ]);

        if (vouchersRes.data) {
          setVouchers(vouchersRes.data as any);
          // Update counters logic...
        }

        if (mainGroupsRes.data) {
          setMainGroups(mainGroupsRes.data as any);
        }

        if (subgroupsRes.data) {
          setSubgroups(subgroupsRes.data as any);
        }

        if (accountsRes.data) {
          const formattedAccounts = (accountsRes.data as any).map((acc: any) => ({
            value: acc.id,
            label: `${acc.code} - ${acc.name}`
          }));
          setAccountsList(formattedAccounts);
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [toast]);

  const handleAddSubgroup = () => {
    setShowSubgroupDialog(true);
  };

  const handleAddAccount = () => {
    setShowAccountDialog(true);
  };

  const handleSaveSubgroup = async () => {
    if (!selectedMainGroup) {
      toast({ title: "Error", description: "Please select a Main Group", variant: "destructive" });
      return;
    }
    if (!newSubgroupName.trim()) {
      toast({ title: "Error", description: "Please enter Subgroup Name", variant: "destructive" });
      return;
    }

    try {
      // Find main group code to help generate/validate code?
      // For now just create
      const res = await apiClient.createSubgroup({
        mainGroupId: selectedMainGroup,
        name: newSubgroupName,
        code: newSubgroupCode || String(Math.floor(Math.random() * 1000)), // Temp code generation if empty
        isActive: true
      });

      if (res.data) {
        setSubgroups([...subgroups, res.data as any]);
        toast({ title: "Success", description: "Subgroup created successfully" });
        setNewSubgroupName("");
        setNewSubgroupCode("");
        setSelectedMainGroup("");
        setShowSubgroupDialog(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to create subgroup", variant: "destructive" });
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedSubgroup) {
      toast({ title: "Error", description: "Please select a Subgroup", variant: "destructive" });
      return;
    }
    if (!newAccountName.trim()) {
      toast({ title: "Error", description: "Please enter Account Name", variant: "destructive" });
      return;
    }

    try {
      const res = await apiClient.createAccount({
        subgroupId: selectedSubgroup,
        name: newAccountName,
        code: newAccountCode || String(Math.floor(Math.random() * 100000)),
        openingBalance: 0,
        status: "active"
      });

      if (res.data) {
        const newAcc = res.data as any;
        setAccountsList([...accountsList, {
          value: newAcc.id,
          label: `${newAcc.code} - ${newAcc.name}`
        }]);
        toast({ title: "Success", description: "Account created successfully" });
        setNewAccountName("");
        setNewAccountCode("");
        setSelectedSubgroup("");
        setShowAccountDialog(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to create account", variant: "destructive" });
    }
  };

  // Helper function to convert date string to ISO format
  const convertDateToISO = (dateString: string): string => {
    if (!dateString) return new Date().toISOString().split('T')[0];

    // If already in ISO format (YYYY-MM-DD), return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // If in DD/MM/YYYY format, convert it
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split('/');
      return `${year}-${month}-${day}`;
    }

    // Try to parse as date
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // If parsing fails, return current date
    }

    return new Date().toISOString().split('T')[0];
  };

  const handleSaveVoucher = async (data: any) => {
    const typePrefix = {
      receipt: "RV",
      payment: "PV",
      journal: "JV",
      contra: "CV",
    };

    let newVoucher: Voucher;
    const voucherNumber = `${typePrefix[data.type as VoucherTab]}${String(voucherCounters[data.type as VoucherTab] + 1).padStart(4, '0')}`;
    const voucherDate = convertDateToISO(data.date);

    if (data.type === "payment") {
      // Convert Payment Voucher data
      const entries: VoucherEntry[] = data.entries.map((entry: any) => ({
        id: entry.id,
        account: entry.accountDr,
        description: entry.description || "",
        debit: entry.drAmount || 0,
        credit: 0,
      }));
      // Add the Cr account entry
      entries.push({
        id: `cr-${Date.now()}`,
        account: data.crAccount,
        description: `Payment to ${data.paidTo}`,
        debit: 0,
        credit: data.totalAmount || 0,
      });

      newVoucher = {
        id: Date.now().toString(),
        voucherNumber,
        type: "payment",
        date: voucherDate,
        narration: data.paidTo || "",
        cashBankAccount: data.crAccount,
        entries,
        totalDebit: data.totalAmount || 0,
        totalCredit: data.totalAmount || 0,
        status: "posted",
        createdAt: new Date().toISOString(),
      };
    } else if (data.type === "receipt") {
      // Convert Receipt Voucher data
      const entries: VoucherEntry[] = data.entries.map((entry: any) => ({
        id: entry.id,
        account: entry.accountCr,
        description: entry.description || "",
        debit: 0,
        credit: entry.crAmount || 0,
      }));
      // Add the Dr account entry
      entries.unshift({
        id: `dr-${Date.now()}`,
        account: data.drAccount,
        description: `Receipt from ${data.receivedFrom}`,
        debit: data.totalAmount || 0,
        credit: 0,
      });

      newVoucher = {
        id: Date.now().toString(),
        voucherNumber,
        type: "receipt",
        date: voucherDate,
        narration: data.receivedFrom || "",
        cashBankAccount: data.drAccount,
        entries,
        totalDebit: data.totalAmount || 0,
        totalCredit: data.totalAmount || 0,
        status: "posted",
        createdAt: new Date().toISOString(),
      };
    } else if (data.type === "journal") {
      // Convert Journal Voucher data
      const drEntries: VoucherEntry[] = data.drEntries.map((entry: any) => ({
        id: entry.id,
        account: entry.account,
        description: entry.description || "",
        debit: entry.drAmount || 0,
        credit: 0,
      }));
      const crEntries: VoucherEntry[] = data.crEntries.map((entry: any) => ({
        id: entry.id,
        account: entry.account,
        description: entry.description || "",
        debit: 0,
        credit: entry.crAmount || 0,
      }));

      newVoucher = {
        id: Date.now().toString(),
        voucherNumber,
        type: "journal",
        date: voucherDate,
        narration: data.name || "",
        cashBankAccount: "",
        entries: [...drEntries, ...crEntries],
        totalDebit: data.totalDr || 0,
        totalCredit: data.totalCr || 0,
        status: "posted",
        createdAt: new Date().toISOString(),
      };
    } else if (data.type === "contra") {
      // Convert Contra Voucher data
      const drEntries: VoucherEntry[] = data.drEntries.map((entry: any) => ({
        id: entry.id,
        account: entry.account,
        description: entry.description || "",
        debit: entry.drAmount || 0,
        credit: 0,
      }));
      const crEntries: VoucherEntry[] = data.crEntries.map((entry: any) => ({
        id: entry.id,
        account: entry.account,
        description: entry.description || "",
        debit: 0,
        credit: entry.crAmount || 0,
      }));

      newVoucher = {
        id: Date.now().toString(),
        voucherNumber,
        type: "contra",
        date: voucherDate,
        narration: data.name || "",
        cashBankAccount: "",
        entries: [...drEntries, ...crEntries],
        totalDebit: data.totalDr || 0,
        totalCredit: data.totalCr || 0,
        status: "posted",
        createdAt: new Date().toISOString(),
      };
    } else {
      // Fallback for any other type
      newVoucher = {
        id: Date.now().toString(),
        voucherNumber,
        type: data.type,
        date: voucherDate,
        narration: data.narration || data.name || data.paidTo || data.receivedFrom || "",
        cashBankAccount: data.cashBankAccount || data.crAccount || data.drAccount || "",
        entries: data.entries || [],
        totalDebit: data.totalDebit || data.totalAmount || data.totalDr || 0,
        totalCredit: data.totalCredit || data.totalAmount || data.totalCr || 0,
        status: "posted",
        createdAt: new Date().toISOString(),
      };
    }

    // Prepare entries for API
    const apiEntries = newVoucher.entries.map((entry, index) => ({
      account: entry.account,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      sortOrder: index,
    }));

    try {
      // Create voucher via API
      const response = await apiClient.createVoucher({
        voucherNumber: newVoucher.voucherNumber,
        type: newVoucher.type,
        date: newVoucher.date,
        narration: newVoucher.narration,
        cashBankAccount: newVoucher.cashBankAccount,
        entries: apiEntries,
        status: newVoucher.status,
        createdBy: 'User',
      }) as any;

      if (response.data) {
        // Add the created voucher to the list
        setVouchers([response.data, ...vouchers]);
        setVoucherCounters(prev => ({
          ...prev,
          [data.type]: prev[data.type as VoucherTab] + 1
        }));

        toast({ title: "Success", description: `Voucher ${newVoucher.voucherNumber} created successfully` });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.error || "Failed to create voucher",
        variant: "destructive",
      });
    }
  };

  const handleUpdateVoucher = async (updatedVoucher: Voucher) => {
    try {
      const apiEntries = updatedVoucher.entries.map((entry, index) => ({
        account: entry.account,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        sortOrder: index,
      }));

      const response = await apiClient.updateVoucher(updatedVoucher.id, {
        type: updatedVoucher.type,
        date: updatedVoucher.date,
        narration: updatedVoucher.narration,
        cashBankAccount: updatedVoucher.cashBankAccount,
        entries: apiEntries,
        status: updatedVoucher.status,
      }) as any;

      if (response.data) {
        setVouchers(vouchers.map(v => v.id === updatedVoucher.id ? response.data : v));
        toast({ title: "Success", description: "Voucher updated successfully" });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.error || "Failed to update voucher",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    try {
      await apiClient.deleteVoucher(id);
      setVouchers(vouchers.filter(v => v.id !== id));
      toast({ title: "Success", description: "Voucher deleted successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.error || "Failed to delete voucher",
        variant: "destructive",
      });
    }
  };

  const generateVoucherNo = () => {
    const count = voucherCounters.receipt;
    return `RV-${String(count).padStart(4, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Main Tab Navigation */}
      <div className="bg-card border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-t-lg",
                  mainTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {mainTab === "new" && (
        <>
          {/* Voucher Type Tab Navigation */}
          <div className="bg-card border-b border-border">
            <div className="flex items-center gap-1 overflow-x-auto">
              {voucherTabs.map((tab) => {
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-t-lg",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="text-xs">^</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-card border border-border rounded-lg p-6">
            {activeTab === "payment" && (
              <PaymentVoucherForm
                accounts={accountsList}
                onAddSubgroup={handleAddSubgroup}
                onAddAccount={handleAddAccount}
                onSave={handleSaveVoucher}
              />
            )}
            {activeTab === "receipt" && (
              <ReceiptVoucherForm
                accounts={accountsList}
                onAddSubgroup={handleAddSubgroup}
                onAddAccount={handleAddAccount}
                onSave={handleSaveVoucher}
                generateVoucherNo={generateVoucherNo}
              />
            )}
            {activeTab === "journal" && (
              <JournalVoucherForm
                accounts={accountsList}
                onAddSubgroup={handleAddSubgroup}
                onAddAccount={handleAddAccount}
                onSave={handleSaveVoucher}
              />
            )}
            {activeTab === "contra" && (
              <ContraVoucherForm
                accounts={accountsList}
                onAddSubgroup={handleAddSubgroup}
                onAddAccount={handleAddAccount}
                onSave={handleSaveVoucher}
              />
            )}
          </div>
        </>
      )}

      {mainTab === "view" && (
        <ViewVouchersTab
          vouchers={vouchers}
          onUpdateVoucher={handleUpdateVoucher}
          onDeleteVoucher={handleDeleteVoucher}
          accounts={accountsList}
          onAddSubgroup={handleAddSubgroup}
          onAddAccount={handleAddAccount}
        />
      )}

      {/* Add Subgroup Dialog */}
      <Dialog open={showSubgroupDialog} onOpenChange={setShowSubgroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subgroup</DialogTitle>
            <DialogDescription>
              Create a new subgroup for organizing your accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Main Group</Label>
              <Select value={selectedMainGroup} onValueChange={setSelectedMainGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Main Group" />
                </SelectTrigger>
                <SelectContent>
                  {mainGroups.map((mg) => (
                    <SelectItem key={mg.id} value={mg.id}>
                      {mg.code} - {mg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="subgroupCode">Code</Label>
                <Input
                  id="subgroupCode"
                  placeholder="Code"
                  value={newSubgroupCode}
                  onChange={(e) => setNewSubgroupCode(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="subgroupName">Subgroup Name</Label>
                <Input
                  id="subgroupName"
                  placeholder="Enter subgroup name"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubgroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubgroup}>Save Subgroup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Account Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new account for your chart of accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subgroup</Label>
              <Select value={selectedSubgroup} onValueChange={setSelectedSubgroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Subgroup" />
                </SelectTrigger>
                <SelectContent>
                  {subgroups.map((sg) => (
                    <SelectItem key={sg.id} value={sg.id}>
                      {sg.code} - {sg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="accountCode">Code</Label>
                <Input
                  id="accountCode"
                  placeholder="Code"
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="Enter account name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccount}>Save Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
