const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Helper function to parse number strings with commas
function parseNumber(str) {
  if (!str || str === '' || str === null || str === undefined) return null;
  const cleaned = String(str).replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === 'null' || cleaned === 'undefined') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Helper function to parse integer
function parseIntSafe(str) {
  if (!str || str === '' || str === null || str === undefined) return 0;
  const cleaned = String(str).replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === 'null' || cleaned === 'undefined') return 0;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

// Helper function to clean string
function cleanString(str) {
  if (!str || str === null || str === undefined) return null;
  const cleaned = String(str).trim();
  return cleaned === '' ? null : cleaned;
}

async function importItems(limit = null) {
  try {
    console.log('==========================================');
    console.log('  Import Items from JSON');
    console.log('==========================================\n');

    // Read JSON file
    const jsonPath = path.resolve(__dirname, '../CTC_Item_Lists_with_size.json');
    console.log(`Reading JSON file: ${jsonPath}`);
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found: ${jsonPath}`);
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const itemsToProcess = limit ? jsonData.slice(0, limit) : jsonData;
    
    console.log(`Total items in file: ${jsonData.length}`);
    console.log(`Items to process: ${itemsToProcess.length}\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each item
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const itemNum = i + 1;
      
      try {
        // Extract and clean data
        const masterPartNo = cleanString(item['Master Part no']);
        const partNo = cleanString(item['ss part no']);
        const description = cleanString(item['Discription']);
        const categoryName = cleanString(item['Catigory']);
        const brandName = cleanString(item['brand']);
        const subcategoryName = cleanString(item['sub catigory']);
        const applicationName = cleanString(item['application']);
        const cost = parseNumber(item['cost']);
        const priceA = parseNumber(item['price a']);
        const priceB = parseNumber(item['price b']);
        const origin = cleanString(item['origin']);
        const size = cleanString(item['size']);
        const grade = cleanString(item['grade']); // Note: grade is not in schema, might be stored in description or ignored
        const models = item['models'] || [];

        // Validate required fields
        if (!partNo) {
          throw new Error('Part number (ss part no) is required');
        }

        // Create/Get Master Part
        let masterPartId = null;
        if (masterPartNo) {
          const masterPart = await prisma.masterPart.upsert({
            where: { masterPartNo: masterPartNo },
            update: {},
            create: { masterPartNo: masterPartNo },
          });
          masterPartId = masterPart.id;
        }

        // Create/Get Brand
        let brandId = null;
        if (brandName) {
          const brand = await prisma.brand.upsert({
            where: { name: brandName },
            update: {},
            create: { name: brandName, status: 'active' },
          });
          brandId = brand.id;
        }

        // Create/Get Category
        let categoryId = null;
        if (categoryName) {
          const category = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName, status: 'active' },
          });
          categoryId = category.id;
        }

        // Create/Get Subcategory (requires category)
        let subcategoryId = null;
        if (subcategoryName && categoryId) {
          const subcategory = await prisma.subcategory.upsert({
            where: {
              categoryId_name: {
                categoryId: categoryId,
                name: subcategoryName,
              },
            },
            update: {},
            create: {
              categoryId: categoryId,
              name: subcategoryName,
              status: 'active',
            },
          });
          subcategoryId = subcategory.id;
        }

        // Create/Get Application (requires subcategory)
        let applicationId = null;
        if (applicationName && subcategoryId) {
          const application = await prisma.application.upsert({
            where: {
              subcategoryId_name: {
                subcategoryId: subcategoryId,
                name: applicationName,
              },
            },
            update: {},
            create: {
              subcategoryId: subcategoryId,
              name: applicationName,
              status: 'active',
            },
          });
          applicationId = application.id;
        }

        // Prepare description (include grade if available)
        let finalDescription = description;
        if (grade && description) {
          finalDescription = `${description} (Grade: ${grade})`;
        } else if (grade) {
          finalDescription = `Grade: ${grade}`;
        }

        // Prepare models data - remove duplicates within the same part
        const modelsMap = new Map();
        models
          .filter(m => m && m.model && String(m.model).trim() !== '')
          .forEach(m => {
            const modelName = String(m.model).trim();
            const qty = parseIntSafe(m.qty || m.qtyUsed || 1);
            // If duplicate model name, keep the one with higher quantity (or first one)
            if (!modelsMap.has(modelName)) {
              modelsMap.set(modelName, qty);
            } else {
              // If duplicate, use the maximum quantity
              const existingQty = modelsMap.get(modelName);
              if (qty > existingQty) {
                modelsMap.set(modelName, qty);
              }
            }
          });
        
        const modelsData = Array.from(modelsMap.entries()).map(([name, qtyUsed]) => ({
          name: name,
          qtyUsed: qtyUsed,
        }));

        // ALWAYS CREATE NEW PART - Don't check for duplicates, import everything
        const part = await prisma.part.create({
          data: {
            masterPartId: masterPartId,
            partNo: partNo,
            brandId: brandId,
            description: finalDescription,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            applicationId: applicationId,
            cost: cost,
            priceA: priceA,
            priceB: priceB,
            origin: origin,
            size: size,
            status: 'active',
            uom: 'pcs',
            reorderLevel: 0,
            // Create models directly with the part
            models: modelsData.length > 0
              ? {
                  create: modelsData,
                }
              : undefined,
          },
        });

        successCount++;
        if (itemNum % 100 === 0) {
          console.log(`Processed ${itemNum}/${itemsToProcess.length} items...`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Item ${itemNum} (Part: ${item['ss part no'] || 'N/A'}): ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log('\n==========================================');
    console.log('  Import Complete');
    console.log('==========================================');
    console.log(`✅ Successfully imported: ${successCount} items`);
    console.log(`❌ Errors: ${errorCount} items`);
    
    if (errors.length > 0 && errors.length <= 20) {
      console.log('\nErrors:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else if (errors.length > 20) {
      console.log(`\nFirst 20 errors:`);
      errors.slice(0, 20).forEach(err => console.log(`  - ${err}`));
      console.log(`  ... and ${errors.length - 20} more errors`);
    }

    // Verify import
    const totalParts = await prisma.part.count();
    const totalModels = await prisma.model.count();
    console.log('\nDatabase Status:');
    console.log(`  - Total Parts: ${totalParts}`);
    console.log(`  - Total Models: ${totalModels}`);
    console.log('==========================================\n');

    await prisma.$disconnect();
    return { successCount, errorCount, errors };
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    throw error;
  }
}

// Main execution
const args = process.argv.slice(2);
const limit = args.includes('--test') ? 5 : null;

if (limit) {
  console.log('🧪 TEST MODE: Importing first 5 items only\n');
}

importItems(limit)
  .then((result) => {
    if (limit) {
      console.log('\n✅ Test import completed!');
      console.log('If results look accurate, run without --test flag to import all items.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });

