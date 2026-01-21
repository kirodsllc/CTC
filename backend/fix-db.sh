#!/bin/bash
set +e
echo "=========================================="
echo "  Complete Database Fix Script"
echo "=========================================="
echo ""
cd /var/www/nextapp/backend || exit 1
echo "Step 1: Verifying database..."
if [ ! -f "prisma/inventory.db" ]; then
    echo "[✗] inventory.db not found!"
    exit 1
fi
if command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo "[✓] inventory.db has $TABLE_COUNT tables"
    else
        echo "[✗] inventory.db has no tables!"
        exit 1
    fi
fi
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
pm2 kill > /dev/null 2>&1 || true
sleep 3
echo "[✓] Backend stopped"
echo ""
echo "Step 3: Copying inventory.db to dev.db..."
if [ -f "prisma/inventory.db" ]; then
    cp prisma/inventory.db prisma/dev.db 2>/dev/null || true
    chmod 666 prisma/dev.db 2>/dev/null || true
    echo "[✓] Copied inventory.db to dev.db"
fi
echo ""
echo "Step 4: Updating .env file..."
cat > .env << 'ENVEOF'
DATABASE_URL="file:/var/www/nextapp/backend/prisma/inventory.db"
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://103.60.12.157
ENVEOF
echo "[✓] .env updated"
echo ""
echo "Step 5: Removing Prisma client cache..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf node_modules/@prisma/client 2>/dev/null || true
echo "[✓] Cache removed"
echo ""
echo "Step 6: Generating Prisma client..."
if npx prisma generate 2>&1 | tail -5; then
    echo "[✓] Prisma client generated"
else
    echo "[✗] Failed to generate Prisma client"
    exit 1
fi
echo ""
echo "Step 7: Rebuilding backend..."
if npm run build > /tmp/backend-build.log 2>&1; then
    echo "[✓] Backend rebuilt"
else
    echo "[!] Build had warnings"
    tail -5 /tmp/backend-build.log
fi
echo ""
echo "Step 8: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5
echo "[✓] Backend started"
echo ""
echo "Step 9: Testing API..."
sleep 3
pm2 flush > /dev/null 2>&1 || true
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "[✓] Health endpoint responding"
fi
sleep 1
RESPONSE=$(curl -s http://localhost:3001/api/parts?limit=1 2>&1)
if echo "$RESPONSE" | grep -qi "table.*does not exist"; then
    echo "[✗] Database errors still occurring"
    echo "$RESPONSE" | head -3
else
    echo "[✓] API is working! No database errors"
fi
echo ""
echo "Step 10: Checking logs..."
sleep 2
ERROR_COUNT=$(pm2 logs backend --lines 15 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "[✓] No database errors in logs!"
else
    echo "[!] Found $ERROR_COUNT errors (might be old)"
    pm2 flush > /dev/null 2>&1 || true
    sleep 1
    curl -s http://localhost:3001/api/parts?limit=1 > /dev/null 2>&1
    sleep 2
    NEW_ERRORS=$(pm2 logs backend --lines 10 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")
    if [ "$NEW_ERRORS" -eq 0 ]; then
        echo "[✓] No new errors after fresh API call!"
    else
        echo "[✗] Still getting errors"
    fi
fi
pm2 save > /dev/null 2>&1 || true
echo ""
echo "=========================================="
echo "  Fix Complete!"
echo "=========================================="
pm2 list | grep backend
