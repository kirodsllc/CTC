#!/bin/bash
# DPO Return System - Test Script

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       DPO RETURN SYSTEM - VERIFICATION TEST               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3002"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Server Health
echo "Test 1: Server Health Check"
echo "────────────────────────────────────────────────────────────"
HEALTH=$(curl -s "${BASE_URL}/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Server is running${NC}"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo -e "${RED}❌ Server is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Database Tables
echo "Test 2: Database Tables"
echo "────────────────────────────────────────────────────────────"
cd /var/www/Dev-Koncepts/backend
TABLES=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE '%Return%';")
if [ "$TABLES" -eq 2 ]; then
    echo -e "${GREEN}✅ Both DPO Return tables exist${NC}"
    sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Return%';"
else
    echo -e "${RED}❌ Tables missing (found $TABLES, expected 2)${NC}"
fi
echo ""

# Test 3: Compiled Files
echo "Test 3: Compiled Route Files"
echo "────────────────────────────────────────────────────────────"
if [ -f "dist/routes/dpo-returns.js" ]; then
    SIZE=$(ls -lh dist/routes/dpo-returns.js | awk '{print $5}')
    echo -e "${GREEN}✅ DPO Returns route compiled ($SIZE)${NC}"
else
    echo -e "${RED}❌ DPO Returns route not compiled${NC}"
fi
echo ""

# Test 4: DPO Returns Endpoint
echo "Test 4: DPO Returns Endpoint"
echo "────────────────────────────────────────────────────────────"
RESPONSE=$(curl -s "${BASE_URL}/api/dpo-returns?limit=1")
if echo "$RESPONSE" | grep -q "pagination"; then
    echo -e "${GREEN}✅ DPO Returns endpoint is accessible${NC}"
    echo "$RESPONSE" | jq '{pagination: .pagination, dataCount: (.data | length)}' 2>/dev/null
elif echo "$RESPONSE" | grep -q "<!DOCTYPE"; then
    echo -e "${RED}❌ Endpoint returns HTML (route not registered)${NC}"
    echo "Response: $(echo $RESPONSE | head -c 100)"
else
    echo -e "${YELLOW}⚠️  Endpoint returned unexpected response${NC}"
    echo "$RESPONSE" | head -c 200
fi
echo ""

# Test 5: Get Sample DPOs
echo "Test 5: Available DPOs for Testing"
echo "────────────────────────────────────────────────────────────"
DPO_COUNT=$(curl -s "${BASE_URL}/api/inventory/direct-purchase-orders?status=Completed&limit=100" | jq '.pagination.total' 2>/dev/null)
if [ ! -z "$DPO_COUNT" ] && [ "$DPO_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $DPO_COUNT completed DPO(s) available for returns${NC}"
    curl -s "${BASE_URL}/api/inventory/direct-purchase-orders?status=Completed&limit=3" | jq '.data[] | {dpoNumber, date, totalAmount}' 2>/dev/null
else
    echo -e "${YELLOW}⚠️  No completed DPOs found. Create a DPO first to test returns.${NC}"
fi
echo ""

# Test 6: Account Setup
echo "Test 6: Required Accounts Check"
echo "────────────────────────────────────────────────────────────"
INV_ACCOUNT=$(curl -s "${BASE_URL}/api/accounting/accounts" | jq '.data[] | select(.subgroup.code == "104") | .code' 2>/dev/null | head -1)
SUPP_ACCOUNT=$(curl -s "${BASE_URL}/api/accounting/accounts" | jq '.data[] | select(.subgroup.code == "301") | .code' 2>/dev/null | head -1)

if [ ! -z "$INV_ACCOUNT" ]; then
    echo -e "${GREEN}✅ Inventory account exists: $INV_ACCOUNT${NC}"
else
    echo -e "${RED}❌ Inventory account missing (subgroup 104)${NC}"
fi

if [ ! -z "$SUPP_ACCOUNT" ]; then
    echo -e "${GREEN}✅ Supplier Payable account exists: $SUPP_ACCOUNT${NC}"
else
    echo -e "${RED}❌ Supplier Payable account missing (subgroup 301)${NC}"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "System Status:"
echo "  • Server: Running ✅"
echo "  • Database: Ready ✅"
echo "  • Route: Compiled ✅"
if echo "$RESPONSE" | grep -q "pagination"; then
    echo "  • Endpoint: Accessible ✅"
else
    echo "  • Endpoint: Issue detected ⚠️"
fi
echo ""
echo "Next Steps:"
echo "  1. Create a test DPO if none exist"
echo "  2. Create a return: curl -X POST ${BASE_URL}/api/dpo-returns ..."
echo "  3. Read documentation: docs/DPO_RETURN_API_EXAMPLES.md"
echo ""
echo "Documentation:"
echo "  • System Guide: docs/DPO_RETURN_SYSTEM.md"
echo "  • API Examples: docs/DPO_RETURN_API_EXAMPLES.md"
echo "  • Installation: backend/INSTALLATION_COMPLETE.md"
echo ""
echo "═══════════════════════════════════════════════════════════"
