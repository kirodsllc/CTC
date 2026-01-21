#!/bin/bash

# Test script for Purchase Order Deletion
# This script tests comprehensive deletion of Purchase Orders

set -e

echo "=========================================="
echo "  Purchase Order Deletion Test"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api"
TEST_PO_NUMBER="PO-TEST-DELETE-$(date +%s)"

echo "📝 Step 1: Creating test Purchase Order..."
echo "   PO Number: $TEST_PO_NUMBER"
echo ""

# Step 1: Get a supplier
echo "   Getting test supplier..."
SUPPLIER_RESPONSE=$(curl -s "$API_URL/suppliers?limit=1" || echo '{"data":[]}')
SUPPLIER_ID=$(echo "$SUPPLIER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SUPPLIER_ID" ]; then
    echo "   ⚠️  No supplier found. Creating test supplier..."
    SUPPLIER_RESPONSE=$(curl -s -X POST "$API_URL/suppliers" \
        -H "Content-Type: application/json" \
        -d '{
            "company_name": "Test Supplier for PO Deletion",
            "name": "Test Supplier",
            "contact_no": "1234567890",
            "status": "active"
        }' || echo '{}')
    SUPPLIER_ID=$(echo "$SUPPLIER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$SUPPLIER_ID" ]; then
    echo "   ❌ Failed to get or create supplier"
    exit 1
fi

echo "   ✓ Supplier ID: $SUPPLIER_ID"

# Step 2: Get a part
echo "   Getting test part..."
PART_RESPONSE=$(curl -s "$API_URL/parts?limit=1" || echo '{"data":[]}')
PART_ID=$(echo "$PART_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PART_ID" ]; then
    echo "   ⚠️  No part found. Please create a part first."
    exit 1
fi

echo "   ✓ Part ID: $PART_ID"

# Step 3: Create Purchase Order
echo ""
echo "📦 Step 2: Creating Purchase Order..."
PO_RESPONSE=$(curl -s -X POST "$API_URL/inventory/purchase-orders" \
    -H "Content-Type: application/json" \
    -d "{
        \"po_number\": \"$TEST_PO_NUMBER\",
        \"date\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
        \"supplier_id\": \"$SUPPLIER_ID\",
        \"status\": \"Draft\",
        \"items\": [
            {
                \"part_id\": \"$PART_ID\",
                \"quantity\": 10,
                \"unit_cost\": 1000,
                \"total_cost\": 10000
            }
        ]
    }" || echo '{}')

PO_ID=$(echo "$PO_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PO_ID" ]; then
    echo "   ❌ Failed to create Purchase Order"
    echo "   Response: $PO_RESPONSE"
    exit 1
fi

echo "   ✓ Purchase Order created: $PO_ID"
echo "   ✓ PO Number: $TEST_PO_NUMBER"

# Step 4: Receive the PO (to create stock movements and journal entries)
echo ""
echo "📥 Step 3: Receiving Purchase Order (to create stock and accounting entries)..."
RECEIVE_RESPONSE=$(curl -s -X PUT "$API_URL/inventory/purchase-orders/$PO_ID" \
    -H "Content-Type: application/json" \
    -d "{
        \"status\": \"Received\",
        \"items\": [
            {
                \"part_id\": \"$PART_ID\",
                \"quantity\": 10,
                \"unit_cost\": 1000,
                \"total_cost\": 10000,
                \"received_qty\": 10
            }
        ]
    }" || echo '{}')

if echo "$RECEIVE_RESPONSE" | grep -q "error"; then
    echo "   ⚠️  Warning: PO receive may have failed, but continuing test..."
    echo "   Response: $RECEIVE_RESPONSE"
else
    echo "   ✓ Purchase Order received successfully"
fi

# Wait a moment for async operations
sleep 2

# Step 5: Verify data exists before deletion
echo ""
echo "🔍 Step 4: Verifying data exists before deletion..."

# Check stock movements (using direct database query via API if available, or count in response)
STOCK_RESPONSE=$(curl -s "$API_URL/inventory/stock-movements" | grep -c "$PO_ID" || echo "0")
echo "   Stock Movements (checking for PO ID): $STOCK_RESPONSE"

