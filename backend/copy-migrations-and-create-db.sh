#!/bin/bash

# Copy Migrations and Create Database Script
set +e

echo "=========================================="
echo "  Copy Migrations and Create Database"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_DIR="/var/www/nextapp/backend"
UPLOAD_DIR="/var/www/Upload"

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

cd $BACKEND_DIR || exit 1

# Install sqlite3
if ! command -v sqlite3 &> /dev/null; then
    apt update -qq > /dev/null 2>&1
    apt install -y sqlite3 > /dev/null 2>&1
fi

# Stop backend
echo ""
echo "Step 1: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
sleep 2

# Copy migrations from Upload folder if they exist
echo ""
echo "Step 2: Copying migrations..."
if [ -d "$UPLOAD_DIR/backend/prisma/migrations" ]; then
    print_info "Found migrations in Upload folder"
    mkdir -p prisma/migrations
    cp -r $UPLOAD_DIR/backend/prisma/migrations/* prisma/migrations/ 2>/dev/null || true
    print_status "Migrations copied"
elif [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    print_info "Migrations already exist in backend"
else
    print_warning "No migrations found, will use db push only"
fi

# Remove old database
echo ""
echo "Step 3: Removing old database..."
rm -f prisma/inventory.db prisma/inventory.db-journal prisma/dev.db prisma/dev.db-journal
print_status "Old database removed"

# Update .env
echo ""
echo "Step 4: Updating .env file..."
sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:./prisma/inventory.db"|' .env
print_status ".env updated"

# Create database file
echo ""
echo "Step 5: Creating database file..."
touch prisma/inventory.db
chmod 666 prisma/inventory.db
print_status "Database file created"

# Apply migrations if they exist
echo ""
echo "Step 6: Applying migrations..."
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    MIGRATION_DIRS=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort)
    MIGRATION_COUNT=$(echo "$MIGRATION_DIRS" | grep -c . || echo "0")
    print_info "Found $MIGRATION_COUNT migration directories"
    
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        echo "$MIGRATION_DIRS" | while read migration_dir; do
            MIGRATION_FILE="$migration_dir/migration.sql"
            MIGRATION_NAME=$(basename "$migration_dir")
            
            if [ -f "$MIGRATION_FILE" ]; then
                print_info "Applying: $MIGRATION_NAME"
                sqlite3 prisma/inventory.db < "$MIGRATION_FILE" 2>&1 | grep -i error || true
            fi
        done
        
        sleep 1
        
        # Check tables
        if command -v sqlite3 &> /dev/null; then
            TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
            
            if [ "$TABLE_COUNT" -gt 0 ]; then
                print_status "Migrations applied! Tables: $TABLE_COUNT"
            else
                print_warning "Migrations didn't create tables"
            fi
        fi
    fi
else
    print_warning "No migrations to apply"
fi

# Use db push as fallback or primary method
echo ""
echo "Step 7: Using db push to create tables..."
TABLE_COUNT=0
if command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
fi

if [ "$TABLE_COUNT" -eq 0 ]; then
    print_info "Running prisma db push with force reset..."
    rm -f prisma/inventory.db prisma/inventory.db-journal
    touch prisma/inventory.db
    chmod 666 prisma/inventory.db
    
    # Run db push and capture output
    DB_PUSH_OUTPUT=$(npx prisma db push --force-reset --skip-generate 2>&1)
    echo "$DB_PUSH_OUTPUT" | head -15
    
    sleep 2
    
    # Check tables again
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        
        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_status "db push created tables: $TABLE_COUNT"
        else
            print_error "db push still failed to create tables"
            print_info "Checking database file..."
            ls -lh prisma/inventory.db
            print_info "Trying to read database directly..."
            sqlite3 prisma/inventory.db ".tables" 2>&1 || echo "Cannot read database"
        fi
    fi
fi

# Final verification
echo ""
echo "Step 8: Final verification..."
if [ -f "prisma/inventory.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        
        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_status "✓ SUCCESS! Database has $TABLE_COUNT tables"
            echo ""
            echo "Tables in database:"
            sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null | head -30
        else
            print_error "✗ Database file exists but has NO tables"
            print_info "Database file info:"
            ls -lh prisma/inventory.db
            print_info "Trying to inspect database:"
            sqlite3 prisma/inventory.db ".schema" 2>&1 | head -20
            exit 1
        fi
    else
        DB_SIZE=$(stat -c%s prisma/inventory.db 2>/dev/null || stat -f%z prisma/inventory.db 2>/dev/null || echo "0")
        if [ "$DB_SIZE" -gt 1000 ]; then
            print_status "Database file exists with content"
        else
            print_error "Database file is too small"
            exit 1
        fi
    fi
else
    print_error "Database file was not created!"
    exit 1
fi

# Generate Prisma client
echo ""
echo "Step 9: Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
print_status "Prisma client generated"

# Restart backend
echo ""
echo "Step 10: Restarting backend..."
pm2 restart backend > /dev/null 2>&1 || pm2 start npm --name "backend" -- start > /dev/null 2>&1
sleep 3
print_status "Backend restarted"

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
