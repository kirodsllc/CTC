#!/bin/bash
set +e
echo "=========================================="
echo "  Fix Missing LongCatSettings Table"
echo "=========================================="
echo ""
cd /var/www/nextapp/backend || exit 1
echo "Step 1: Checking if LongCatSettings table exists..."
if command -v sqlite3 &> /dev/null; then
    TABLE_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='LongCatSettings';" 2>/dev/null)
    if [ -n "$TABLE_EXISTS" ]; then
        echo "[✓] LongCatSettings table already exists"
        exit 0
    else
        echo "[!] LongCatSettings table not found, creating it..."
    fi
fi
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
sleep 2
echo ""
echo "Step 3: Creating LongCatSettings table..."
if command -v sqlite3 &> /dev/null; then
    sqlite3 prisma/inventory.db << 'SQLEOF'
CREATE TABLE IF NOT EXISTS "LongCatSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "apiKey" TEXT,
  "model" TEXT DEFAULT 'LongCat-Flash-Chat',
  "baseUrl" TEXT DEFAULT 'https://api.longcat.chat',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
SQLEOF
    if [ $? -eq 0 ]; then
        echo "[✓] Table created"
    else
        echo "[✗] Failed to create table"
        exit 1
    fi
fi
echo ""
echo "Step 4: Regenerating Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true
if npx prisma generate > /dev/null 2>&1; then
    echo "[✓] Prisma client regenerated"
else
    echo "[✗] Failed to regenerate Prisma client"
    exit 1
fi
echo ""
echo "Step 5: Verifying table..."
if command -v sqlite3 &> /dev/null; then
    TABLE_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='LongCatSettings';" 2>/dev/null)
    if [ -n "$TABLE_EXISTS" ]; then
        echo "[✓] LongCatSettings table verified"
    else
        echo "[✗] Table verification failed"
        exit 1
    fi
fi
echo ""
echo "Step 6: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5
echo "[✓] Backend started"
echo ""
echo "Step 7: Testing API..."
sleep 3
RESPONSE=$(curl -s http://localhost:3001/api/longcat-settings 2>&1)
if echo "$RESPONSE" | grep -qi "table.*does not exist"; then
    echo "[✗] API still showing errors"
    echo "$RESPONSE" | head -3
else
    echo "[✓] API is working!"
fi
pm2 save > /dev/null 2>&1 || true
echo ""
echo "=========================================="
echo "  Complete!"
echo "=========================================="
pm2 list | grep backend
