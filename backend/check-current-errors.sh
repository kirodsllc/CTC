#!/bin/bash

# Check Current Errors Script
# This script checks for real-time database errors

set +e

echo "=========================================="
echo "  Check Current Database Errors"
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

# Clear old logs
echo ""
echo "Clearing old logs..."
pm2 flush > /dev/null 2>&1 || true
sleep 2

# Test API endpoints to trigger any errors
echo ""
echo "Testing API endpoints..."
echo ""

ENDPOINTS=(
    "/api/parts?limit=1"
    "/api/dropdowns/categories"
    "/api/suppliers?limit=1"
    "/api/kits?limit=1"
    "/api/inventory/dashboard"
)

for endpoint in "${ENDPOINTS[@]}"; do
    print_info "Testing: $endpoint"
    curl -s "http://localhost:3001$endpoint" > /dev/null 2>&1 || true
    sleep 0.5
done

# Wait a moment for logs to be written
sleep 2

# Check for errors
echo ""
echo "Checking for database errors..."
ERROR_COUNT=$(pm2 logs backend --lines 50 --nostream 2>&1 | grep -i "table.*does not exist" | wc -l || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    print_status "No database errors found!"
    echo ""
    echo "All API endpoints are working correctly."
else
    print_warning "Found $ERROR_COUNT database errors"
    echo ""
    echo "Recent database errors:"
    pm2 logs backend --lines 50 --nostream 2>&1 | grep -i "table.*does not exist" | head -5
    echo ""
    print_info "These errors might be from old requests. Check if they persist."
fi

# Test if backend is actually working
echo ""
echo "Testing if backend is working..."
if curl -s -f http://localhost:3001/api/parts?limit=1 | grep -q "data\|error" 2>/dev/null; then
    print_status "Parts API is returning data"
else
    RESPONSE=$(curl -s http://localhost:3001/api/parts?limit=1 2>&1 | head -3)
    print_warning "Parts API response: $RESPONSE"
fi

echo ""
echo "=========================================="
echo "  Check Complete"
echo "=========================================="
echo ""

echo "Backend Status:"
pm2 list | grep backend

echo ""
echo "If errors persist, the Prisma client might need to be regenerated again."
echo "Try: cd /var/www/nextapp/backend && npx prisma generate && pm2 restart backend"
echo ""

