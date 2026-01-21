#!/bin/bash

# Fix Prisma Database Connection Script
# This script ensures Prisma uses the correct database file

set +e

echo "=========================================="
echo "  Fix Prisma Database Connection"
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

# Step 1: Check which database files exist
echo ""
echo "Step 1: Checking database files..."
if [ -f "prisma/inventory.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        print_info "inventory.db: $TABLE_COUNT tables"
    fi
fi

if [ -f "prisma/dev.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        print_info "dev.db: $TABLE_COUNT tables"
        
        if [ "$TABLE_COUNT" -eq 0 ]; then
            print_warning "dev.db exists but has no tables - this might be the problem!"
        fi
    fi
fi

# Step 2: Stop backend
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
pm2 kill > /dev/null 2>&1 || true
sleep 2

# Step 3: Remove dev.db if it exists and has no tables
echo ""
echo "Step 3: Cleaning up database files..."
if [ -f "prisma/dev.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        if [ "$TABLE_COUNT" -eq 0 ]; then
            print_info "Removing empty dev.db file..."
            rm -f prisma/dev.db prisma/dev.db-journal
            print_status "Empty dev.db removed"
        fi
    else
        # If sqlite3 not available, backup and remove dev.db
        print_warning "Cannot verify dev.db, backing it up and removing..."
        mv prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        rm -f prisma/dev.db-journal
    fi
fi

# Step 4: Ensure .env points to inventory.db
echo ""
echo "Step 4: Updating .env file..."
cat > .env << 'ENVEOF'
DATABASE_URL="file:./prisma/inventory.db"
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://103.60.12.157
ENVEOF
print_status ".env file updated"

# Show .env
echo ""
echo "Current .env DATABASE_URL:"
grep DATABASE_URL .env

# Step 5: Remove Prisma client completely
echo ""
echo "Step 5: Removing Prisma client..."
rm -rf node_modules/.prisma 2>/dev/null || true
rm -rf node_modules/@prisma/client 2>/dev/null || true
print_status "Prisma client removed"

# Step 6: Generate Prisma client fresh
echo ""
echo "Step 6: Generating Prisma client..."
if npx prisma generate > /tmp/prisma-gen.log 2>&1; then
    print_status "Prisma client generated"
    
    # Check the generated client to see what database it's pointing to
    if [ -f "node_modules/.prisma/client/index.js" ]; then
        print_info "Prisma client files created"
    fi
else
    print_error "Failed to generate Prisma client"
    cat /tmp/prisma-gen.log | tail -10
    exit 1
fi

# Step 7: Verify database path in Prisma
echo ""
echo "Step 7: Verifying database connection..."
# Test with Prisma directly
if npx prisma db execute --stdin <<< "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;" 2>&1 | grep -q "Part\|Category"; then
    print_status "Prisma can access database tables"
else
    print_warning "Prisma database test inconclusive"
fi

# Step 8: Rebuild backend
echo ""
echo "Step 8: Rebuilding backend..."
rm -rf dist
if npm run build > /tmp/build.log 2>&1; then
    print_status "Backend rebuilt"
else
    print_warning "Build had warnings"
    grep "error TS" /tmp/build.log | head -3
fi

# Step 9: Start backend
echo ""
echo "Step 9: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5

# Step 10: Check status
echo ""
echo "Step 10: Checking backend status..."
sleep 2
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_warning "Backend status: $PM2_STATUS"
    fi
fi

# Step 11: Test API
echo ""
echo "Step 11: Testing API..."
sleep 3
pm2 flush > /dev/null 2>&1 || true
sleep 1

# Test parts endpoint
RESPONSE=$(curl -s http://localhost:3001/api/parts?limit=1 2>&1)
if echo "$RESPONSE" | grep -q "table.*does not exist"; then
    print_error "Database errors still occurring"
    echo "$RESPONSE" | head -5
else
    if echo "$RESPONSE" | grep -q "data\|error"; then
        print_status "API is working!"
    else
        print_warning "API response unclear"
    fi
fi

# Check for errors in logs
sleep 2
ERROR_COUNT=$(pm2 logs backend --lines 20 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    print_status "No database errors in recent logs!"
else
    print_warning "Found $ERROR_COUNT database errors"
    print_info "Checking which database Prisma is using..."
    pm2 logs backend --lines 30 --nostream 2>&1 | grep -i "database\|resolved" | head -5
fi

# Save PM2
pm2 save > /dev/null 2>&1 || true

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""

echo "Database files:"
ls -lh prisma/*.db 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'

echo ""
echo "If errors persist, check:"
echo "  - pm2 logs backend --lines 50"
echo "  - Verify .env DATABASE_URL: cat .env | grep DATABASE"
echo ""

