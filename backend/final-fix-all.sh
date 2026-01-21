#!/bin/bash

# Final Fix All Script
set +e

echo "=========================================="
echo "  Final Fix All Script"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_DIR="/var/www/nextapp/backend"

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

cd $BACKEND_DIR || exit 1

# Step 1: Verify database
echo ""
echo "Step 1: Verifying database..."
if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_status "Database verified: $TABLE_COUNT tables"
    else
        print_error "Database has no tables!"
        exit 1
    fi
fi

# Step 2: Verify .env
echo ""
echo "Step 2: Verifying .env..."
sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:./prisma/inventory.db"|' .env
print_status ".env verified"

# Step 3: Stop backend
echo ""
echo "Step 3: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
pm2 kill > /dev/null 2>&1 || true
sleep 3

# Step 4: Remove old Prisma client
echo ""
echo "Step 4: Removing old Prisma client..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf node_modules/@prisma/client 2>/dev/null || true

# Step 5: Generate Prisma client
echo ""
echo "Step 5: Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
print_status "Prisma client generated"

# Step 6: Start backend
echo ""
echo "Step 6: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5

# Step 7: Check status
echo ""
echo "Step 7: Checking status..."
sleep 3
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_warning "Backend status: $PM2_STATUS"
    fi
fi

# Step 8: Test backend
echo ""
echo "Step 8: Testing backend..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is responding"
else
    print_error "Backend not responding"
fi

# Step 9: Clear logs and test API
echo ""
echo "Step 9: Testing API endpoints..."
pm2 flush > /dev/null 2>&1 || true
sleep 2

curl -s http://localhost:3001/api/parts?limit=1 > /dev/null 2>&1 || true
sleep 1

ERROR_COUNT=$(pm2 logs backend --lines 20 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    print_status "No database errors found"
else
    print_warning "Found $ERROR_COUNT database errors"
fi

# Step 10: Restart Nginx
echo ""
echo "Step 10: Restarting Nginx..."
systemctl restart nginx > /dev/null 2>&1
print_status "Nginx restarted"

pm2 save > /dev/null 2>&1 || true

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
pm2 list
echo ""
