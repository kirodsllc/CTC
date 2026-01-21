#!/bin/bash
set +e
echo "=========================================="
echo "  Fix 502 Bad Gateway Error"
echo "=========================================="
echo ""
cd /var/www/nextapp/backend || exit 1
echo "Step 1: Checking PM2 status..."
pm2 list
echo ""
echo "Step 2: Checking backend port..."
if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
    echo "[✓] Backend is listening on port 3001"
else
    echo "[✗] Backend is NOT listening, restarting..."
    pm2 restart backend > /dev/null 2>&1 || pm2 start dist/server.js --name "backend" > /dev/null 2>&1
    sleep 5
fi
echo ""
echo "Step 3: Testing backend..."
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "[✓] Backend health check passed"
else
    echo "[✗] Backend not responding, checking logs..."
    pm2 logs backend --lines 10 --nostream 2>&1 | tail -10
    echo "[!] Restarting backend..."
    pm2 delete backend > /dev/null 2>&1 || true
    pm2 start dist/server.js --name "backend" > /dev/null 2>&1
    sleep 5
fi
echo ""
echo "Step 4: Restarting Nginx..."
systemctl restart nginx > /dev/null 2>&1
echo "[✓] Nginx restarted"
echo ""
echo "Step 5: Final test..."
sleep 3
if curl -s http://localhost:3001/api/inventory/dashboard | grep -q "error\|502" 2>/dev/null; then
    echo "[✗] Dashboard endpoint still has issues"
    pm2 logs backend --lines 15 --nostream 2>&1 | tail -15
else
    echo "[✓] Dashboard endpoint is working"
fi
pm2 save > /dev/null 2>&1 || true
echo ""
echo "=========================================="
echo "  Complete!"
echo "=========================================="
pm2 list | grep backend
