-- ============================================
-- VERIFY SUPPLIER VOUCHER DATA
-- Run this in Prisma Studio or SQLite CLI
-- ============================================

-- 1. Check if supplier exists
SELECT * FROM Supplier WHERE code LIKE 'SUP-%' ORDER BY createdAt DESC LIMIT 5;

-- 2. Check if supplier account exists (301XXX)
SELECT 
  a.id,
  a.code,
  a.name,
  a.openingBalance,
  a.currentBalance,
  s.name as subgroupName,
  mg.name as mainGroupName,
  mg.type as mainGroupType
FROM Account a
JOIN Subgroup s ON a.subgroupId = s.id
JOIN MainGroup mg ON s.mainGroupId = mg.id
WHERE a.code LIKE '301%'
ORDER BY a.code DESC
LIMIT 10;

-- 3. Check if vouchers exist for opening balance
SELECT 
  v.id,
  v.voucherNumber,
  v.type,
  v.date,
  v.status,
  v.narration,
  v.totalDebit,
  v.totalCredit,
  v.createdBy,
  v.approvedBy
FROM Voucher v
WHERE v.narration LIKE '%Supplier Opening Balance%'
ORDER BY v.createdAt DESC
LIMIT 5;

-- 4. Check voucher entries for supplier account
-- Replace 'ACCOUNT_ID_HERE' with the account ID from query #2
SELECT 
  ve.id,
  ve.accountId,
  ve.accountName,
  ve.description,
  ve.debit,
  ve.credit,
  ve.sortOrder,
  v.voucherNumber,
  v.status,
  v.date
FROM VoucherEntry ve
JOIN Voucher v ON ve.voucherId = v.id
WHERE ve.accountName LIKE '%jon%'
  OR ve.description LIKE '%jon%'
ORDER BY v.date DESC
LIMIT 10;

-- 5. Check Owner Capital account entries
SELECT 
  ve.id,
  ve.accountId,
  ve.accountName,
  ve.description,
  ve.debit,
  ve.credit,
  v.voucherNumber,
  v.status,
  v.date
FROM VoucherEntry ve
JOIN Voucher v ON ve.voucherId = v.id
WHERE ve.accountName LIKE '%OWNER CAPITAL%'
ORDER BY v.date DESC
LIMIT 10;

-- 6. Summary: Count vouchers by status
SELECT 
  status,
  COUNT(*) as count,
  SUM(totalDebit) as totalDebits,
  SUM(totalCredit) as totalCredits
FROM Voucher
GROUP BY status;

-- 7. Summary: Check if voucher entries match voucher totals
SELECT 
  v.voucherNumber,
  v.totalDebit as voucherTotalDebit,
  v.totalCredit as voucherTotalCredit,
  SUM(ve.debit) as entriesTotalDebit,
  SUM(ve.credit) as entriesTotalCredit,
  CASE 
    WHEN v.totalDebit = SUM(ve.debit) AND v.totalCredit = SUM(ve.credit) 
    THEN '✅ BALANCED'
    ELSE '❌ MISMATCH'
  END as status
FROM Voucher v
LEFT JOIN VoucherEntry ve ON v.id = ve.voucherId
GROUP BY v.id, v.voucherNumber, v.totalDebit, v.totalCredit
ORDER BY v.createdAt DESC
LIMIT 10;
