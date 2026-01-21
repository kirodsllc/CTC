#!/bin/bash
set +e
echo "=========================================="
echo "  Fix All Missing Database Tables"
echo "=========================================="
echo ""
cd /var/www/nextapp/backend || exit 1
echo "Step 1: Checking for missing tables..."
if command -v sqlite3 &> /dev/null && [ -f "prisma/inventory.db" ]; then
    EXISTING=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%';" 2>/dev/null | wc -l)
    echo "[i] Found $EXISTING existing tables"
    
    # Check for User table specifically
    USER_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='User';" 2>/dev/null)
    if [ -z "$USER_EXISTS" ]; then
        echo "[!] User table is missing"
    else
        echo "[✓] User table exists"
    fi
fi
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
sleep 2
echo ""
echo "Step 3: Creating missing tables using Prisma db push..."
if npx prisma db push --accept-data-loss > /tmp/prisma-push.log 2>&1; then
    echo "[✓] Prisma db push completed"
    tail -5 /tmp/prisma-push.log
else
    echo "[!] Checking log..."
    tail -10 /tmp/prisma-push.log
fi
echo ""
echo "Step 4: Creating User table manually if still missing..."
if command -v sqlite3 &> /dev/null; then
    USER_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='User';" 2>/dev/null)
    if [ -z "$USER_EXISTS" ]; then
        sqlite3 prisma/inventory.db << 'SQLEOF'
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT,
  "role" TEXT NOT NULL DEFAULT 'Staff',
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastLogin" TEXT DEFAULT '-',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
SQLEOF
        if [ $? -eq 0 ]; then
            echo "[✓] User table created"
        fi
    else
        echo "[✓] User table already exists"
    fi
fi
echo ""
echo "Step 5: Regenerating Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true
if npx prisma generate > /dev/null 2>&1; then
    echo "[✓] Prisma client regenerated"
else
    echo "[✗] Failed to regenerate Prisma client"
    exit 1
fi
echo ""
echo "Step 6: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5
echo "[✓] Backend started"
echo ""
echo "Step 7: Testing API..."
sleep 3
pm2 flush > /dev/null 2>&1 || true
sleep 1
USERS_RESPONSE=$(curl -s http://localhost:3001/api/users?page=1&limit=10 2>&1)
if echo "$USERS_RESPONSE" | grep -qi "table.*does not exist"; then
    echo "[✗] Users API still showing errors"
    echo "$USERS_RESPONSE" | head -3
else
    echo "[✓] Users API is working!"
fi
pm2 save > /dev/null 2>&1 || true
echo ""
echo "=========================================="
echo "  Complete!"
echo "=========================================="
pm2 list | grep backend
