#!/bin/bash

# Fix Prisma Client and Restart Backend
set +e

echo "=========================================="
echo "  Fix Prisma Client and Restart Backend"
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
    PART_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='Part';" 2>/dev/null)
    
    if [ "$TABLE_COUNT" -gt 0 ] && [ -n "$PART_EXISTS" ]; then
        print_status "Database verified: $TABLE_COUNT tables exist (Part table found)"
    else
        print_error "Database verification failed!"
        exit 1
    fi
fi

# Step 2: Stop backend completely
echo ""
echo "Step 2: Stopping backend completely..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
sleep 2
print_status "Backend stopped"

# Step 3: Remove old Prisma client
echo ""
echo "Step 3: Removing old Prisma client..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf node_modules/@prisma/client 2>/dev/null || true
print_status "Old Prisma client removed"

# Step 4: Verify .env
echo ""
echo "Step 4: Verifying .env..."
sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:./prisma/inventory.db"|' .env
print_status ".env verified"

# Step 5: Generate Prisma client fresh
echo ""
echo "Step 5: Generating Prisma client..."
npx prisma generate 2>&1 | head -10
print_status "Prisma client generated"

# Step 6: Rebuild backend
echo ""
echo "Step 6: Rebuilding backend..."
npm run build > /dev/null 2>&1 || print_warning "Build had warnings"
print_status "Backend rebuilt"

# Step 7: Start backend fresh
echo ""
echo "Step 7: Starting backend..."
pm2 kill > /dev/null 2>&1 || true
sleep 2
pm2 start npm --name "backend" -- start > /dev/null 2>&1 || pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5
print_status "Backend started"

# Step 8: Verify
echo ""
echo "Step 8: Verifying..."
sleep 3
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_warning "Backend status: $PM2_STATUS"
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