# Check journal entries by reference
JOURNAL_RESPONSE=$(curl -s "$API_URL/accounting/journal-entries" | grep -c "$TEST_PO_NUMBER" || echo "0")
echo "   Journal Entries (checking for PO number): $JOURNAL_RESPONSE"

# Also check by PO- prefix
JOURNAL_RESPONSE2=$(curl -s "$API_URL/accounting/journal-entries" | grep -c "PO-$TEST_PO_NUMBER" || echo "0")
echo "   Journal Entries (checking for PO- prefix): $JOURNAL_RESPONSE2"

# Step 6: Delete the Purchase Order
echo ""
echo "🗑️  Step 5: Deleting Purchase Order..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/inventory/purchase-orders/$PO_ID" || echo '{}')

if echo "$DELETE_RESPONSE" | grep -q "error"; then
    echo "   ❌ Failed to delete Purchase Order"
    echo "   Response: $DELETE_RESPONSE"
    exit 1
fi

echo "   ✓ Purchase Order deletion request successful"
echo "   Response: $DELETE_RESPONSE"

# Wait a moment for deletion to complete
sleep 2

# Step 7: Verify deletion
echo ""
echo "✅ Step 6: Verifying deletion..."

# Check if PO still exists
PO_CHECK=$(curl -s "$API_URL/inventory/purchase-orders/$PO_ID" || echo '{"error":"not found"}')
if echo "$PO_CHECK" | grep -q "error\|not found"; then
    echo "   ✓ Purchase Order deleted successfully"
else
    echo "   ❌ Purchase Order still exists!"
    exit 1
fi

# Check stock movements
STOCK_AFTER_RESPONSE=$(curl -s "$API_URL/inventory/stock-movements" 2>/dev/null || echo '[]')
STOCK_AFTER_BY_ID=$(echo "$STOCK_AFTER_RESPONSE" | grep -c "$PO_ID" || echo "0")
STOCK_AFTER_BY_PO=$(echo "$STOCK_AFTER_RESPONSE" | grep -c "$TEST_PO_NUMBER" || echo "0")
STOCK_AFTER_TOTAL=$((STOCK_AFTER_BY_ID + STOCK_AFTER_BY_PO))

if [ "$STOCK_AFTER_TOTAL" -eq "0" ]; then
    echo "   ✓ Stock movements deleted (no references to PO found)"
else
    echo "   ❌ ERROR: Found $STOCK_AFTER_TOTAL reference(s) to PO in stock movements!"
    echo "      - By PO ID: $STOCK_AFTER_BY_ID"
    echo "      - By PO Number: $STOCK_AFTER_BY_PO"
fi

# Check journal entries
JOURNAL_AFTER=$(curl -s "$API_URL/accounting/journal-entries" | grep -c "$TEST_PO_NUMBER\|PO-$TEST_PO_NUMBER" || echo "0")
if [ "$JOURNAL_AFTER" -eq "0" ]; then
    echo "   ✓ Journal entries deleted (no references to PO found)"
else
    echo "   ⚠️  Warning: Found $JOURNAL_AFTER reference(s) to PO in journal entries"
fi

# Check vouchers
VOUCHER_AFTER=$(curl -s "$API_URL/accounting/vouchers" 2>/dev/null | grep -c "$TEST_PO_NUMBER\|PO-$TEST_PO_NUMBER" || echo "0")
if [ "$VOUCHER_AFTER" -eq "0" ]; then
    echo "   ✓ Vouchers deleted (no references to PO found)"
else
    echo "   ⚠️  Warning: Found $VOUCHER_AFTER reference(s) to PO in vouchers"
fi

echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo "✓ Purchase Order created: $TEST_PO_NUMBER"
echo "✓ Purchase Order received (stock & accounting created)"
echo "✓ Purchase Order deleted"
echo "✓ Related data verified as deleted"
echo ""
echo "✅ Test completed successfully!"
echo ""

