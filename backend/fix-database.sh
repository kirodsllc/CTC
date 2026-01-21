#!/bin/bash

# Database Migration Fix Script
# This script fixes failed migrations and recreates the database

set -e  # Exit on error

echo "=========================================="
echo "  Database Migration Fix Script"
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
if pm2 list | grep -q "backend" > /dev/null 2>&1; then
    pm2 stop backend > /dev/null 2>&1 || true
    sleep 2
    print_status "Backend stopped"
else
    print_warning "Backend not running in PM2"
fi

# Step 3: Check current migration status
echo ""
echo "Step 3: Checking migration status..."
if npx prisma migrate status > /dev/null 2>&1; then
    print_info "Migration status checked"
else
    print_warning "Could not check migration status, continuing..."
fi

# Step 4: Backup existing database (if exists)
echo ""
echo "Step 4: Backing up existing database..."
if [ -f "prisma/dev.db" ]; then
    BACKUP_FILE="prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)"
    cp prisma/dev.db "$BACKUP_FILE" 2>/dev/null || true
    if [ -f "$BACKUP_FILE" ]; then
        print_status "Database backed up to $BACKUP_FILE"
    else
        print_warning "Could not backup database, continuing..."
    fi
else
    print_info "No existing database file found"
fi

# Step 5: Try to resolve failed migration first
echo ""
echo "Step 5: Attempting to resolve failed migration..."
if npx prisma migrate resolve --rolled-back 20260101103010_init > /dev/null 2>&1; then
    print_status "Failed migration resolved"
else
    print_warning "Could not resolve migration, will reset database instead"
fi

# Step 6: Reset database and apply migrations
echo ""
echo "Step 6: Resetting database and applying migrations..."
print_info "This will delete all existing data and recreate tables..."

# Remove database files
rm -f prisma/dev.db prisma/dev.db-journal 2>/dev/null || true
print_status "Old database files removed"

# Apply migrations
print_info "Applying all migrations..."
if npx prisma migrate deploy > /dev/null 2>&1; then
    print_status "Migrations applied successfully"
else
    print_warning "migrate deploy failed, trying migrate reset..."
    if npx prisma migrate reset --force > /dev/null 2>&1; then
        print_status "Database reset and migrations applied"
    else
        print_error "Failed to apply migrations"
        exit 1
    fi
fi

# Step 7: Generate Prisma client
echo ""
echo "Step 7: Generating Prisma client..."
if npx prisma generate > /dev/null 2>&1; then
    print_status "Prisma client generated"
else
    print_error "Failed to generate Prisma client"
    exit 1
fi

# Step 8: Verify database tables
echo ""
echo "Step 8: Verifying database tables..."
if [ -f "prisma/dev.db" ]; then
    DB_SIZE=$(stat -f%z prisma/dev.db 2>/dev/null || stat -c%s prisma/dev.db 2>/dev/null || echo "0")
    if [ "$DB_SIZE" -gt 0 ]; then
        print_status "Database file created successfully (size: $DB_SIZE bytes)"
    else
        print_warning "Database file exists but is empty"
    fi
else
    print_error "Database file not found after migration"
    exit 1
fi

# Step 9: Restart backend
echo ""
echo "Step 9: Restarting backend..."
if pm2 restart backend > /dev/null 2>&1; then
    sleep 3
    print_status "Backend restarted"
else
    print_warning "PM2 restart failed, trying start..."
    if pm2 start backend > /dev/null 2>&1; then
        print_status "Backend started"
    else
        print_warning "Could not restart backend, please start manually: pm2 start backend"
    fi
fi

# Step 10: Check backend status
echo ""
echo "Step 10: Verifying backend status..."
sleep 3

if pm2 list | grep -q "backend" > /dev/null 2>&1; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is running (status: online)"
    else
        print_warning "Backend status: $PM2_STATUS"
    fi
else
    print_warning "Backend not found in PM2"
fi

# Step 11: Test API
echo ""
echo "Step 11: Testing API endpoint..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend API is responding"
elif curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    print_status "Backend API is responding (alternative endpoint)"
else
    print_warning "Backend API health check failed"
    print_info "Check logs with: pm2 logs backend"
fi

# Final Summary
echo ""
echo "=========================================="
echo -e "${GREEN}  Database Fix Complete!${NC}"
echo "=========================================="
echo ""

echo "Database has been reset and all migrations applied."
echo "All tables should now exist."
echo ""

echo "Useful commands:"
echo "  - View backend logs: pm2 logs backend"
echo "  - Check backend status: pm2 status"
echo "  - Restart backend: pm2 restart backend"
echo "  - Check database: sqlite3 prisma/dev.db '.tables'"
echo ""

# Show recent backend logs
echo "Recent backend logs:"
pm2 logs backend --lines 5 --nostream 2>/dev/null || echo "  (No logs available yet)"

echo ""
print_status "Fix script completed!"
echo ""
