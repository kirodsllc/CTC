#!/bin/bash

# Rebuild Backend Script
set +e

echo "=========================================="
echo "  Rebuild Backend Script"
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

# Step 1: Stop backend
echo ""
echo "Step 1: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
pm2 kill > /dev/null 2>&1 || true
sleep 2

# Step 2: Remove old dist folder
echo ""
echo "Step 2: Removing old build..."
rm -rf dist
print_status "Old build removed"

# Step 3: Fix source file if needed
echo ""
echo "Step 3: Checking and fixing source file..."
if [ -f "src/server.ts" ]; then
    # Check for broken CORS configuration
    if grep -q "if(, origin)" src/server.ts 2>/dev/null || grep -q "origin:.*\[" src/server.ts | grep -q ",,"; then
        print_warning "Found broken CORS configuration, fixing..."
        # Restore correct CORS configuration
        # The CORS should use the function format, not array format that was broken
        sed -i 's|origin:.*\[.*103\.60\.12\.157.*\]|origin: (origin, callback) => {\n    if (!origin) return callback(null, true);\n    if (origin.includes("103.60.12.157") || origin.includes("localhost")) {\n      callback(null, true);\n    } else {\n      callback(new Error("Not allowed by CORS"));\n    }\n  }|' src/server.ts 2>/dev/null || true
    fi
    
    # Verify source file syntax
    if grep -q "SyntaxError\|if(, origin)" src/server.ts 2>/dev/null; then
        print_error "Source file still has issues"
    else
        print_status "Source file looks good"
    fi
fi

# Step 4: Rebuild backend
echo ""
echo "Step 4: Rebuilding backend..."
if npm run build 2>&1 | tee /tmp/backend-build.log; then
    print_status "Backend rebuilt"
else
    print_error "Build failed!"
    cat /tmp/backend-build.log | tail -30
    exit 1
fi

# Step 5: Verify compiled code
echo ""
echo "Step 5: Verifying compiled code..."
if [ -f "dist/server.js" ]; then
    if node -c dist/server.js > /dev/null 2>&1; then
        print_status "Compiled code is valid"
    else
        print_error "Compiled code has syntax errors!"
        print_info "Checking line 37:"
        sed -n '35,40p' dist/server.js
        exit 1
    fi
else
    print_error "dist/server.js not found!"
    exit 1
fi

# Step 6: Start backend
echo ""
echo "Step 6: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5

# Step 7: Check status
echo ""
echo "Step 7: Checking backend status..."
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_error "Backend status: $PM2_STATUS"
        pm2 logs backend --lines 20 --nostream 2>&1 | tail -20
        exit 1
    fi
else
    print_error "Backend not found"
    exit 1
fi

# Step 8: Test backend
echo ""
echo "Step 8: Testing backend..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is responding"
    curl -s http://localhost:3001/health
else
    print_warning "Backend not responding"
fi

# Step 9: Save PM2
pm2 save > /dev/null 2>&1 || true

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
