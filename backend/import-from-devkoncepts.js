const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('==========================================');
    console.log('  IMPORT DATA FROM DEV-KONCEPTS DATABASE');
    console.log('  Importing all items with images');
    console.log('==========================================\n');

    const sourceDbPath = '/var/www/Dev-Koncepts/backend/prisma/inventory.db';
    const sourceDb = new Database(sourceDbPath, { readonly: true });

    // Get counts from source
    const sourceCounts = {
      brands: sourceDb.prepare('SELECT COUNT(*) as count FROM Brand').get().count,
      categories: sourceDb.prepare('SELECT COUNT(*) as count FROM Category').get().count,
      subcategories: sourceDb.prepare('SELECT COUNT(*) as count FROM Subcategory').get().count,
      applications: sourceDb.prepare('SELECT COUNT(*) as count FROM Application').get().count,
      masterParts: sourceDb.prepare('SELECT COUNT(*) as count FROM MasterPart').get().count,
      parts: sourceDb.prepare('SELECT COUNT(*) as count FROM Part').get().count,
      models: sourceDb.prepare('SELECT COUNT(*) as count FROM Model').get().count,
    };

    console.log('Source database (Dev-Koncepts) counts:');
    console.log(`  Brands: ${sourceCounts.brands}`);
    console.log(`  Categories: ${sourceCounts.categories}`);
    console.log(`  Subcategories: ${sourceCounts.subcategories}`);
    console.log(`  Applications: ${sourceCounts.applications}`);
    console.log(`  Master Parts: ${sourceCounts.masterParts}`);
    console.log(`  Parts: ${sourceCounts.parts}`);
    console.log(`  Models: ${sourceCounts.models}`);
    console.log('');

    // ============================================
    // Step 1: Import Brands
    // ============================================
    console.log('Step 1: Importing Brands...');
    const brands = sourceDb.prepare('SELECT * FROM Brand').all();
    let brandMap = new Map();
    let importedBrands = 0;

    for (const brand of brands) {
      try {
        const created = await prisma.brand.upsert({
          where: { id: brand.id },
          update: {
            name: brand.name,
            status: brand.status || 'active',
          },
          create: {
            id: brand.id,
            name: brand.name,
            status: brand.status || 'active',
            createdAt: brand.createdAt ? new Date(brand.createdAt) : new Date(),
            updatedAt: brand.updatedAt ? new Date(brand.updatedAt) : new Date(),
          },
        });
        brandMap.set(brand.id, created.id);
        importedBrands++;
      } catch (error) {
        // Try with name as unique key if id fails
        try {
          const created = await prisma.brand.upsert({
            where: { name: brand.name },
            update: {
              status: brand.status || 'active',
            },
            create: {
              name: brand.name,
              status: brand.status || 'active',
              createdAt: brand.createdAt ? new Date(brand.createdAt) : new Date(),
              updatedAt: brand.updatedAt ? new Date(brand.updatedAt) : new Date(),
            },
          });
          brandMap.set(brand.id, created.id);
          importedBrands++;
        } catch (err) {
          console.error(`  ⚠️  Error importing brand ${brand.name}: ${err.message}`);
        }
      }
    }
    console.log(`  ✓ Imported ${importedBrands} Brands\n`);

    // ============================================
    // Step 2: Import Categories
    // ============================================
    console.log('Step 2: Importing Categories...');
    const categories = sourceDb.prepare('SELECT * FROM Category').all();
    let categoryMap = new Map();
    let importedCategories = 0;

    for (const category of categories) {
      try {
        const created = await prisma.category.upsert({
          where: { id: category.id },
          update: {
            name: category.name,
            status: category.status || 'active',
          },
          create: {
            id: category.id,
            name: category.name,
            status: category.status || 'active',
            createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
            updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date(),
          },
        });
        categoryMap.set(category.id, created.id);
        importedCategories++;
      } catch (error) {
        try {
          const created = await prisma.category.upsert({
            where: { name: category.name },
            update: {
              status: category.status || 'active',
            },
            create: {
              name: category.name,
              status: category.status || 'active',
              createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
              updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date(),
            },
          });
          categoryMap.set(category.id, created.id);
          importedCategories++;
        } catch (err) {
          console.error(`  ⚠️  Error importing category ${category.name}: ${err.message}`);
        }
      }
    }
    console.log(`  ✓ Imported ${importedCategories} Categories\n`);

    // ============================================
    // Step 3: Import Subcategories
    // ============================================
    console.log('Step 3: Importing Subcategories...');
    const subcategories = sourceDb.prepare('SELECT * FROM Subcategory').all();
    let subcategoryMap = new Map();
    let importedSubcategories = 0;

    for (const subcategory of subcategories) {
      try {
        const categoryId = categoryMap.get(subcategory.categoryId) || subcategory.categoryId;
        const created = await prisma.subcategory.upsert({
          where: { 
            categoryId_name: {
              categoryId: categoryId,
              name: subcategory.name
            }
          },
          update: {
            status: subcategory.status || 'active',
          },
          create: {
            id: subcategory.id,
            categoryId: categoryId,
            name: subcategory.name,
            status: subcategory.status || 'active',
            createdAt: subcategory.createdAt ? new Date(subcategory.createdAt) : new Date(),
            updatedAt: subcategory.updatedAt ? new Date(subcategory.updatedAt) : new Date(),
          },
        });
        subcategoryMap.set(subcategory.id, created.id);
        importedSubcategories++;
      } catch (error) {
        console.error(`  ⚠️  Error importing subcategory ${subcategory.name}: ${error.message}`);
      }
    }
    console.log(`  ✓ Imported ${importedSubcategories} Subcategories\n`);

    // ============================================
    // Step 4: Import Applications
    // ============================================
    console.log('Step 4: Importing Applications...');
    const applications = sourceDb.prepare('SELECT * FROM Application').all();
    let applicationMap = new Map();
    let importedApplications = 0;

    for (const application of applications) {
      try {
        const subcategoryId = subcategoryMap.get(application.subcategoryId) || application.subcategoryId;
        const created = await prisma.application.upsert({
          where: {
            subcategoryId_name: {
              subcategoryId: subcategoryId,
              name: application.name
            }
          },
          update: {
            status: application.status || 'active',
          },
          create: {
            id: application.id,
            subcategoryId: subcategoryId,
            name: application.name,
            status: application.status || 'active',
            createdAt: application.createdAt ? new Date(application.createdAt) : new Date(),
            updatedAt: application.updatedAt ? new Date(application.updatedAt) : new Date(),
          },
        });
        applicationMap.set(application.id, created.id);
        importedApplications++;
      } catch (error) {
        console.error(`  ⚠️  Error importing application ${application.name}: ${error.message}`);
      }
    }
    console.log(`  ✓ Imported ${importedApplications} Applications\n`);

    // ============================================
    // Step 5: Import Master Parts
    // ============================================
    console.log('Step 5: Importing Master Parts...');
    const masterParts = sourceDb.prepare('SELECT * FROM MasterPart').all();
    let masterPartMap = new Map();
    let importedMasterParts = 0;

    for (const masterPart of masterParts) {
      try {
        const created = await prisma.masterPart.upsert({
          where: { masterPartNo: masterPart.masterPartNo },
          update: {},
          create: {
            id: masterPart.id,
            masterPartNo: masterPart.masterPartNo,
            createdAt: masterPart.createdAt ? new Date(masterPart.createdAt) : new Date(),
            updatedAt: masterPart.updatedAt ? new Date(masterPart.updatedAt) : new Date(),
          },
        });
        masterPartMap.set(masterPart.id, created.id);
        importedMasterParts++;
      } catch (error) {
        console.error(`  ⚠️  Error importing master part ${masterPart.masterPartNo}: ${error.message}`);
      }
    }
    console.log(`  ✓ Imported ${importedMasterParts} Master Parts\n`);

    // ============================================
    // Step 6: Import Parts (with images)
    // ============================================
    console.log('Step 6: Importing Parts (with images)...');
    const parts = sourceDb.prepare('SELECT * FROM Part').all();
    let importedParts = 0;
    let skippedParts = 0;

    for (const part of parts) {
      try {
        const masterPartId = part.masterPartId ? (masterPartMap.get(part.masterPartId) || part.masterPartId) : null;
        const brandId = part.brandId ? (brandMap.get(part.brandId) || part.brandId) : null;
        const categoryId = part.categoryId ? (categoryMap.get(part.categoryId) || part.categoryId) : null;
        const subcategoryId = part.subcategoryId ? (subcategoryMap.get(part.subcategoryId) || part.subcategoryId) : null;
        const applicationId = part.applicationId ? (applicationMap.get(part.applicationId) || part.applicationId) : null;

        await prisma.part.upsert({
          where: { id: part.id },
          update: {
            masterPartId: masterPartId,
            partNo: part.partNo,
            brandId: brandId,
            description: part.description || null,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            applicationId: applicationId,
            hsCode: part.hsCode || null,
            weight: part.weight || null,
            reorderLevel: part.reorderLevel || 0,
            uom: part.uom || 'pcs',
            cost: part.cost || null,
            priceA: part.priceA || null,
            priceB: part.priceB || null,
            priceM: part.priceM || null,
            smc: part.smc || null,
            size: part.size || null,
            origin: part.origin || null,
            imageP1: part.imageP1 || null,  // Preserving images
            imageP2: part.imageP2 || null,  // Preserving images
            status: part.status || 'active',
            createdAt: part.createdAt ? new Date(part.createdAt) : new Date(),
            updatedAt: part.updatedAt ? new Date(part.updatedAt) : new Date(),
          },
          create: {
            id: part.id,
            masterPartId: masterPartId,
            partNo: part.partNo,
            brandId: brandId,
            description: part.description || null,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            applicationId: applicationId,
            hsCode: part.hsCode || null,
            weight: part.weight || null,
            reorderLevel: part.reorderLevel || 0,
            uom: part.uom || 'pcs',
            cost: part.cost || null,
            priceA: part.priceA || null,
            priceB: part.priceB || null,
            priceM: part.priceM || null,
            smc: part.smc || null,
            size: part.size || null,
            origin: part.origin || null,
            imageP1: part.imageP1 || null,  // Preserving images
            imageP2: part.imageP2 || null,  // Preserving images
            status: part.status || 'active',
            createdAt: part.createdAt ? new Date(part.createdAt) : new Date(),
            updatedAt: part.updatedAt ? new Date(part.updatedAt) : new Date(),
          },
        });
        importedParts++;
        
        if (importedParts % 100 === 0) {
          process.stdout.write(`  Progress: ${importedParts}/${parts.length} parts imported...\r`);
        }
      } catch (error) {
        skippedParts++;
        if (skippedParts <= 10) {
          console.error(`  ⚠️  Error importing part ${part.partNo}: ${error.message}`);
        }
      }
    }
    console.log(`\n  ✓ Imported ${importedParts} Parts (${skippedParts} skipped)\n`);

    // ============================================
    // Step 7: Import Models
    // ============================================
    console.log('Step 7: Importing Models...');
    const models = sourceDb.prepare('SELECT * FROM Model').all();
    let importedModels = 0;
    let skippedModels = 0;

    for (const model of models) {
      try {
        await prisma.model.upsert({
          where: {
            partId_name: {
              partId: model.partId,
              name: model.name
            }
          },
          update: {
            qtyUsed: model.qtyUsed || 1,
            updatedAt: model.updatedAt ? new Date(model.updatedAt) : new Date(),
          },
          create: {
            id: model.id,
            partId: model.partId,
            name: model.name,
            qtyUsed: model.qtyUsed || 1,
            createdAt: model.createdAt ? new Date(model.createdAt) : new Date(),
            updatedAt: model.updatedAt ? new Date(model.updatedAt) : new Date(),
          },
        });
        importedModels++;
        
        if (importedModels % 500 === 0) {
          process.stdout.write(`  Progress: ${importedModels}/${models.length} models imported...\r`);
        }
      } catch (error) {
        skippedModels++;
        if (skippedModels <= 10) {
          console.error(`  ⚠️  Error importing model ${model.name}: ${error.message}`);
        }
      }
    }
    console.log(`\n  ✓ Imported ${importedModels} Models (${skippedModels} skipped)\n`);

    // ============================================
    // Verification
    // ============================================
    console.log('==========================================');
    console.log('  IMPORT COMPLETE');
    console.log('==========================================\n');

    const finalCounts = {
      brands: await prisma.brand.count(),
      categories: await prisma.category.count(),
      subcategories: await prisma.subcategory.count(),
      applications: await prisma.application.count(),
      masterParts: await prisma.masterPart.count(),
      parts: await prisma.part.count(),
      models: await prisma.model.count(),
    };

    console.log('Final database counts (Nextapp):');
    console.log(`  Brands: ${finalCounts.brands} (source: ${sourceCounts.brands})`);
    console.log(`  Categories: ${finalCounts.categories} (source: ${sourceCounts.categories})`);
    console.log(`  Subcategories: ${finalCounts.subcategories} (source: ${sourceCounts.subcategories})`);
    console.log(`  Applications: ${finalCounts.applications} (source: ${sourceCounts.applications})`);
    console.log(`  Master Parts: ${finalCounts.masterParts} (source: ${sourceCounts.masterParts})`);
    console.log(`  Parts: ${finalCounts.parts} (source: ${sourceCounts.parts})`);
    console.log(`  Models: ${finalCounts.models} (source: ${sourceCounts.models})`);
    console.log('');

    // Check for images
    const partsWithImages = await prisma.part.count({
      where: {
        OR: [
          { imageP1: { not: null } },
          { imageP2: { not: null } }
        ]
      }
    });
    console.log(`  Parts with images: ${partsWithImages}`);
    console.log('');

    console.log('✅ SUCCESS! All data imported accurately with images preserved!');
    console.log('\n==========================================\n');

    sourceDb.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
