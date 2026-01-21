#!/bin/bash

# Force Create Tables Script
set +e

echo "=========================================="
echo "  Force Create Tables Script"
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

# Stop backend
pm2 stop backend > /dev/null 2>&1 || true
sleep 2

# Remove database completely
echo ""
echo "Removing database file..."
rm -f prisma/inventory.db prisma/inventory.db-journal
print_status "Database removed"

# Update .env to use relative path
echo ""
echo "Updating .env..."
sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:./prisma/inventory.db"|' .env
print_status "Updated DATABASE_URL"

# Check if migrations exist
echo ""
echo "Checking for migrations..."
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    print_info "Found migrations directory"
    
    # Remove database and try migrate deploy
    rm -f prisma/inventory.db prisma/inventory.db-journal
    
    # Apply migrations
    echo ""
    echo "Applying migrations..."
    npx prisma migrate deploy 2>&1
    
    # Check if tables were created
    sleep 1
    if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_status "Migrations applied! Tables: $TABLE_COUNT"
        else
            print_warning "Migrations didn't create tables, trying db push..."
            npx prisma db push --accept-data-loss --skip-generate 2>&1 | head -10
        fi
    fi
else
    print_warning "No migrations found, using db push..."
    npx prisma db push --force-reset --skip-generate 2>&1 | head -10
fi

# Final check and force create if needed
echo ""
echo "Final verification..."
sleep 2

if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    
    if [ "$TABLE_COUNT" -eq 0 ]; then
        print_warning "No tables found. Trying manual SQL execution..."
        
        # Get the first migration SQL file
        FIRST_MIGRATION=$(find prisma/migrations -name "migration.sql" -type f | head -1)
        
        if [ -n "$FIRST_MIGRATION" ] && [ -f "$FIRST_MIGRATION" ]; then
            print_info "Found migration SQL: $FIRST_MIGRATION"
            print_info "Executing SQL directly..."
            
            # Remove database
            rm -f prisma/inventory.db prisma/inventory.db-journal
            
            # Execute SQL
            sqlite3 prisma/inventory.db < "$FIRST_MIGRATION" 2>&1
            
            # Check again
            TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
            
            if [ "$TABLE_COUNT" -gt 0 ]; then
                print_status "SUCCESS! Tables created via SQL: $TABLE_COUNT"
            else
                print_error "SQL execution didn't create tables"
                print_info "Migration SQL content (first 50 lines):"
                head -50 "$FIRST_MIGRATION"
            fi
        else
            print_error "No migration SQL files found"
        fi
    else
        print_status "SUCCESS! Database has $TABLE_COUNT tables"
    fi
    
    # Show tables
    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo ""
        echo "Tables in database:"
        sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null | head -30
    fi
fi

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
print_status "Prisma client generated"

# Restart backend
echo ""
echo "Restarting backend..."
pm2 restart backend > /dev/null 2>&1 || pm2 start npm --name "backend" -- start > /dev/null 2>&1
sleep 3
print_status "Backend restarted"

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
