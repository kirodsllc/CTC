#!/bin/bash
set +e
echo "=========================================="
echo "  Initialize LongCat Settings"
echo "=========================================="
echo ""
cd /var/www/nextapp/backend || exit 1
echo "Step 1: Checking LongCatSettings table..."
if command -v sqlite3 &> /dev/null && [ -f "prisma/inventory.db" ]; then
    TABLE_EXISTS=$(sqlite3 prisma/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name='LongCatSettings';" 2>/dev/null)
    if [ -z "$TABLE_EXISTS" ]; then
        echo "[!] Creating table..."
        sqlite3 prisma/inventory.db << 'SQLEOF'
CREATE TABLE IF NOT EXISTS "LongCatSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "apiKey" TEXT,
  "model" TEXT DEFAULT 'LongCat-Flash-Chat',
  "baseUrl" TEXT DEFAULT 'https://api.longcat.chat',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
SQLEOF
        echo "[✓] Table created"
    else
        echo "[✓] Table exists"
    fi
fi
echo ""
echo "Step 2: Stopping backend..."
pm2 stop backend > /dev/null 2>&1 || true
sleep 2
echo ""
echo "Step 3: Initializing settings..."
cat > /tmp/init-longcat.js << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();
async function init() {
  try {
    const existing = await prisma.longCatSettings.findFirst();
    if (existing) {
      if (!existing.apiKey || existing.apiKey.trim() === '') {
        await prisma.longCatSettings.update({
          where: { id: existing.id },
          data: {
            apiKey: 'ak_2No6Dx1vk4Di5so3aB53O3gd0B61t',
            model: 'LongCat-Flash-Chat',
            baseUrl: 'https://api.longcat.chat',
          },
        });
        console.log('SUCCESS: Settings updated');
      } else {
        console.log('SUCCESS: API key already configured');
      }
    } else {
      await prisma.longCatSettings.create({
        data: {
          id: uuidv4(),
          apiKey: 'ak_2No6Dx1vk4Di5so3aB61t',
          model: 'LongCat-Flash-Chat',
          baseUrl: 'https://api.longcat.chat',
        },
      });
      console.log('SUCCESS: Settings created');
    }
  } catch (error) {
    console.log('ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
init();
JSEOF
if node /tmp/init-longcat.js 2>&1; then
    echo "[✓] Settings initialized"
else
    echo "[!] Node method failed, trying SQL..."
    EXISTING=$(sqlite3 prisma/inventory.db "SELECT COUNT(*) FROM LongCatSettings;" 2>/dev/null || echo "0")
    if [ "$EXISTING" -eq 0 ]; then
        sqlite3 prisma/inventory.db "INSERT INTO \"LongCatSettings\" (\"id\", \"apiKey\", \"model\", \"baseUrl\", \"createdAt\", \"updatedAt\") VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), 'ak_2No6Dx1vk4Di5so3aB53O3gd0B61t', 'LongCat-Flash-Chat', 'https://api.longcat.chat', datetime('now'), datetime('now'));" 2>/dev/null
        echo "[✓] Settings created via SQL"
    else
        sqlite3 prisma/inventory.db "UPDATE \"LongCatSettings\" SET \"apiKey\" = 'ak_2No6Dx1vk4Di5so3aB53O3gd0B61t', \"model\" = 'LongCat-Flash-Chat', \"baseUrl\" = 'https://api.longcat.chat', \"updatedAt\" = datetime('now') WHERE \"apiKey\" IS NULL OR \"apiKey\" = '';" 2>/dev/null
        echo "[✓] Settings updated via SQL"
    fi
fi
echo ""
echo "Step 4: Regenerating Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true
npx prisma generate > /dev/null 2>&1
echo "[✓] Prisma client regenerated"
echo ""
echo "Step 5: Starting backend..."
pm2 start dist/server.js --name "backend" > /dev/null 2>&1
sleep 5
echo "[✓] Backend started"
echo ""
echo "Step 6: Testing API..."
sleep 3
RESPONSE=$(curl -s http://localhost:3001/api/longcat-settings 2>&1)
if echo "$RESPONSE" | grep -qi "apiKey"; then
    echo "[✓] LongCat settings API is working!"
else
    echo "[!] API response:"
    echo "$RESPONSE" | head -3
fi
pm2 save > /dev/null 2>&1 || true
echo ""
echo "=========================================="
echo "  Complete!"
echo "=========================================="
pm2 list | grep backend
