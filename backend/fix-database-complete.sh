#!/bin/bash

# Complete Database Fix Script
# This script fixes all database issues and creates all tables properly

set +e  # Don't exit on error - we'll handle errors manually

echo "=========================================="
echo "  Complete Database Fix Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
BACKEND_DIR="/var/www/nextapp/backend"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Step 1: Navigate to backend directory
echo ""
echo "Step 1: Navigating to backend directory..."
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found at $BACKEND_DIR"
    exit 1
fi

cd $BACKEND_DIR
print_status "Changed to $BACKEND_DIR"

# Step 2: Stop backend
echo ""
echo "Step 2: Stopping backend..."
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "backend"; then
        pm2 stop backend > /dev/null 2>&1 || true
        sleep 2
        print_status "Backend stopped"
    else
        print_warning "Backend not running in PM2"
    fi
else
    print_warning "PM2 not found, skipping backend stop"
fi

# Step 3: Install sqlite3 if not available
echo ""
echo "Step 3: Checking for sqlite3..."
if ! command -v sqlite3 &> /dev/null; then
    print_info "Installing sqlite3..."
    apt update -qq > /dev/null 2>&1
    apt install -y sqlite3 > /dev/null 2>&1 || print_warning "Could not install sqlite3"
fi

if command -v sqlite3 &> /dev/null; then
    print_status "sqlite3 is available"
else
    print_warning "sqlite3 not available, some checks will be skipped"
fi

# Step 4: Backup existing database
echo ""
echo "Step 4: Backing up existing database..."
if [ -f "prisma/dev.db" ]; then
    BACKUP_FILE="prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)"
    cp prisma/dev.db "$BACKUP_FILE" 2>/dev/null || true
    if [ -f "$BACKUP_FILE" ]; then
        print_status "Database backed up to $BACKUP_FILE"
    fi
fi

