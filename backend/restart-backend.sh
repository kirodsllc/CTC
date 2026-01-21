#!/bin/bash

# Kill any existing backend processes
echo "🔴 Stopping existing backend processes..."
pkill -9 -f "tsx watch" 2>/dev/null
pkill -9 -f "node.*server" 2>/dev/null
sleep 2

# Start backend
echo "🚀 Starting backend server..."
cd /var/www/Dev-Koncepts/backend
PORT=3001 npm run dev
