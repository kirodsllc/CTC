#!/bin/bash

echo "================================================"
echo "🧪 TESTING AUTOMATIC VOUCHER CREATION SYSTEM"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create Supplier with Opening Balance
echo -e "${BLUE}📝 Test 1: Creating Supplier with Opening Balance 85,000${NC}"
SUPPLIER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "AUTO VOUCHER TEST SUPPLIER",
    "name": "Auto Test Supplier",
    "openingBalance": 85000,
    "date": "2026-01-13",
    "status": "active"
  }')

SUPPLIER_CODE=$(echo $SUPPLIER_RESPONSE | jq -r '.data.code')
echo -e "${GREEN}✅ Supplier Created: $SUPPLIER_CODE${NC}"
echo ""

# Test 2: Create Customer with Opening Balance
echo -e "${BLUE}📝 Test 2: Creating Customer with Opening Balance 120,000${NC}"
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AUTO VOUCHER TEST CUSTOMER",
    "openingBalance": 120000,
    "date": "2026-01-13",
    "status": "active"
  }')

CUSTOMER_NAME=$(echo $CUSTOMER_RESPONSE | jq -r '.data.name')
echo -e "${GREEN}✅ Customer Created: $CUSTOMER_NAME${NC}"
echo ""

# Wait for vouchers to be created
sleep 2

# Test 3: Check if vouchers were created
echo -e "${BLUE}📝 Test 3: Checking Vouchers${NC}"
VOUCHERS=$(curl -s "http://localhost:3001/api/vouchers?limit=10")
VOUCHER_COUNT=$(echo $VOUCHERS | jq '.pagination.total')
echo -e "${GREEN}✅ Total Vouchers in System: $VOUCHER_COUNT${NC}"
echo ""

# Test 4: Display recent vouchers
echo -e "${BLUE}📝 Test 4: Recent Vouchers (Last 5)${NC}"
echo $VOUCHERS | jq -r '.data[] | "\(.voucherNumber) | \(.type) | Debit: \(.totalDebit) | Credit: \(.totalCredit) | \(.narration)"' | head -5
echo ""

# Test 5: Check General Journal
echo -e "${BLUE}📝 Test 5: Checking General Journal${NC}"
JOURNAL=$(curl -s "http://localhost:3001/api/accounting/general-journal?from_date=2026-01-01&to_date=2026-01-31&limit=10")
JOURNAL_COUNT=$(echo $JOURNAL | jq '.pagination.total')
echo -e "${GREEN}✅ Total Journal Entries: $JOURNAL_COUNT${NC}"
echo ""

echo "Recent Journal Entries:"
echo $JOURNAL | jq -r '.data[] | "\(.voucherNo) | \(.account) | Dr: \(.debit) | Cr: \(.credit)"' | head -10
echo ""

# Test 6: Check Trial Balance
echo -e "${BLUE}📝 Test 6: Checking Trial Balance${NC}"
TRIAL=$(curl -s "http://localhost:3001/api/accounting/trial-balance?from_date=2026-01-01&to_date=2026-01-31")
echo $TRIAL | jq -r '.[] | select(.type=="account") | "\(.code) \(.name) | Dr: \(.debit) | Cr: \(.credit)"' | grep -E "OWNER CAPITAL|Test" | head -5
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}✅ TESTING COMPLETE${NC}"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Check the vouchers created above"
echo "2. Verify they appear in General Journal with correct account format (CODE-NAME)"
echo "3. Verify Trial Balance is balanced"
echo "4. Check Balance Sheet and Ledgers in the UI"
echo ""
echo "Expected Account Format:"
echo "  ✅ 501003-OWNER CAPITAL"
echo "  ✅ 301XXX-Supplier Name"
echo "  ✅ 103XXX-Customer Name"
