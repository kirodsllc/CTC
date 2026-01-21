#!/bin/bash

# Script to check for items with the same master part number
# and verify they appear in the item list

DB_PATH="prisma/inventory.db"

echo "=========================================="
echo "Checking for items with same master part number"
echo "=========================================="
echo ""

# Find master part numbers that have multiple parts
echo "Master Part Numbers with Multiple Items:"
echo "----------------------------------------"
sqlite3 "$DB_PATH" <<EOF
SELECT 
    mp.masterPartNo,
    COUNT(p.id) as item_count,
    GROUP_CONCAT(p.partNo, ', ') as part_numbers
FROM MasterPart mp
INNER JOIN Part p ON p.masterPartId = mp.id
GROUP BY mp.masterPartNo
HAVING COUNT(p.id) > 1
ORDER BY item_count DESC, mp.masterPartNo;
EOF

echo ""
echo "=========================================="
echo "All Items with Master Part Numbers:"
echo "----------------------------------------"
sqlite3 "$DB_PATH" <<EOF
SELECT 
    p.id,
    p.partNo,
    mp.masterPartNo,
    p.description,
    p.status
FROM Part p
LEFT JOIN MasterPart mp ON p.masterPartId = mp.id
WHERE mp.masterPartNo IS NOT NULL
ORDER BY mp.masterPartNo, p.partNo;
EOF

echo ""
echo "=========================================="
echo "Sample: First Master Part with Multiple Items:"
echo "----------------------------------------"
sqlite3 "$DB_PATH" <<EOF
SELECT 
    mp.masterPartNo,
    p.id,
    p.partNo,
    p.description,
    p.status
FROM MasterPart mp
INNER JOIN Part p ON p.masterPartId = mp.id
WHERE mp.masterPartNo = (
    SELECT mp2.masterPartNo
    FROM MasterPart mp2
    INNER JOIN Part p2 ON p2.masterPartId = mp2.id
    GROUP BY mp2.masterPartNo
    HAVING COUNT(p2.id) > 1
    LIMIT 1
)
ORDER BY p.partNo;
EOF

echo ""
echo "=========================================="
echo "Total Items: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Part;")"
echo "Items with Master Part: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Part WHERE masterPartId IS NOT NULL;")"
echo "Unique Master Parts: $(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT masterPartId) FROM Part WHERE masterPartId IS NOT NULL;")"
echo "=========================================="

