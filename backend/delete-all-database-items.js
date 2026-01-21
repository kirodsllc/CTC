const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('==========================================');
    console.log('  DELETE ALL DATABASE ITEMS');
    console.log('  DPO, PO, Journals, Items, Everything');
    console.log('==========================================\n');
    
    console.log('⚠️  WARNING: This will delete ALL data from the database!');
    console.log('   - All DPO (Direct Purchase Orders)');
    console.log('   - All PO (Purchase Orders)');
    console.log('   - All Journals and Journal Entries');
    console.log('   - All Vouchers');
    console.log('   - All Sales Invoices, Quotations, Inquiries');
    console.log('   - All Stock Movements');
    console.log('   - All Parts/Items');
    console.log('   - All Transfers, Adjustments');
    console.log('   - All Kits');
    console.log('   - All Price History');
    console.log('   - All Returns');
    console.log('   - All Attributes: Brands, Categories, Subcategories, Applications');
    console.log('   - All Master Parts');
    console.log('   - All Stores, Racks, Shelves');
    console.log('   - All Customers, Suppliers');
    console.log('   - All Expense Types');
    console.log('   - All Accounting Structure (Accounts, Groups)');
    console.log('   - And everything else...\n');

    // Get counts before deletion
    const counts = {
      dpo: await prisma.directPurchaseOrder.count(),
      dpoItems: await prisma.directPurchaseOrderItem.count(),
      dpoExpenses: await prisma.directPurchaseOrderExpense.count(),
      dpoReturns: await prisma.directPurchaseOrderReturn.count(),
      dpoReturnItems: await prisma.directPurchaseOrderReturnItem.count(),
      po: await prisma.purchaseOrder.count(),
      poItems: await prisma.purchaseOrderItem.count(),
      journals: await prisma.journalEntry.count(),
      journalLines: await prisma.journalLine.count(),
      vouchers: await prisma.voucher.count(),
      voucherEntries: await prisma.voucherEntry.count(),
      salesInvoices: await prisma.salesInvoice.count(),
      salesInvoiceItems: await prisma.salesInvoiceItem.count(),
      salesQuotations: await prisma.salesQuotation.count(),
      salesQuotationItems: await prisma.salesQuotationItem.count(),
      salesInquiries: await prisma.salesInquiry.count(),
      salesInquiryItems: await prisma.salesInquiryItem.count(),
      salesReturns: await prisma.salesReturn.count(),
      salesReturnItems: await prisma.salesReturnItem.count(),
      receivables: await prisma.receivable.count(),
      deliveryLogs: await prisma.deliveryLog.count(),
      deliveryLogItems: await prisma.deliveryLogItem.count(),
      stockReservations: await prisma.stockReservation.count(),
      stockMovements: await prisma.stockMovement.count(),
      transfers: await prisma.transfer.count(),
      transferItems: await prisma.transferItem.count(),
      adjustments: await prisma.adjustment.count(),
      adjustmentItems: await prisma.adjustmentItem.count(),
      stockVerifications: await prisma.stockVerification.count(),
      stockVerificationItems: await prisma.stockVerificationItem.count(),
      parts: await prisma.part.count(),
      models: await prisma.model.count(),
      priceHistory: await prisma.priceHistory.count(),
      kits: await prisma.kit.count(),
      kitItems: await prisma.kitItem.count(),
      postedExpenses: await prisma.postedExpense.count(),
      operationalExpenses: await prisma.operationalExpense.count(),
      brands: await prisma.brand.count(),
      categories: await prisma.category.count(),
      subcategories: await prisma.subcategory.count(),
      applications: await prisma.application.count(),
      masterParts: await prisma.masterPart.count(),
      stores: await prisma.store.count(),
      racks: await prisma.rack.count(),
      shelves: await prisma.shelf.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      expenseTypes: await prisma.expenseType.count(),
      accounts: await prisma.account.count(),
      subgroups: await prisma.subgroup.count(),
      mainGroups: await prisma.mainGroup.count(),
    };

    console.log('Current database counts:');
    console.log(`  DPO: ${counts.dpo} (Items: ${counts.dpoItems}, Expenses: ${counts.dpoExpenses}, Returns: ${counts.dpoReturns})`);
    console.log(`  PO: ${counts.po} (Items: ${counts.poItems})`);
    console.log(`  Journals: ${counts.journals} (Lines: ${counts.journalLines})`);
    console.log(`  Vouchers: ${counts.vouchers} (Entries: ${counts.voucherEntries})`);
    console.log(`  Sales Invoices: ${counts.salesInvoices} (Items: ${counts.salesInvoiceItems})`);
    console.log(`  Sales Quotations: ${counts.salesQuotations} (Items: ${counts.salesQuotationItems})`);
    console.log(`  Sales Inquiries: ${counts.salesInquiries} (Items: ${counts.salesInquiryItems})`);
    console.log(`  Sales Returns: ${counts.salesReturns} (Items: ${counts.salesReturnItems})`);
    console.log(`  Parts: ${counts.parts}`);
    console.log(`  Stock Movements: ${counts.stockMovements}`);
    console.log(`  Transfers: ${counts.transfers}`);
    console.log(`  Adjustments: ${counts.adjustments}`);
    console.log(`  Kits: ${counts.kits}`);
    console.log(`  Price History: ${counts.priceHistory}`);
    console.log(`  Brands: ${counts.brands}`);
    console.log(`  Categories: ${counts.categories}`);
    console.log(`  Subcategories: ${counts.subcategories}`);
    console.log(`  Applications: ${counts.applications}`);
    console.log(`  Master Parts: ${counts.masterParts}`);
    console.log(`  Stores: ${counts.stores}`);
    console.log(`  Racks: ${counts.racks}`);
    console.log(`  Shelves: ${counts.shelves}`);
    console.log(`  Customers: ${counts.customers}`);
    console.log(`  Suppliers: ${counts.suppliers}`);
    console.log(`  Expense Types: ${counts.expenseTypes}`);
    console.log(`  Accounts: ${counts.accounts}`);
    console.log(`  Subgroups: ${counts.subgroups}`);
    console.log(`  Main Groups: ${counts.mainGroups}`);
    console.log('');

    const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (totalItems === 0) {
      console.log('✓ Database is already empty. Nothing to delete.');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('Starting deletion process...\n');

    // ============================================
    // Step 1: Delete all child items first
    // ============================================
    console.log('Step 1: Deleting all child items...');

    // DPO Returns Items
    if (counts.dpoReturnItems > 0) {
      const deleted = await prisma.directPurchaseOrderReturnItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} DPO Return Items`);
    }

    // DPO Return
    if (counts.dpoReturns > 0) {
      const deleted = await prisma.directPurchaseOrderReturn.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} DPO Returns`);
    }

    // DPO Expenses
    if (counts.dpoExpenses > 0) {
      const deleted = await prisma.directPurchaseOrderExpense.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} DPO Expenses`);
    }

    // DPO Items
    if (counts.dpoItems > 0) {
      const deleted = await prisma.directPurchaseOrderItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} DPO Items`);
    }

    // PO Items
    if (counts.poItems > 0) {
      const deleted = await prisma.purchaseOrderItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} PO Items`);
    }

    // Journal Lines
    if (counts.journalLines > 0) {
      const deleted = await prisma.journalLine.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Journal Lines`);
    }

    // Voucher Entries
    if (counts.voucherEntries > 0) {
      const deleted = await prisma.voucherEntry.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Voucher Entries`);
    }

    // Delivery Log Items
    if (counts.deliveryLogItems > 0) {
      const deleted = await prisma.deliveryLogItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Delivery Log Items`);
    }

    // Delivery Logs
    if (counts.deliveryLogs > 0) {
      const deleted = await prisma.deliveryLog.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Delivery Logs`);
    }

    // Stock Reservations
    if (counts.stockReservations > 0) {
      const deleted = await prisma.stockReservation.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Stock Reservations`);
    }

    // Sales Return Items
    if (counts.salesReturnItems > 0) {
      const deleted = await prisma.salesReturnItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Return Items`);
    }

    // Sales Returns
    if (counts.salesReturns > 0) {
      const deleted = await prisma.salesReturn.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Returns`);
    }

    // Sales Invoice Items
    if (counts.salesInvoiceItems > 0) {
      const deleted = await prisma.salesInvoiceItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Invoice Items`);
    }

    // Receivables
    if (counts.receivables > 0) {
      const deleted = await prisma.receivable.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Receivables`);
    }

    // Sales Invoice
    if (counts.salesInvoices > 0) {
      const deleted = await prisma.salesInvoice.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Invoices`);
    }

    // Sales Quotation Items
    if (counts.salesQuotationItems > 0) {
      const deleted = await prisma.salesQuotationItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Quotation Items`);
    }

    // Sales Quotations
    if (counts.salesQuotations > 0) {
      const deleted = await prisma.salesQuotation.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Quotations`);
    }

    // Sales Inquiry Items
    if (counts.salesInquiryItems > 0) {
      const deleted = await prisma.salesInquiryItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Inquiry Items`);
    }

    // Sales Inquiries
    if (counts.salesInquiries > 0) {
      const deleted = await prisma.salesInquiry.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Sales Inquiries`);
    }

    // Transfer Items
    if (counts.transferItems > 0) {
      const deleted = await prisma.transferItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Transfer Items`);
    }

    // Transfers
    if (counts.transfers > 0) {
      const deleted = await prisma.transfer.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Transfers`);
    }

    // Adjustment Items
    if (counts.adjustmentItems > 0) {
      const deleted = await prisma.adjustmentItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Adjustment Items`);
    }

    // Adjustments
    if (counts.adjustments > 0) {
      const deleted = await prisma.adjustment.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Adjustments`);
    }

    // Stock Verification Items
    if (counts.stockVerificationItems > 0) {
      const deleted = await prisma.stockVerificationItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Stock Verification Items`);
    }

    // Stock Verifications
    if (counts.stockVerifications > 0) {
      const deleted = await prisma.stockVerification.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Stock Verifications`);
    }

    // Kit Items
    if (counts.kitItems > 0) {
      const deleted = await prisma.kitItem.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Kit Items`);
    }

    // Kits
    if (counts.kits > 0) {
      const deleted = await prisma.kit.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Kits`);
    }

    // Models
    if (counts.models > 0) {
      const deleted = await prisma.model.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Models`);
    }

    // Price History
    if (counts.priceHistory > 0) {
      const deleted = await prisma.priceHistory.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Price History records`);
    }

    // Stock Movements
    if (counts.stockMovements > 0) {
      const deleted = await prisma.stockMovement.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Stock Movements`);
    }

    // ============================================
    // Step 2: Delete all parent records
    // ============================================
    console.log('\nStep 2: Deleting all parent records...');

    // DPO
    if (counts.dpo > 0) {
      const deleted = await prisma.directPurchaseOrder.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Direct Purchase Orders (DPO)`);
    }

    // PO
    if (counts.po > 0) {
      const deleted = await prisma.purchaseOrder.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Purchase Orders (PO)`);
    }

    // Journal Entries
    if (counts.journals > 0) {
      const deleted = await prisma.journalEntry.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Journal Entries`);
    }

    // Vouchers
    if (counts.vouchers > 0) {
      const deleted = await prisma.voucher.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Vouchers`);
    }

    // Posted Expenses
    if (counts.postedExpenses > 0) {
      const deleted = await prisma.postedExpense.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Posted Expenses`);
    }

    // Operational Expenses
    if (counts.operationalExpenses > 0) {
      const deleted = await prisma.operationalExpense.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Operational Expenses`);
    }

    // ============================================
    // Step 3: Delete all Parts/Items
    // ============================================
    console.log('\nStep 3: Deleting all Parts/Items...');

    if (counts.parts > 0) {
      const deleted = await prisma.part.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Parts/Items`);
    }

    // ============================================
    // Step 4: Delete all Attribute/Master Data
    // ============================================
    console.log('\nStep 4: Deleting all attribute/master data...');

    // Get counts for attributes
    const attributeCounts = {
      applications: await prisma.application.count(),
      subcategories: await prisma.subcategory.count(),
      categories: await prisma.category.count(),
      brands: await prisma.brand.count(),
      masterParts: await prisma.masterPart.count(),
      shelves: await prisma.shelf.count(),
      racks: await prisma.rack.count(),
      stores: await prisma.store.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      expenseTypes: await prisma.expenseType.count(),
      accounts: await prisma.account.count(),
      subgroups: await prisma.subgroup.count(),
      mainGroups: await prisma.mainGroup.count(),
    };

    // Delete Applications (must be first due to foreign keys)
    if (attributeCounts.applications > 0) {
      const deleted = await prisma.application.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Applications`);
    }

    // Delete Subcategories
    if (attributeCounts.subcategories > 0) {
      const deleted = await prisma.subcategory.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Subcategories`);
    }

    // Delete Categories
    if (attributeCounts.categories > 0) {
      const deleted = await prisma.category.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Categories`);
    }

    // Delete Brands
    if (attributeCounts.brands > 0) {
      const deleted = await prisma.brand.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Brands`);
    }

    // Delete MasterParts
    if (attributeCounts.masterParts > 0) {
      const deleted = await prisma.masterPart.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Master Parts`);
    }

    // Delete Shelves
    if (attributeCounts.shelves > 0) {
      const deleted = await prisma.shelf.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Shelves`);
    }

    // Delete Racks
    if (attributeCounts.racks > 0) {
      const deleted = await prisma.rack.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Racks`);
    }

    // Delete Stores
    if (attributeCounts.stores > 0) {
      const deleted = await prisma.store.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Stores`);
    }

    // Delete Customers
    if (attributeCounts.customers > 0) {
      const deleted = await prisma.customer.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Customers`);
    }

    // Delete Suppliers
    if (attributeCounts.suppliers > 0) {
      const deleted = await prisma.supplier.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Suppliers`);
    }

    // Delete Expense Types
    if (attributeCounts.expenseTypes > 0) {
      const deleted = await prisma.expenseType.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Expense Types`);
    }

    // Delete Accounts (accounting structure)
    if (attributeCounts.accounts > 0) {
      const deleted = await prisma.account.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Accounts`);
    }

    // Delete Subgroups
    if (attributeCounts.subgroups > 0) {
      const deleted = await prisma.subgroup.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Subgroups`);
    }

    // Delete Main Groups
    if (attributeCounts.mainGroups > 0) {
      const deleted = await prisma.mainGroup.deleteMany({});
      console.log(`  ✓ Deleted ${deleted.count} Main Groups`);
    }

    // ============================================
    // Verification
    // ============================================
    console.log('\n==========================================');
    console.log('  DELETION COMPLETE');
    console.log('==========================================\n');

    const remainingCounts = {
      dpo: await prisma.directPurchaseOrder.count(),
      po: await prisma.purchaseOrder.count(),
      journals: await prisma.journalEntry.count(),
      vouchers: await prisma.voucher.count(),
      salesInvoices: await prisma.salesInvoice.count(),
      parts: await prisma.part.count(),
      stockMovements: await prisma.stockMovement.count(),
      transfers: await prisma.transfer.count(),
      adjustments: await prisma.adjustment.count(),
      kits: await prisma.kit.count(),
      brands: await prisma.brand.count(),
      categories: await prisma.category.count(),
      subcategories: await prisma.subcategory.count(),
      applications: await prisma.application.count(),
      masterParts: await prisma.masterPart.count(),
      stores: await prisma.store.count(),
      racks: await prisma.rack.count(),
      shelves: await prisma.shelf.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      expenseTypes: await prisma.expenseType.count(),
      accounts: await prisma.account.count(),
      subgroups: await prisma.subgroup.count(),
      mainGroups: await prisma.mainGroup.count(),
    };

    console.log('Remaining records:');
    console.log(`  DPO: ${remainingCounts.dpo}`);
    console.log(`  PO: ${remainingCounts.po}`);
    console.log(`  Journals: ${remainingCounts.journals}`);
    console.log(`  Vouchers: ${remainingCounts.vouchers}`);
    console.log(`  Sales Invoices: ${remainingCounts.salesInvoices}`);
    console.log(`  Parts: ${remainingCounts.parts}`);
    console.log(`  Stock Movements: ${remainingCounts.stockMovements}`);
    console.log(`  Transfers: ${remainingCounts.transfers}`);
    console.log(`  Adjustments: ${remainingCounts.adjustments}`);
    console.log(`  Kits: ${remainingCounts.kits}`);
    console.log(`  Brands: ${remainingCounts.brands}`);
    console.log(`  Categories: ${remainingCounts.categories}`);
    console.log(`  Subcategories: ${remainingCounts.subcategories}`);
    console.log(`  Applications: ${remainingCounts.applications}`);
    console.log(`  Master Parts: ${remainingCounts.masterParts}`);
    console.log(`  Stores: ${remainingCounts.stores}`);
    console.log(`  Racks: ${remainingCounts.racks}`);
    console.log(`  Shelves: ${remainingCounts.shelves}`);
    console.log(`  Customers: ${remainingCounts.customers}`);
    console.log(`  Suppliers: ${remainingCounts.suppliers}`);
    console.log(`  Expense Types: ${remainingCounts.expenseTypes}`);
    console.log(`  Accounts: ${remainingCounts.accounts}`);
    console.log(`  Subgroups: ${remainingCounts.subgroups}`);
    console.log(`  Main Groups: ${remainingCounts.mainGroups}`);
    console.log('');

    const totalRemaining = Object.values(remainingCounts).reduce((sum, count) => sum + count, 0);
    if (totalRemaining === 0) {
      console.log('✅ SUCCESS! All database items have been deleted!');
    } else {
      console.log('⚠️  Warning: Some items may still remain.');
    }

    console.log('\n==========================================\n');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
