#!/bin/bash

# Direct CORS Fix Script
set +e

echo "=========================================="
echo "  Direct CORS Fix Script"
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
echo ""
echo "Step 1: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
pm2 delete backend > /dev/null 2>&1 || true
pm2 kill > /dev/null 2>&1 || true
sleep 2

# Backup
echo ""
echo "Step 2: Backing up server.ts..."
cp src/server.ts src/server.ts.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Fix - copy from Upload folder
echo ""
echo "Step 3: Fixing CORS configuration..."
if [ -f "/var/www/Upload/backend/src/server.ts" ]; then
    print_info "Copying correct server.ts from Upload folder..."
    cp /var/www/Upload/backend/src/server.ts src/server.ts
    print_status "server.ts replaced from Upload folder"
else
    print_error "Cannot find server.ts in Upload folder!"
    print_info "Trying to fix manually with Python..."
    
    python3 << 'PYTHONEOF'
import re

file_path = '/var/www/nextapp/backend/src/server.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

correct_cors = '''// Middleware - CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          const serverOrigin = process.env.SERVER_ORIGIN || 'http://103.60.12.157';
          if (origin.startsWith(serverOrigin) || origin.includes('103.60.12.157')) {
            callback(null, true);
            return;
          }
        }
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));'''

cors_start = content.find('// Middleware - CORS configuration')
express_json_start = content.find('app.use(express.json')

if cors_start != -1 and express_json_start != -1:
    before_cors = content[:cors_start]
    after_express = content[express_json_start:]
    new_content = before_cors + correct_cors + '\n' + after_express
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Fixed')
PYTHONEOF
    
    if [ $? -eq 0 ]; then
        print_status "CORS fixed with Python"
    else
        print_error "All fix methods failed"
        exit 1
    fi
fi

# Verify
echo ""
echo "Step 4: Verifying fix..."
if grep -q "origin: (origin, callback)" src/server.ts 2>/dev/null && ! grep -q "if(, origin)" src/server.ts 2>/dev/null; then
    print_status "CORS configuration looks correct"
else
    print_error "CORS still broken!"
    exit 1
fi

# Remove old build
echo ""
echo "Step 5: Removing old build..."
rm -rf dist
print_status "Old build removed"

# Rebuild
echo ""
echo "Step 6: Rebuilding backend..."
if npm run build 2>&1 | tee /tmp/build.log; then
    print_status "Backend rebuilt"
else
    print_error "Build failed!"
    grep "error TS" /tmp/build.log | head -5
    exit 1
fi

# Verify compiled
echo ""
echo "Step 7: Verifying compiled code..."
if node -c dist/server.js > /dev/null 2>&1; then
    print_status "Compiled code is valid"
else
    print_error "Compiled code has errors!"
    exit 1
fi

# Start backend
echo ""
echo "Step 8: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5

# Check status
echo ""
echo "Step 9: Checking status..."
if pm2 list | grep -q "backend"; then
    PM2_STATUS=$(pm2 list | grep "backend" | awk '{print $10}' | head -1)
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "Backend is online"
    else
        print_error "Backend status: $PM2_STATUS"
        pm2 logs backend --lines 15 --nostream 2>&1 | tail -15
        exit 1
    fi
else
    print_error "Backend not found"
    exit 1
fi

# Test
echo ""
echo "Step 10: Testing backend..."
sleep 2
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is responding"
    curl -s http://localhost:3001/health
else
    print_warning "Backend not responding yet"
fi

pm2 save > /dev/null 2>&1 || true

echo ""
echo "=========================================="
echo -e "${GREEN}  Complete!${NC}"
echo "=========================================="
echo ""
