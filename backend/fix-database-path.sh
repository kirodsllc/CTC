#!/bin/bash

# Fix Database Path Script
set +e

echo "=========================================="
echo "  Fix Database Path Script"
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

# Check which database has tables
echo ""
echo "Step 1: Checking database files..."
if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_status "inventory.db has $TABLE_COUNT tables"
        USE_DB="inventory.db"
    fi
fi

if [ -z "$USE_DB" ] && [ -f "prisma/dev.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_status "dev.db has $TABLE_COUNT tables"
        USE_DB="dev.db"
    fi
fi

if [ -z "$USE_DB" ]; then
    if [ -f "prisma/inventory.db" ]; then
        USE_DB="inventory.db"
    else
        USE_DB="dev.db"
    fi
fi

print_info "Using database: $USE_DB"

# Update .env
echo ""
echo "Step 2: Updating .env file..."
sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:./prisma/$USE_DB\"|" .env
print_status ".env updated to use $USE_DB"

echo ""
echo "Current DATABASE_URL:"
grep DATABASE_URL .env

# Restart backend
echo ""
echo "Step 3: Restarting backend..."
pm2 restart backend > /dev/null 2>&1 || true
sleep 3
print_status "Backend restarted"

# Check status
echo ""
echo "Step 4: Checking backend status..."
sleep 2
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_warning "Backend status: $PM2_STATUS"
    fi
fi

# Test
echo ""
echo "Step 5: Testing backend..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is responding"
    curl -s http://localhost:3001/health
else
    print_warning "Backend not responding"
fi

# Check for database errors
echo ""
echo "Step 6: Checking for database errors..."
sleep 2
ERROR_COUNT=$(pm2 logs backend --lines 30 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    print_status "No database errors found"
else
    print_warning "Found $ERROR_COUNT database errors"
fi

pm2 save > /dev/null 2>&1 || true

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
