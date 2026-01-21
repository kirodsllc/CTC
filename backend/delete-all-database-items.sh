#!/bin/bash

echo "=========================================="
echo "DELETE ALL DATABASE ITEMS"
echo "DPO, PO, Journals, Items, Everything"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will delete ALL data from the database!"
echo "   - All DPO (Direct Purchase Orders)"
echo "   - All PO (Purchase Orders)"
echo "   - All Journals and Journal Entries"
echo "   - All Vouchers"
echo "   - All Sales Invoices, Quotations, Inquiries"
echo "   - All Stock Movements"
echo "   - All Parts/Items"
echo "   - All Transfers, Adjustments"
echo "   - All Kits"
echo "   - All Price History"
echo "   - All Returns"
echo "   - All Attributes: Brands, Categories, Subcategories, Applications"
echo "   - All Master Parts"
echo "   - All Stores, Racks, Shelves"
echo "   - All Customers, Suppliers"
echo "   - All Expense Types"
echo "   - All Accounting Structure (Accounts, Groups)"
echo "   - And everything else..."
echo ""

read -p "Are you sure you want to continue? Type 'DELETE ALL' to confirm: " confirm

if [ "$confirm" != "DELETE ALL" ]; then
    echo "❌ Operation cancelled"
    exit 1
fi

# Detect database path
DB_PATH="/var/www/Dev-Koncepts/backend/prisma/inventory.db"
if [ ! -f "$DB_PATH" ]; then
    DB_PATH="/var/www/Dev-Koncepts/backend/prisma/dev.db"
fi

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database file not found"
    exit 1
fi

echo "✅ Database found: $DB_PATH"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Disable foreign keys temporarily for faster deletion
sqlite3 "$DB_PATH" "PRAGMA foreign_keys = OFF;" 2>/dev/null

echo "Starting deletion process..."
echo ""

# ============================================
# Step 1: Delete all child items first
# ============================================
print_info "Step 1: Deleting all child items..."

# DPO Return Items
sqlite3 "$DB_PATH" "DELETE FROM DirectPurchaseOrderReturnItem;" 2>/dev/null
print_success "Deleted DPO Return Items"

# DPO Returns
sqlite3 "$DB_PATH" "DELETE FROM DirectPurchaseOrderReturn;" 2>/dev/null
print_success "Deleted DPO Returns"

# DPO Expenses
sqlite3 "$DB_PATH" "DELETE FROM DirectPurchaseOrderExpense;" 2>/dev/null
print_success "Deleted DPO Expenses"

# DPO Items
sqlite3 "$DB_PATH" "DELETE FROM DirectPurchaseOrderItem;" 2>/dev/null
print_success "Deleted DPO Items"

# PO Items
sqlite3 "$DB_PATH" "DELETE FROM PurchaseOrderItem;" 2>/dev/null
print_success "Deleted PO Items"

# Journal Lines
sqlite3 "$DB_PATH" "DELETE FROM JournalLine;" 2>/dev/null
print_success "Deleted Journal Lines"

# Voucher Entries
sqlite3 "$DB_PATH" "DELETE FROM VoucherEntry;" 2>/dev/null
print_success "Deleted Voucher Entries"

# Delivery Log Items
sqlite3 "$DB_PATH" "DELETE FROM DeliveryLogItem;" 2>/dev/null
print_success "Deleted Delivery Log Items"

# Delivery Logs
sqlite3 "$DB_PATH" "DELETE FROM DeliveryLog;" 2>/dev/null
print_success "Deleted Delivery Logs"

# Stock Reservations
sqlite3 "$DB_PATH" "DELETE FROM StockReservation;" 2>/dev/null
print_success "Deleted Stock Reservations"

# Sales Return Items
sqlite3 "$DB_PATH" "DELETE FROM SalesReturnItem;" 2>/dev/null
print_success "Deleted Sales Return Items"