# Step 5: Check current database state
echo ""
echo "Step 5: Checking current database state..."
if [ -f "prisma/dev.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    print_info "Current tables in database: $TABLE_COUNT"
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_info "Existing tables:"
        sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null | head -10
    fi
fi

# Step 6: Remove old database and migration files
echo ""
echo "Step 6: Cleaning up old database files..."
rm -f prisma/dev.db prisma/dev.db-journal 2>/dev/null || true
rm -f prisma/migrations/migration_lock.toml 2>/dev/null || true
print_status "Old database files removed"

# Step 7: Verify Prisma schema file exists
echo ""
echo "Step 7: Verifying Prisma schema..."
if [ ! -f "prisma/schema.prisma" ]; then
    print_error "Prisma schema file not found at prisma/schema.prisma"
    exit 1
fi

MODEL_COUNT=$(grep -c "^model " prisma/schema.prisma 2>/dev/null || echo "0")
print_info "Found $MODEL_COUNT models in schema"

if [ "$MODEL_COUNT" -eq 0 ]; then
    print_error "No models found in schema file!"
    exit 1
fi

# Step 8: Resolve any failed migrations
echo ""
echo "Step 8: Resolving failed migrations..."
npx prisma migrate resolve --rolled-back 20260101103010_init > /dev/null 2>&1 || true
print_status "Migration state cleaned"

# Step 9: Try db push method (most reliable)
echo ""
echo "Step 9: Creating database tables using db push..."
print_info "This will create all tables from the schema..."

if npx prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1; then
    print_status "Database tables created using db push"
    DB_PUSH_SUCCESS=true
else
    print_warning "db push failed, trying alternative method..."
    DB_PUSH_SUCCESS=false
fi

# Step 10: Verify tables were created
echo ""
echo "Step 10: Verifying tables were created..."
if [ -f "prisma/dev.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_status "Database created with $TABLE_COUNT tables"
        print_info "Tables created:"
        sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null | head -20
    else
        print_warning "Database file exists but no tables found"
        DB_PUSH_SUCCESS=false
    fi
else
    if [ ! -f "prisma/dev.db" ]; then
        print_warning "Database file was not created"
        DB_PUSH_SUCCESS=false
    fi
fi

# Step 11: Alternative method if db push didn't work
if [ "$DB_PUSH_SUCCESS" = false ]; then
    echo ""
    echo "Step 11: Trying alternative method - migrate reset..."
    print_info "Removing database and trying migrate reset..."
    
    rm -f prisma/dev.db prisma/dev.db-journal 2>/dev/null || true
    
    # Try migrate reset
    if npx prisma migrate reset --force --skip-seed > /dev/null 2>&1; then
        print_status "Database reset and migrations applied"
    else
        print_warning "migrate reset failed, trying migrate dev..."
        
        # Try migrate dev
        if npx prisma migrate dev --name fresh_start --skip-seed > /dev/null 2>&1; then
            print_status "Migrations created and applied"
        else
            print_error "All migration methods failed"
            print_info "Trying one more time with db push..."
            
            # Last attempt with db push
            rm -f prisma/dev.db prisma/dev.db-journal 2>/dev/null || true
            if npx prisma db push --force-reset --skip-generate > /dev/null 2>&1; then
                print_status "Database created on final attempt"
            else
                print_error "All database creation methods failed"
                exit 1
            fi
        fi
    fi
fi

# Step 12: Verify database again
echo ""
echo "Step 12: Final verification of database..."
if [ -f "prisma/dev.db" ]; then
    if command -v sqlite3 &> /dev/null; then
        TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
        
        if [ "$TABLE_COUNT" -gt 0 ]; then
            print_status "✓ Database verified: $TABLE_COUNT tables exist"
        else
            print_error "Database file exists but contains no tables"
            exit 1
        fi
    else
        DB_SIZE=$(stat -c%s prisma/dev.db 2>/dev/null || stat -f%z prisma/dev.db 2>/dev/null || echo "0")
        if [ "$DB_SIZE" -gt 1000 ]; then
            print_status "✓ Database file exists and has content (size: $DB_SIZE bytes)"
        else
            print_error "Database file is too small, may be empty"
            exit 1
        fi
    fi
else
    print_error "Database file was not created"
    exit 1
fi

# Step 13: Generate Prisma client
echo ""
echo "Step 13: Generating Prisma client..."
if npx prisma generate > /dev/null 2>&1; then
    print_status "Prisma client generated successfully"
else
    print_error "Failed to generate Prisma client"
    exit 1
fi

# Step 14: Restart backend
echo ""
echo "Step 14: Restarting backend..."
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "backend"; then
        pm2 restart backend > /dev/null 2>&1 || pm2 start backend > /dev/null 2>&1
        sleep 3
        print_status "Backend restarted"
    else
        print_info "Starting backend..."
        cd $BACKEND_DIR
        pm2 start npm --name "backend" -- start > /dev/null 2>&1 || pm2 start dist/server.js --name "backend" > /dev/null 2>&1
        sleep 3
        print_status "Backend started"
    fi
else
    print_warning "PM2 not found, please start backend manually"
fi

# Step 15: Verify backend is running
echo ""
echo "Step 15: Verifying backend status..."
sleep 3

if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "backend"; then
        PM2_STATUS=$(pm2 list 2>/dev/null | grep "backend" | awk '{print $10}' | head -1)
        if [ "$PM2_STATUS" = "online" ]; then
            print_status "Backend is running (status: online)"
        else
            print_warning "Backend status: $PM2_STATUS"
        fi
    else
        print_warning "Backend not found in PM2"
    fi
fi

# Step 16: Test API endpoint
echo ""
echo "Step 16: Testing API endpoint..."
sleep 2
if command -v curl &> /dev/null; then
    if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        print_status "Backend API is responding"
    elif curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        print_status "Backend API is responding (alternative endpoint)"
    else
        print_warning "Backend API health check failed (this is normal if backend needs more time)"
    fi
else
    print_warning "curl not available, skipping API test"
fi

# Final Summary
echo ""
echo "=========================================="
echo -e "${GREEN}  Database Fix Complete!${NC}"
echo "=========================================="
echo ""

if [ -f "prisma/dev.db" ] && command -v sqlite3 &> /dev/null; then
    TABLE_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
    echo "Database Status:"
    echo "  - Database file: prisma/dev.db"
    echo "  - Tables created: $TABLE_COUNT"
    echo ""
    
    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo "Tables in database:"
        sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null | while read table; do
            echo "  - $table"
        done
        echo ""
    fi
fi

echo "Useful commands:"
echo "  - View backend logs: pm2 logs backend"
echo "  - Check backend status: pm2 status"
echo "  - Restart backend: pm2 restart backend"
echo "  - Check database tables: sqlite3 prisma/dev.db '.tables'"
echo "  - View table structure: sqlite3 prisma/dev.db '.schema TableName'"
echo ""

# Show recent backend logs
if command -v pm2 &> /dev/null; then
    echo "Recent backend logs:"
    pm2 logs backend --lines 5 --nostream 2>/dev/null || echo "  (No logs available yet)"
    echo ""
fi

print_status "Fix script completed successfully!"
echo ""
