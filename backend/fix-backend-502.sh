#!/bin/bash

# Fix 502 Bad Gateway - Backend Connection Issues
set +e

echo "=========================================="
echo "  Fix 502 Bad Gateway - Backend Issues"
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

# Step 1: Check PM2 status
echo ""
echo "Step 1: Checking PM2 status..."
pm2 list
echo ""

# Step 2: Check if backend is listening on port 3001
echo ""
echo "Step 2: Checking if backend is listening on port 3001..."
if command -v netstat &> /dev/null; then
    PORT_CHECK=$(netstat -tlnp 2>/dev/null | grep ":3001" || echo "")
elif command -v ss &> /dev/null; then
    PORT_CHECK=$(ss -tlnp | grep ":3001" || echo "")
fi

if [ -n "$PORT_CHECK" ]; then
    print_status "Backend is listening on port 3001"
    echo "$PORT_CHECK"
else
    print_error "Backend is NOT listening on port 3001!"
fi

# Step 3: Test backend directly
echo ""
echo "Step 3: Testing backend directly..."
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend responds on localhost:3001"
else
    print_error "Backend does NOT respond"
    curl -v http://localhost:3001/health 2>&1 | head -10
fi

# Step 4: Restart backend properly
echo ""
echo "Step 4: Restarting backend..."
cd $BACKEND_DIR || exit 1

pm2 kill > /dev/null 2>&1 || true
sleep 3

if [ -f "dist/server.js" ]; then
    pm2 start dist/server.js --name "backend"
else
    pm2 start npm --name "backend" -- start
fi

sleep 5

# Check status
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is now online"
    else
        print_error "Backend status: $PM2_STATUS"
        print_info "Recent logs:"
        pm2 logs backend --lines 20 --nostream 2>&1 | tail -20
    fi
fi

# Step 5: Test backend again
echo ""
echo "Step 5: Testing backend after restart..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is responding"
else
    print_error "Backend still not responding"
fi

# Step 6: Check and restart Nginx
echo ""
echo "Step 6: Restarting Nginx..."
if nginx -t > /dev/null 2>&1; then
    systemctl restart nginx
    sleep 2
    print_status "Nginx restarted"
else
    print_error "Nginx configuration has errors!"
    nginx -t 2>&1 | head -10
fi

# Step 7: Save PM2
echo ""
echo "Step 7: Saving PM2 configuration..."
pm2 save > /dev/null 2>&1 || true
print_status "PM2 saved"

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
pm2 list
echo ""