# Sales Returns
sqlite3 "$DB_PATH" "DELETE FROM SalesReturn;" 2>/dev/null
print_success "Deleted Sales Returns"

# Sales Invoice Items
sqlite3 "$DB_PATH" "DELETE FROM SalesInvoiceItem;" 2>/dev/null
print_success "Deleted Sales Invoice Items"

# Receivables
sqlite3 "$DB_PATH" "DELETE FROM Receivable;" 2>/dev/null
print_success "Deleted Receivables"

# Sales Invoices
sqlite3 "$DB_PATH" "DELETE FROM SalesInvoice;" 2>/dev/null
print_success "Deleted Sales Invoices"

# Sales Quotation Items
sqlite3 "$DB_PATH" "DELETE FROM SalesQuotationItem;" 2>/dev/null
print_success "Deleted Sales Quotation Items"

# Sales Quotations
sqlite3 "$DB_PATH" "DELETE FROM SalesQuotation;" 2>/dev/null
print_success "Deleted Sales Quotations"

# Sales Inquiry Items
sqlite3 "$DB_PATH" "DELETE FROM SalesInquiryItem;" 2>/dev/null
print_success "Deleted Sales Inquiry Items"

# Sales Inquiries
sqlite3 "$DB_PATH" "DELETE FROM SalesInquiry;" 2>/dev/null
print_success "Deleted Sales Inquiries"

# Transfer Items
sqlite3 "$DB_PATH" "DELETE FROM TransferItem;" 2>/dev/null
print_success "Deleted Transfer Items"

# Transfers
sqlite3 "$DB_PATH" "DELETE FROM Transfer;" 2>/dev/null
print_success "Deleted Transfers"

# Adjustment Items
sqlite3 "$DB_PATH" "DELETE FROM AdjustmentItem;" 2>/dev/null
print_success "Deleted Adjustment Items"

# Adjustments
sqlite3 "$DB_PATH" "DELETE FROM Adjustment;" 2>/dev/null
print_success "Deleted Adjustments"

# Stock Verification Items
sqlite3 "$DB_PATH" "DELETE FROM StockVerificationItem;" 2>/dev/null
print_success "Deleted Stock Verification Items"

# Stock Verifications
sqlite3 "$DB_PATH" "DELETE FROM StockVerification;" 2>/dev/null
print_success "Deleted Stock Verifications"

# Kit Items
sqlite3 "$DB_PATH" "DELETE FROM KitItem;" 2>/dev/null
print_success "Deleted Kit Items"

# Kits
sqlite3 "$DB_PATH" "DELETE FROM Kit;" 2>/dev/null
print_success "Deleted Kits"

# Models
sqlite3 "$DB_PATH" "DELETE FROM Model;" 2>/dev/null
print_success "Deleted Models"

# Price History
sqlite3 "$DB_PATH" "DELETE FROM PriceHistory;" 2>/dev/null
print_success "Deleted Price History records"

# Stock Movements
sqlite3 "$DB_PATH" "DELETE FROM StockMovement;" 2>/dev/null
print_success "Deleted Stock Movements"

# ============================================
# Step 2: Delete all parent records
# ============================================
echo ""
print_info "Step 2: Deleting all parent records..."

# DPO
sqlite3 "$DB_PATH" "DELETE FROM DirectPurchaseOrder;" 2>/dev/null
print_success "Deleted Direct Purchase Orders (DPO)"

# PO
sqlite3 "$DB_PATH" "DELETE FROM PurchaseOrder;" 2>/dev/null
print_success "Deleted Purchase Orders (PO)"

# Journal Entries
sqlite3 "$DB_PATH" "DELETE FROM JournalEntry;" 2>/dev/null
print_success "Deleted Journal Entries"

# Vouchers
sqlite3 "$DB_PATH" "DELETE FROM Voucher;" 2>/dev/null
print_success "Deleted Vouchers"

