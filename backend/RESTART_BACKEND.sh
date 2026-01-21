#!/bin/bash

echo "🔄 RESTARTING BACKEND SERVER..."
echo ""

# Step 1: Kill all existing processes
echo "1️⃣  Killing existing processes..."
pkill -9 -f "tsx.*server" 2>/dev/null
pkill -9 -f "node.*server" 2>/dev/null
pkill -9 tsx 2>/dev/null
pkill -9 node 2>/dev/null

# Kill processes on ports 3001 and 3002
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3002 2>/dev/null | xargs kill -9 2>/dev/null

echo "   ✅ Processes killed"
echo ""

# Step 2: Wait a moment
echo "2️⃣  Waiting for ports to be released..."
sleep 2
echo "   ✅ Ready"
echo ""

# Step 3: Check if ports are free
echo "3️⃣  Checking ports..."
PORT_3001=$(lsof -ti:3001 2>/dev/null)
PORT_3002=$(lsof -ti:3002 2>/dev/null)

if [ -n "$PORT_3001" ]; then
  echo "   ⚠️  WARNING: Port 3001 still in use by process $PORT_3001"
  echo "   Run: kill -9 $PORT_3001"
  exit 1
fi

if [ -n "$PORT_3002" ]; then
  echo "   ⚠️  WARNING: Port 3002 still in use by process $PORT_3002"
  echo "   Run: kill -9 $PORT_3002"
  exit 1
fi

echo "   ✅ Ports 3001 and 3002 are free"
echo ""

# Step 4: Start the backend
echo "4️⃣  Starting backend server..."
cd /var/www/Dev-Koncepts/backend
PORT=3001 npm run dev 2>&1 | tee /tmp/backend.log &
BACKEND_PID=$!

echo "   ✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Step 5: Wait and check if it's running
echo "5️⃣  Waiting for server to start..."
sleep 5

# Check if process is still running
if ps -p $BACKEND_PID > /dev/null 2>&1; then
  echo "   ✅ Backend is running!"
  echo ""
  echo "📋 Server Info:"
  echo "   PID: $BACKEND_PID"
  echo "   Port: 3001"
  echo "   URL: http://localhost:3001"
  echo ""
  echo "📝 Logs: tail -f /tmp/backend.log"
  echo ""
  echo "🎉 BACKEND STARTED SUCCESSFULLY!"
else
  echo "   ❌ Backend failed to start!"
  echo ""
  echo "📋 Check logs:"
  echo "   tail -50 /tmp/backend.log"
  echo ""
  exit 1
fi
