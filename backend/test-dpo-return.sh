#!/bin/bash
# Test DPO Return System

echo "=== DPO Return System Test ==="
echo ""

# Test 1: Check endpoint availability
echo "1. Testing endpoint availability..."
curl -s http://localhost:3002/api/dpo-returns?limit=1 | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Endpoint is available"
else
  echo "❌ Endpoint not available"
fi

echo ""
echo "2. Checking database tables..."
sqlite3 prisma/inventory.db "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name LIKE '%Return%';" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Database tables exist"
else
  echo "❌ Database tables missing"
fi

echo ""
echo "3. Testing GET /api/dpo-returns..."
curl -s "http://localhost:3002/api/dpo-returns?limit=5" | jq '.pagination' 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ GET endpoint works"
else
  echo "❌ GET endpoint failed"
fi

echo ""
echo "=== Test Complete ==="