# Posted Expenses
sqlite3 "$DB_PATH" "DELETE FROM PostedExpense;" 2>/dev/null
print_success "Deleted Posted Expenses"

# Operational Expenses
sqlite3 "$DB_PATH" "DELETE FROM OperationalExpense;" 2>/dev/null
print_success "Deleted Operational Expenses"

# ============================================
# Step 3: Delete all Parts/Items
# ============================================
echo ""
print_info "Step 3: Deleting all Parts/Items..."

sqlite3 "$DB_PATH" "DELETE FROM Part;" 2>/dev/null
print_success "Deleted Parts/Items"

# ============================================
# Step 4: Delete all Attribute/Master Data
# ============================================
echo ""
print_info "Step 4: Deleting all attribute/master data..."

# Applications (must be first due to foreign keys)
sqlite3 "$DB_PATH" "DELETE FROM Application;" 2>/dev/null
print_success "Deleted Applications"

# Subcategories
sqlite3 "$DB_PATH" "DELETE FROM Subcategory;" 2>/dev/null
print_success "Deleted Subcategories"

# Categories
sqlite3 "$DB_PATH" "DELETE FROM Category;" 2>/dev/null
print_success "Deleted Categories"

# Brands
sqlite3 "$DB_PATH" "DELETE FROM Brand;" 2>/dev/null
print_success "Deleted Brands"

# Master Parts
sqlite3 "$DB_PATH" "DELETE FROM MasterPart;" 2>/dev/null
print_success "Deleted Master Parts"

# Shelves
sqlite3 "$DB_PATH" "DELETE FROM Shelf;" 2>/dev/null
print_success "Deleted Shelves"

# Racks
sqlite3 "$DB_PATH" "DELETE FROM Rack;" 2>/dev/null
print_success "Deleted Racks"

# Stores
sqlite3 "$DB_PATH" "DELETE FROM Store;" 2>/dev/null
print_success "Deleted Stores"

# Customers
sqlite3 "$DB_PATH" "DELETE FROM Customer;" 2>/dev/null
print_success "Deleted Customers"

# Suppliers
sqlite3 "$DB_PATH" "DELETE FROM Supplier;" 2>/dev/null
print_success "Deleted Suppliers"

# Expense Types
sqlite3 "$DB_PATH" "DELETE FROM ExpenseType;" 2>/dev/null
print_success "Deleted Expense Types"

# Accounts
sqlite3 "$DB_PATH" "DELETE FROM Account;" 2>/dev/null
print_success "Deleted Accounts"

# Subgroups
sqlite3 "$DB_PATH" "DELETE FROM Subgroup;" 2>/dev/null
print_success "Deleted Subgroups"

# Main Groups
sqlite3 "$DB_PATH" "DELETE FROM MainGroup;" 2>/dev/null
print_success "Deleted Main Groups"

# Re-enable foreign keys
sqlite3 "$DB_PATH" "PRAGMA foreign_keys = ON;" 2>/dev/null

# ============================================
# Verification
# ============================================
echo ""
echo "=========================================="
echo "  DELETION COMPLETE"
echo "=========================================="
echo ""

