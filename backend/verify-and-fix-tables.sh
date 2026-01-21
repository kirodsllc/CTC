#!/bin/bash

# Verify and Fix Tables Script
set +e

echo "=========================================="
echo "  Verify and Fix Tables Script"
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

# Install sqlite3 if needed
if ! command -v sqlite3 &> /dev/null; then
    apt update -qq > /dev/null 2>&1
    apt install -y sqlite3 > /dev/null 2>&1
fi

# Check current database state
echo ""
echo "Step 1: Checking current database state..."
if [ -f "prisma/inventory.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        print_info "Current tables in database: $TABLE_COUNT"
        
        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_status "Database has tables! Listing them:"
            echo ""
            sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null
            echo ""
            print_status "Database is ready!"
            exit 0
        else
            print_warning "Database file exists but has NO tables"
        fi
    fi
else
    print_warning "Database file does not exist"
fi

# Stop backend
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
sleep 2

# Check for migrations and apply them
echo ""
echo "Step 3: Applying migrations from SQL files..."
if [ -d "prisma/migrations" ]; then
    # Remove database
    rm -f prisma/inventory.db prisma/inventory.db-journal
    
    # Find and apply all migration SQL files in order
    MIGRATION_FILES=$(find prisma/migrations -name "migration.sql" -type f | sort)
    
    if [ -n "$MIGRATION_FILES" ]; then
        MIGRATION_COUNT=$(echo "$MIGRATION_FILES" | wc -l)
        print_info "Found $MIGRATION_COUNT migration SQL files"
        
        echo "$MIGRATION_FILES" | while read migration_file; do
            if [ -f "$migration_file" ]; then
                MIGRATION_NAME=$(basename $(dirname "$migration_file"))
                print_info "Applying: $MIGRATION_NAME"
                sqlite3 prisma/inventory.db < "$migration_file" 2>&1
            fi
        done
        
        # Verify tables were created
        sleep 1
        if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
            TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
            
            if [ "$TABLE_COUNT" -gt 0 ]; then
                print_status "SUCCESS! Tables created: $TABLE_COUNT"
                echo ""
                echo "Tables in database:"
                sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null
            else
                print_warning "Migrations didn't create tables"
            fi
        fi
    fi
fi

# If still no tables, try db push
echo ""
echo "Step 4: Final attempt with db push..."
if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    
    if [ "$TABLE_COUNT" -eq 0 ]; then
        rm -f prisma/inventory.db prisma/inventory.db-journal
        
        print_info "Running db push..."
        npx prisma db push --accept-data-loss --skip-generate 2>&1
        
        sleep 2
        
        # Check again
        if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
            TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
            
            if [ "$TABLE_COUNT" -gt 0 ]; then
                print_status "SUCCESS! Tables created: $TABLE_COUNT"
            fi
        fi
    fi
fi

# Final verification
echo ""
echo "Step 5: Final verification..."
if [ -f "prisma/inventory.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_status "✓ VERIFIED: Database has $TABLE_COUNT tables"
        echo ""
        echo "All tables:"
        sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null
    else
        print_error "✗ FAILED: Database still has no tables"
        print_info "Checking database file:"
        ls -lh prisma/inventory.db 2>/dev/null
        exit 1
    fi
else
    print_error "Cannot verify database"
    exit 1
fi

# Generate Prisma client
echo ""
echo "Step 6: Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
print_status "Prisma client generated"

# Restart backend
echo ""
echo "Step 7: Restarting backend..."
pm2 restart backend > /dev/null 2>&1 || pm2 start npm --name "backend" -- start > /dev/null 2>&1
sleep 3
print_status "Backend restarted"

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
