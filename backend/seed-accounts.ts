import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAccounts() {
  try {
    console.log('🌱 Seeding Accounting Accounts...\n');

    // Fetch all subgroups
    const subgroups = await prisma.subgroup.findMany({
      include: { mainGroup: true },
      orderBy: { code: 'asc' },
    });

    console.log(`Found ${subgroups.length} subgroups\n`);

    // Define accounts for each subgroup
    const accountsData: Array<{ subgroupCode: string; code: string; name: string; description?: string }> = [
      // Current Assets - Cash and Cash Equivalents (101)
      { subgroupCode: '101', code: '101001', name: 'Cash in Hand', description: 'Physical cash available in the office' },
      { subgroupCode: '101', code: '101002', name: 'Petty Cash', description: 'Small amount of cash for minor expenses' },
      { subgroupCode: '101', code: '101003', name: 'Cash Equivalents', description: 'Highly liquid short-term investments' },

      // Current Assets - Bank Accounts (102)
      { subgroupCode: '102', code: '102001', name: 'Primary Bank Account', description: 'Main operating bank account' },
      { subgroupCode: '102', code: '102002', name: 'Savings Account', description: 'Savings bank account' },
      { subgroupCode: '102', code: '102003', name: 'Checking Account', description: 'Business checking account' },
      { subgroupCode: '102', code: '102004', name: 'Payroll Account', description: 'Dedicated payroll bank account' },

      // Current Assets - Accounts Receivable (103)
      { subgroupCode: '103', code: '103001', name: 'Accounts Receivable', description: 'Amounts owed by customers' },
      { subgroupCode: '103', code: '103002', name: 'Customer Receivables', description: 'Trade receivables from customers' },
      { subgroupCode: '103', code: '103003', name: 'Notes Receivable', description: 'Promissory notes from customers' },
      { subgroupCode: '103', code: '103004', name: 'Allowance for Doubtful Accounts', description: 'Estimated uncollectible accounts' },

      // Current Assets - Inventory (104)
      { subgroupCode: '104', code: '104001', name: 'Raw Materials', description: 'Raw materials inventory' },
      { subgroupCode: '104', code: '104002', name: 'Work in Process', description: 'Goods in production' },
      { subgroupCode: '104', code: '104003', name: 'Finished Goods', description: 'Completed products ready for sale' },
      { subgroupCode: '104', code: '104004', name: 'Merchandise Inventory', description: 'Goods held for resale' },
      { subgroupCode: '104', code: '104005', name: 'Inventory - General', description: 'General inventory account' },

      // Current Assets - Prepaid Expenses (105)
      { subgroupCode: '105', code: '105001', name: 'Prepaid Rent', description: 'Rent paid in advance' },
      { subgroupCode: '105', code: '105002', name: 'Prepaid Insurance', description: 'Insurance premiums paid in advance' },
      { subgroupCode: '105', code: '105003', name: 'Prepaid Utilities', description: 'Utility bills paid in advance' },
      { subgroupCode: '105', code: '105004', name: 'Prepaid Subscriptions', description: 'Subscription fees paid in advance' },

      // Current Assets - Short-term Investments (106)
      { subgroupCode: '106', code: '106001', name: 'Marketable Securities', description: 'Short-term marketable securities' },
      { subgroupCode: '106', code: '106002', name: 'Treasury Bills', description: 'Short-term government securities' },
      { subgroupCode: '106', code: '106003', name: 'Money Market Funds', description: 'Money market investments' },

      // Current Assets - Other Current Assets (107)
      { subgroupCode: '107', code: '107001', name: 'Other Current Assets', description: 'Miscellaneous current assets' },
      { subgroupCode: '107', code: '107002', name: 'Advances to Employees', description: 'Employee advances' },
      { subgroupCode: '107', code: '107003', name: 'Deposits', description: 'Security deposits and other deposits' },

      // Long Term Assets - Fixed Assets (201)
      { subgroupCode: '201', code: '201001', name: 'Office Equipment', description: 'Office furniture and equipment' },
      { subgroupCode: '201', code: '201002', name: 'Computer Equipment', description: 'Computers and IT equipment' },
      { subgroupCode: '201', code: '201003', name: 'Vehicles', description: 'Company vehicles' },
      { subgroupCode: '201', code: '201004', name: 'Machinery', description: 'Production machinery' },

      // Long Term Assets - Property, Plant & Equipment (202)
      { subgroupCode: '202', code: '202001', name: 'Land', description: 'Owned land' },
      { subgroupCode: '202', code: '202002', name: 'Building', description: 'Owned buildings' },
      { subgroupCode: '202', code: '202003', name: 'Building Improvements', description: 'Improvements to buildings' },
      { subgroupCode: '202', code: '202004', name: 'Equipment', description: 'Production and office equipment' },
      { subgroupCode: '202', code: '202005', name: 'Leasehold Improvements', description: 'Improvements to leased property' },

      // Long Term Assets - Intangible Assets (203)
      { subgroupCode: '203', code: '203001', name: 'Goodwill', description: 'Business goodwill' },
      { subgroupCode: '203', code: '203002', name: 'Patents', description: 'Patent rights' },
      { subgroupCode: '203', code: '203003', name: 'Trademarks', description: 'Trademark rights' },
      { subgroupCode: '203', code: '203004', name: 'Copyrights', description: 'Copyright assets' },
      { subgroupCode: '203', code: '203005', name: 'Software', description: 'Software licenses and development costs' },

      // Long Term Assets - Long-term Investments (204)
      { subgroupCode: '204', code: '204001', name: 'Long-term Investments', description: 'Long-term investment portfolio' },
      { subgroupCode: '204', code: '204002', name: 'Investment in Subsidiaries', description: 'Investments in subsidiary companies' },
      { subgroupCode: '204', code: '204003', name: 'Bonds - Long-term', description: 'Long-term bond investments' },

      // Long Term Assets - Accumulated Depreciation (205)
      { subgroupCode: '205', code: '205001', name: 'Accumulated Depreciation - Building', description: 'Depreciation on buildings' },
      { subgroupCode: '205', code: '205002', name: 'Accumulated Depreciation - Equipment', description: 'Depreciation on equipment' },
      { subgroupCode: '205', code: '205003', name: 'Accumulated Depreciation - Vehicles', description: 'Depreciation on vehicles' },
      { subgroupCode: '205', code: '205004', name: 'Accumulated Depreciation - Furniture', description: 'Depreciation on furniture' },

      // Long Term Assets - Other Long-term Assets (206)
      { subgroupCode: '206', code: '206001', name: 'Other Long-term Assets', description: 'Miscellaneous long-term assets' },
      { subgroupCode: '206', code: '206002', name: 'Deferred Tax Assets', description: 'Deferred tax assets' },

      // Current Liabilities - Accounts Payable (301)
      { subgroupCode: '301', code: '301001', name: 'Accounts Payable', description: 'Amounts owed to suppliers' },
      { subgroupCode: '301', code: '301002', name: 'Trade Payables', description: 'Trade accounts payable' },
      { subgroupCode: '301', code: '301003', name: 'Supplier Payables', description: 'Amounts due to suppliers' },
      { subgroupCode: '301', code: '301004', name: 'Purchase Payables', description: 'Purchase-related payables' },

      // Current Liabilities - Short-term Loans (302)
      { subgroupCode: '302', code: '302001', name: 'Short-term Bank Loan', description: 'Short-term bank borrowing' },
      { subgroupCode: '302', code: '302002', name: 'Line of Credit', description: 'Bank line of credit' },
      { subgroupCode: '302', code: '302003', name: 'Credit Card Payable', description: 'Credit card balances' },

      // Current Liabilities - Accrued Expenses (303)
      { subgroupCode: '303', code: '303001', name: 'Accrued Salaries', description: 'Salaries earned but not yet paid' },
      { subgroupCode: '303', code: '303002', name: 'Accrued Wages', description: 'Wages earned but not yet paid' },
      { subgroupCode: '303', code: '303003', name: 'Accrued Interest', description: 'Interest payable' },
      { subgroupCode: '303', code: '303004', name: 'Accrued Utilities', description: 'Utilities payable' },
      { subgroupCode: '303', code: '303005', name: 'Accrued Rent', description: 'Rent payable' },

      // Current Liabilities - Tax Payable (304)
      { subgroupCode: '304', code: '304001', name: 'Income Tax Payable', description: 'Income taxes payable' },
      { subgroupCode: '304', code: '304002', name: 'Sales Tax Payable', description: 'Sales tax collected and payable' },
      { subgroupCode: '304', code: '304003', name: 'Payroll Tax Payable', description: 'Payroll taxes payable' },
      { subgroupCode: '304', code: '304004', name: 'VAT Payable', description: 'Value Added Tax payable' },

      // Current Liabilities - Unearned Revenue (305)
      { subgroupCode: '305', code: '305001', name: 'Unearned Revenue', description: 'Revenue received in advance' },
      { subgroupCode: '305', code: '305002', name: 'Customer Deposits', description: 'Deposits from customers' },
      { subgroupCode: '305', code: '305003', name: 'Prepaid Services', description: 'Services paid for in advance' },

      // Current Liabilities - Current Portion of Long-term Debt (306)
      { subgroupCode: '306', code: '306001', name: 'Current Portion of Long-term Debt', description: 'Current portion of long-term loans' },
      { subgroupCode: '306', code: '306002', name: 'Current Portion of Mortgage', description: 'Current portion of mortgage payable' },

      // Current Liabilities - Other Current Liabilities (307)
      { subgroupCode: '307', code: '307001', name: 'Other Current Liabilities', description: 'Miscellaneous current liabilities' },
      { subgroupCode: '307', code: '307002', name: 'Accrued Expenses - Other', description: 'Other accrued expenses' },

      // Long Term Liabilities - Long-term Loans (401)
      { subgroupCode: '401', code: '401001', name: 'Long-term Bank Loan', description: 'Long-term bank borrowing' },
      { subgroupCode: '401', code: '401002', name: 'Term Loan', description: 'Term loan payable' },
      { subgroupCode: '401', code: '401003', name: 'Long-term Notes Payable', description: 'Long-term promissory notes' },

      // Long Term Liabilities - Bonds Payable (402)
      { subgroupCode: '402', code: '402001', name: 'Bonds Payable', description: 'Corporate bonds issued' },
      { subgroupCode: '402', code: '402002', name: 'Convertible Bonds', description: 'Convertible bond obligations' },

      // Long Term Liabilities - Mortgage Payable (403)
      { subgroupCode: '403', code: '403001', name: 'Mortgage Payable', description: 'Mortgage loan payable' },
      { subgroupCode: '403', code: '403002', name: 'Building Mortgage', description: 'Mortgage on building' },

      // Long Term Liabilities - Deferred Tax Liabilities (404)
      { subgroupCode: '404', code: '404001', name: 'Deferred Tax Liabilities', description: 'Deferred tax obligations' },

      // Long Term Liabilities - Other Long-term Liabilities (405)
      { subgroupCode: '405', code: '405001', name: 'Other Long-term Liabilities', description: 'Miscellaneous long-term liabilities' },
      { subgroupCode: '405', code: '405002', name: 'Pension Liabilities', description: 'Pension obligations' },

      // Capital - Owner's Capital (501)
      { subgroupCode: '501', code: '501001', name: "Owner's Capital", description: "Owner's equity investment" },
      { subgroupCode: '501', code: '501002', name: "Partner's Capital", description: "Partner's equity" },
      { subgroupCode: '501', code: '501003', name: 'Initial Capital', description: 'Initial capital contribution' },

      // Capital - Share Capital (502)
      { subgroupCode: '502', code: '502001', name: 'Common Stock', description: 'Common shares issued' },
      { subgroupCode: '502', code: '502002', name: 'Preferred Stock', description: 'Preferred shares issued' },
      { subgroupCode: '502', code: '502003', name: 'Paid-in Capital', description: 'Additional paid-in capital' },

      // Capital - Retained Earnings (503)
      { subgroupCode: '503', code: '503001', name: 'Retained Earnings', description: 'Accumulated retained earnings' },
      { subgroupCode: '503', code: '503002', name: 'Current Year Earnings', description: 'Current year profit/loss' },

      // Capital - Additional Paid-in Capital (504)
      { subgroupCode: '504', code: '504001', name: 'Additional Paid-in Capital', description: 'Capital in excess of par value' },
      { subgroupCode: '504', code: '504002', name: 'Share Premium', description: 'Share premium account' },

      // Capital - Reserves (505)
      { subgroupCode: '505', code: '505001', name: 'General Reserve', description: 'General reserve fund' },
      { subgroupCode: '505', code: '505002', name: 'Capital Reserve', description: 'Capital reserve account' },
      { subgroupCode: '505', code: '505003', name: 'Revaluation Reserve', description: 'Asset revaluation reserve' },

      // Drawings - Owner's Drawings (601)
      { subgroupCode: '601', code: '601001', name: "Owner's Drawings", description: "Owner's personal withdrawals" },
      { subgroupCode: '601', code: '601002', name: "Owner's Withdrawals", description: "Owner's cash withdrawals" },

      // Drawings - Partner Drawings (602)
      { subgroupCode: '602', code: '602001', name: "Partner's Drawings", description: "Partner's personal withdrawals" },
      { subgroupCode: '602', code: '602002', name: "Partner's Withdrawals", description: "Partner's cash withdrawals" },

      // Drawings - Dividends (603)
      { subgroupCode: '603', code: '603001', name: 'Dividends Payable', description: 'Dividends declared but not paid' },
      { subgroupCode: '603', code: '603002', name: 'Cash Dividends', description: 'Cash dividend distributions' },

      // Revenues - Sales Revenue (701)
      { subgroupCode: '701', code: '701001', name: 'Sales Revenue', description: 'Revenue from product sales' },
      { subgroupCode: '701', code: '701002', name: 'Product Sales', description: 'Revenue from product sales' },
      { subgroupCode: '701', code: '701003', name: 'Merchandise Sales', description: 'Revenue from merchandise sales' },
      { subgroupCode: '701', code: '701004', name: 'Retail Sales', description: 'Retail sales revenue' },

      // Revenues - Service Revenue (702)
      { subgroupCode: '702', code: '702001', name: 'Service Revenue', description: 'Revenue from services rendered' },
      { subgroupCode: '702', code: '702002', name: 'Consulting Revenue', description: 'Consulting service revenue' },
      { subgroupCode: '702', code: '702003', name: 'Professional Fees', description: 'Professional service fees' },

      // Revenues - Interest Income (703)
      { subgroupCode: '703', code: '703001', name: 'Interest Income', description: 'Interest earned on investments' },
      { subgroupCode: '703', code: '703002', name: 'Bank Interest', description: 'Interest from bank deposits' },
      { subgroupCode: '703', code: '703003', name: 'Investment Income', description: 'Income from investments' },

      // Revenues - Other Income (704)
      { subgroupCode: '704', code: '704001', name: 'Other Income', description: 'Miscellaneous income' },
      { subgroupCode: '704', code: '704002', name: 'Rental Income', description: 'Income from property rental' },
      { subgroupCode: '704', code: '704003', name: 'Commission Income', description: 'Commission revenue' },
      { subgroupCode: '704', code: '704004', name: 'Gain on Sale of Assets', description: 'Profit from asset sales' },

      // Revenues - Discount Received (705)
      { subgroupCode: '705', code: '705001', name: 'Discount Received', description: 'Discounts received from suppliers' },
      { subgroupCode: '705', code: '705002', name: 'Purchase Discounts', description: 'Discounts on purchases' },

      // Expenses - Operating Expenses (801)
      { subgroupCode: '801', code: '801001', name: 'Operating Expenses', description: 'General operating expenses' },
      { subgroupCode: '801', code: '801002', name: 'Office Supplies', description: 'Office supplies expense' },
      { subgroupCode: '801', code: '801003', name: 'General Expenses', description: 'General business expenses' },

      // Expenses - Salaries and Wages (802)
      { subgroupCode: '802', code: '802001', name: 'Salaries Expense', description: 'Employee salaries' },
      { subgroupCode: '802', code: '802002', name: 'Wages Expense', description: 'Employee wages' },
      { subgroupCode: '802', code: '802003', name: 'Employee Benefits', description: 'Employee benefits expense' },
      { subgroupCode: '802', code: '802004', name: 'Payroll Taxes', description: 'Payroll tax expenses' },

      // Expenses - Rent Expense (803)
      { subgroupCode: '803', code: '803001', name: 'Rent Expense', description: 'Office and facility rent' },
      { subgroupCode: '803', code: '803002', name: 'Office Rent', description: 'Office space rental' },
      { subgroupCode: '803', code: '803003', name: 'Warehouse Rent', description: 'Warehouse rental expense' },

      // Expenses - Utilities Expense (804)
      { subgroupCode: '804', code: '804001', name: 'Utilities Expense', description: 'Utility bills expense' },
      { subgroupCode: '804', code: '804002', name: 'Electricity Expense', description: 'Electricity bills' },
      { subgroupCode: '804', code: '804003', name: 'Water Expense', description: 'Water utility expense' },
      { subgroupCode: '804', code: '804004', name: 'Internet & Phone', description: 'Internet and phone expenses' },

      // Expenses - Marketing Expenses (805)
      { subgroupCode: '805', code: '805001', name: 'Marketing Expense', description: 'Marketing and advertising costs' },
      { subgroupCode: '805', code: '805002', name: 'Advertising Expense', description: 'Advertising costs' },
      { subgroupCode: '805', code: '805003', name: 'Promotional Expenses', description: 'Promotion and marketing costs' },
      { subgroupCode: '805', code: '805004', name: 'Social Media Marketing', description: 'Social media advertising' },

      // Expenses - Administrative Expenses (806)
      { subgroupCode: '806', code: '806001', name: 'Administrative Expenses', description: 'General administrative costs' },
      { subgroupCode: '806', code: '806002', name: 'Legal Fees', description: 'Legal and professional fees' },
      { subgroupCode: '806', code: '806003', name: 'Accounting Fees', description: 'Accounting and bookkeeping fees' },
      { subgroupCode: '806', code: '806004', name: 'Insurance Expense', description: 'Insurance premiums' },
      { subgroupCode: '806', code: '806005', name: 'Bank Charges', description: 'Bank service charges' },

      // Expenses - Depreciation Expense (807)
      { subgroupCode: '807', code: '807001', name: 'Depreciation Expense', description: 'Depreciation on fixed assets' },
      { subgroupCode: '807', code: '807002', name: 'Depreciation - Equipment', description: 'Equipment depreciation' },
      { subgroupCode: '807', code: '807003', name: 'Depreciation - Vehicles', description: 'Vehicle depreciation' },
      { subgroupCode: '807', code: '807004', name: 'Amortization Expense', description: 'Amortization of intangible assets' },

      // Expenses - Interest Expense (808)
      { subgroupCode: '808', code: '808001', name: 'Interest Expense', description: 'Interest on loans and borrowings' },
      { subgroupCode: '808', code: '808002', name: 'Bank Interest Expense', description: 'Bank loan interest' },
      { subgroupCode: '808', code: '808003', name: 'Finance Charges', description: 'Finance and interest charges' },

      // Expenses - Tax Expense (809)
      { subgroupCode: '809', code: '809001', name: 'Income Tax Expense', description: 'Income tax expense' },
      { subgroupCode: '809', code: '809002', name: 'Corporate Tax', description: 'Corporate income tax' },

      // Expenses - Other Expenses (810)
      { subgroupCode: '810', code: '810001', name: 'Other Expenses', description: 'Miscellaneous expenses' },
      { subgroupCode: '810', code: '810002', name: 'Bad Debt Expense', description: 'Uncollectible accounts expense' },
      { subgroupCode: '810', code: '810003', name: 'Loss on Sale of Assets', description: 'Loss from asset disposals' },
      { subgroupCode: '810', code: '810004', name: 'Miscellaneous Expenses', description: 'Other miscellaneous costs' },

      // Cost - Cost of Goods Sold (901)
      { subgroupCode: '901', code: '901001', name: 'Cost of Goods Sold', description: 'Direct cost of products sold' },
      { subgroupCode: '901', code: '901002', name: 'COGS - Products', description: 'Cost of goods sold for products' },
      { subgroupCode: '901', code: '901003', name: 'COGS - Merchandise', description: 'Cost of merchandise sold' },

      // Cost - Direct Materials (902)
      { subgroupCode: '902', code: '902001', name: 'Direct Materials', description: 'Raw materials used in production' },
      { subgroupCode: '902', code: '902002', name: 'Materials Cost', description: 'Cost of materials consumed' },
      { subgroupCode: '902', code: '902003', name: 'Raw Materials Used', description: 'Raw materials consumed' },

      // Cost - Direct Labor (903)
      { subgroupCode: '903', code: '903001', name: 'Direct Labor', description: 'Labor costs directly related to production' },
      { subgroupCode: '903', code: '903002', name: 'Production Wages', description: 'Wages for production workers' },
      { subgroupCode: '903', code: '903003', name: 'Manufacturing Labor', description: 'Manufacturing labor costs' },

      // Cost - Manufacturing Overhead (904)
      { subgroupCode: '904', code: '904001', name: 'Manufacturing Overhead', description: 'Indirect manufacturing costs' },
      { subgroupCode: '904', code: '904002', name: 'Factory Overhead', description: 'Factory overhead expenses' },
      { subgroupCode: '904', code: '904003', name: 'Production Overhead', description: 'Production overhead costs' },

      // Cost - Purchase Discount (905)
      { subgroupCode: '905', code: '905001', name: 'Purchase Discount', description: 'Discounts received on purchases' },
      { subgroupCode: '905', code: '905002', name: 'Early Payment Discount', description: 'Discounts for early payment' },
    ];

    // Create accounts
    const createdAccounts: any[] = [];
    let skippedCount = 0;

    for (const accountData of accountsData) {
      const subgroup = subgroups.find(sg => sg.code === accountData.subgroupCode);
      
      if (!subgroup) {
        console.warn(`⚠️  Subgroup not found for code: ${accountData.subgroupCode} - Skipping account: ${accountData.name}`);
        skippedCount++;
        continue;
      }

      try {
        const account = await prisma.account.upsert({
          where: { code: accountData.code },
          update: {
            name: accountData.name,
            description: accountData.description || accountData.name,
            subgroupId: subgroup.id,
            status: 'Active',
          },
          create: {
            subgroupId: subgroup.id,
            code: accountData.code,
            name: accountData.name,
            description: accountData.description || accountData.name,
            accountType: 'regular',
            openingBalance: 0,
            currentBalance: 0,
            status: 'Active',
            canDelete: true,
          },
        });
        createdAccounts.push(account);
        console.log(`  ✅ Account: ${account.code} - ${account.name} (${subgroup.name})`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - account already exists
          console.log(`  ℹ️  Account ${accountData.code} already exists, skipping...`);
          skippedCount++;
        } else {
          console.error(`  ❌ Error creating account ${accountData.code}:`, error.message);
          skippedCount++;
        }
      }
    }

    console.log(`\n✅ ${createdAccounts.length} Accounts created/updated`);
    if (skippedCount > 0) {
      console.log(`ℹ️  ${skippedCount} accounts skipped (already exist or errors)`);
    }
    console.log('\n🎉 Accounts seeding completed successfully!\n');

  } catch (error) {
    console.error('❌ Error seeding accounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedAccounts()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