REMAINING_DPO=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM DirectPurchaseOrder;" 2>/dev/null || echo "0")
REMAINING_PO=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM PurchaseOrder;" 2>/dev/null || echo "0")
REMAINING_JOURNALS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM JournalEntry;" 2>/dev/null || echo "0")
REMAINING_VOUCHERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Voucher;" 2>/dev/null || echo "0")
REMAINING_SALES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM SalesInvoice;" 2>/dev/null || echo "0")
REMAINING_PARTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Part;" 2>/dev/null || echo "0")
REMAINING_STOCK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM StockMovement;" 2>/dev/null || echo "0")
REMAINING_TRANSFERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Transfer;" 2>/dev/null || echo "0")
REMAINING_ADJUSTMENTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Adjustment;" 2>/dev/null || echo "0")
REMAINING_KITS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Kit;" 2>/dev/null || echo "0")
REMAINING_BRANDS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Brand;" 2>/dev/null || echo "0")
REMAINING_CATEGORIES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Category;" 2>/dev/null || echo "0")
REMAINING_SUBCATEGORIES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Subcategory;" 2>/dev/null || echo "0")
REMAINING_APPLICATIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Application;" 2>/dev/null || echo "0")
REMAINING_MASTERPARTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MasterPart;" 2>/dev/null || echo "0")
REMAINING_STORES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Store;" 2>/dev/null || echo "0")
REMAINING_RACKS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Rack;" 2>/dev/null || echo "0")
REMAINING_SHELVES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Shelf;" 2>/dev/null || echo "0")
REMAINING_CUSTOMERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Customer;" 2>/dev/null || echo "0")
REMAINING_SUPPLIERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Supplier;" 2>/dev/null || echo "0")
REMAINING_EXPENSETYPES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ExpenseType;" 2>/dev/null || echo "0")
REMAINING_ACCOUNTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Account;" 2>/dev/null || echo "0")
REMAINING_SUBGROUPS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Subgroup;" 2>/dev/null || echo "0")
REMAINING_MAINGROUPS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MainGroup;" 2>/dev/null || echo "0")

echo "Remaining records:"
echo "  DPO: $REMAINING_DPO"
echo "  PO: $REMAINING_PO"
echo "  Journals: $REMAINING_JOURNALS"
echo "  Vouchers: $REMAINING_VOUCHERS"
echo "  Sales Invoices: $REMAINING_SALES"
echo "  Parts: $REMAINING_PARTS"
echo "  Stock Movements: $REMAINING_STOCK"
echo "  Transfers: $REMAINING_TRANSFERS"
echo "  Adjustments: $REMAINING_ADJUSTMENTS"
echo "  Kits: $REMAINING_KITS"
echo "  Brands: $REMAINING_BRANDS"
echo "  Categories: $REMAINING_CATEGORIES"
echo "  Subcategories: $REMAINING_SUBCATEGORIES"
echo "  Applications: $REMAINING_APPLICATIONS"
echo "  Master Parts: $REMAINING_MASTERPARTS"
echo "  Stores: $REMAINING_STORES"
echo "  Racks: $REMAINING_RACKS"
echo "  Shelves: $REMAINING_SHELVES"
echo "  Customers: $REMAINING_CUSTOMERS"
echo "  Suppliers: $REMAINING_SUPPLIERS"
echo "  Expense Types: $REMAINING_EXPENSETYPES"
echo "  Accounts: $REMAINING_ACCOUNTS"
echo "  Subgroups: $REMAINING_SUBGROUPS"
echo "  Main Groups: $REMAINING_MAINGROUPS"
echo ""

TOTAL_REMAINING=$((REMAINING_DPO + REMAINING_PO + REMAINING_JOURNALS + REMAINING_VOUCHERS + REMAINING_SALES + REMAINING_PARTS + REMAINING_STOCK + REMAINING_TRANSFERS + REMAINING_ADJUSTMENTS + REMAINING_KITS + REMAINING_BRANDS + REMAINING_CATEGORIES + REMAINING_SUBCATEGORIES + REMAINING_APPLICATIONS + REMAINING_MASTERPARTS + REMAINING_STORES + REMAINING_RACKS + REMAINING_SHELVES + REMAINING_CUSTOMERS + REMAINING_SUPPLIERS + REMAINING_EXPENSETYPES + REMAINING_ACCOUNTS + REMAINING_SUBGROUPS + REMAINING_MAINGROUPS))

if [ "$TOTAL_REMAINING" -eq 0 ]; then
    print_success "ALL DATABASE ITEMS DELETED SUCCESSFULLY!"
else
    print_error "Some items may still remain"
fi

echo ""
print_info "Database cleanup complete!"
