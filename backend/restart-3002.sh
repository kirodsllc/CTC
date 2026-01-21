#!/bin/bash

echo "🔄 RESTARTING BACKEND ON PORT 3002..."
echo ""

# Kill existing processes
echo "1️⃣  Killing processes on port 3002..."
lsof -ti:3002 | xargs kill -9 2>/dev/null
pkill -9 -f "tsx.*server" 2>/dev/null
pkill -9 -f "node.*server" 2>/dev/null

sleep 2
echo "   ✅ Killed"
echo ""

# Check if port is free
echo "2️⃣  Checking port 3002..."
if lsof -ti:3002 > /dev/null 2>&1; then
  echo "   ❌ Port 3002 still in use!"
  lsof -i:3002
  exit 1
fi
echo "   ✅ Port is free"
echo ""

# Start backend
echo "3️⃣  Starting backend on port 3002..."
cd /var/www/Dev-Koncepts/backend
PORT=3002 npm run dev 2>&1 | tee /tmp/backend-3002.log &
BACKEND_PID=$!

sleep 3
echo "   ✅ Started (PID: $BACKEND_PID)"
echo ""

# Test
echo "4️⃣  Testing server..."
sleep 3
curl -s http://localhost:3002/api/health && echo "" || echo "⚠️  Server not responding yet..."

echo ""
echo "✅ DONE!"
echo ""
echo "📋 Server Info:"
echo "   Port: 3002"
echo "   URL: http://localhost:3002"
echo "   Logs: tail -f /tmp/backend-3002.log"
echo ""
