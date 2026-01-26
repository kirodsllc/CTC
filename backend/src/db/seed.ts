import prisma from '../config/database';

async function seed() {
  try {
    const now = new Date();

    // Seed Categories
    const categories = [
      { name: 'Engine Parts' },
      { name: 'Brake System' },
      { name: 'Filters' },
      { name: 'Belts' },
      { name: 'Electrical' },
    ];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { name: cat.name },
        update: {},
        create: { name: cat.name },
      });
    }

    // Seed Brands
    const brands = [
      { name: 'Toyota' },
      { name: 'Honda' },
      { name: 'Nissan' },
      { name: 'Bosch' },
      { name: 'Brembo' },
      { name: 'Generic' },
    ];

    for (const brand of brands) {
      await prisma.brand.upsert({
        where: { name: brand.name },
        update: {},
        create: { name: brand.name },
      });
    }

    // Get seeded categories and brands for reference
    const seededCategories = await prisma.category.findMany();
    const seededBrands = await prisma.brand.findMany();

    // Seed Parts with categories, brands, costs, prices, and images
    const partsData = [
      { 
        partNo: 'ENG-001', 
        description: 'Engine Oil Filter - High Performance Synthetic Media', 
        category: 'Filters', 
        brand: 'Bosch', 
        cost: 500, 
        priceA: 750, 
        priceB: 650,
        priceM: 700,
        reorderLevel: 10,
        uom: 'pcs',
        hsCode: '84212300',
        weight: 0.5,
        size: 'Standard',
        smc: 'SMC-ENG-001',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-002', 
        description: 'Air Filter Element - Premium Quality Paper Media', 
        category: 'Filters', 
        brand: 'Bosch', 
        cost: 300, 
        priceA: 450,
        priceB: 400,
        priceM: 425,
        reorderLevel: 15,
        uom: 'pcs',
        hsCode: '84212300',
        weight: 0.3,
        size: 'Standard',
        smc: 'SMC-ENG-002',
        imageP1: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-003', 
        description: 'Fuel Filter - Inline High Pressure Filter', 
        category: 'Filters', 
        brand: 'Generic', 
        cost: 250, 
        priceA: 400,
        priceB: 350,
        priceM: 375,
        reorderLevel: 20,
        uom: 'pcs',
        hsCode: '84212300',
        weight: 0.2,
        size: 'Standard',
        smc: 'SMC-ENG-003',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'BRK-001', 
        description: 'Brake Pad Set Front - Ceramic Compound Low Noise', 
        category: 'Brake System', 
        brand: 'Brembo', 
        cost: 2000, 
        priceA: 3000,
        priceB: 2700,
        priceM: 2850,
        reorderLevel: 5,
        uom: 'set',
        hsCode: '87083900',
        weight: 1.2,
        size: 'Standard',
        smc: 'SMC-BRK-001',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'BRK-002', 
        description: 'Brake Pad Set Rear - Ceramic Compound Low Noise', 
        category: 'Brake System', 
        brand: 'Brembo', 
        cost: 1500, 
        priceA: 2250,
        priceB: 2000,
        priceM: 2125,
        reorderLevel: 5,
        uom: 'set',
        hsCode: '87083900',
        weight: 0.9,
        size: 'Standard',
        smc: 'SMC-BRK-002',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'BRK-003', 
        description: 'Brake Disc Front - Ventilated Rotor High Performance', 
        category: 'Brake System', 
        brand: 'Brembo', 
        cost: 3500, 
        priceA: 5000,
        priceB: 4500,
        priceM: 4750,
        reorderLevel: 3,
        uom: 'pcs',
        hsCode: '87083900',
        weight: 8.5,
        size: 'Standard',
        smc: 'SMC-BRK-003',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-004', 
        description: 'Timing Belt - Reinforced Rubber with Fiber Cord', 
        category: 'Belts', 
        brand: 'Generic', 
        cost: 1200, 
        priceA: 1800,
        priceB: 1600,
        priceM: 1700,
        reorderLevel: 8,
        uom: 'pcs',
        hsCode: '40109900',
        weight: 0.4,
        size: 'Standard',
        smc: 'SMC-ENG-004',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-005', 
        description: 'Serpentine Belt - Multi-Rib V-Belt', 
        category: 'Belts', 
        brand: 'Generic', 
        cost: 800, 
        priceA: 1200,
        priceB: 1100,
        priceM: 1150,
        reorderLevel: 10,
        uom: 'pcs',
        hsCode: '40109900',
        weight: 0.3,
        size: 'Standard',
        smc: 'SMC-ENG-005',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-006', 
        description: 'Spark Plug Set - Iridium Tip Long Life', 
        category: 'Engine Parts', 
        brand: 'Bosch', 
        cost: 600, 
        priceA: 900,
        priceB: 800,
        priceM: 850,
        reorderLevel: 12,
        uom: 'set',
        hsCode: '85111000',
        weight: 0.2,
        size: 'Standard',
        smc: 'SMC-ENG-006',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-007', 
        description: 'Oil Pump - Mechanical Gear Type', 
        category: 'Engine Parts', 
        brand: 'Toyota', 
        cost: 5000, 
        priceA: 7500,
        priceB: 7000,
        priceM: 7250,
        reorderLevel: 2,
        uom: 'pcs',
        hsCode: '84133000',
        weight: 2.5,
        size: 'Standard',
        smc: 'SMC-ENG-007',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-008', 
        description: 'Water Pump - Aluminum Housing with Impeller', 
        category: 'Engine Parts', 
        brand: 'Toyota', 
        cost: 4500, 
        priceA: 6500,
        priceB: 6000,
        priceM: 6250,
        reorderLevel: 3,
        uom: 'pcs',
        hsCode: '84133000',
        weight: 2.0,
        size: 'Standard',
        smc: 'SMC-ENG-008',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ELC-001', 
        description: 'Alternator - 12V 90A High Output', 
        category: 'Electrical', 
        brand: 'Honda', 
        cost: 8000, 
        priceA: 12000,
        priceB: 11000,
        priceM: 11500,
        reorderLevel: 2,
        uom: 'pcs',
        hsCode: '85115000',
        weight: 5.5,
        size: 'Standard',
        smc: 'SMC-ELC-001',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ELC-002', 
        description: 'Starter Motor - 12V High Torque', 
        category: 'Electrical', 
        brand: 'Honda', 
        cost: 6000, 
        priceA: 9000,
        priceB: 8500,
        priceM: 8750,
        reorderLevel: 2,
        uom: 'pcs',
        hsCode: '85115000',
        weight: 4.2,
        size: 'Standard',
        smc: 'SMC-ELC-002',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ELC-003', 
        description: 'Battery 12V 60Ah - Maintenance Free', 
        category: 'Electrical', 
        brand: 'Generic', 
        cost: 4000, 
        priceA: 6000,
        priceB: 5500,
        priceM: 5750,
        reorderLevel: 5,
        uom: 'pcs',
        hsCode: '85072000',
        weight: 18.0,
        size: 'Standard',
        smc: 'SMC-ELC-003',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'FIL-004', 
        description: 'Cabin Air Filter - Activated Carbon', 
        category: 'Filters', 
        brand: 'Bosch', 
        cost: 400, 
        priceA: 600,
        priceB: 550,
        priceM: 575,
        reorderLevel: 15,
        uom: 'pcs',
        hsCode: '84212300',
        weight: 0.25,
        size: 'Standard',
        smc: 'SMC-FIL-004',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'BRK-004', 
        description: 'Brake Fluid DOT 4 - 500ml Bottle', 
        category: 'Brake System', 
        brand: 'Brembo', 
        cost: 500, 
        priceA: 750,
        priceB: 700,
        priceM: 725,
        reorderLevel: 10,
        uom: 'bottle',
        hsCode: '38190000',
        weight: 0.6,
        size: '500ml',
        smc: 'SMC-BRK-004',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-009', 
        description: 'Radiator - Aluminum Core with Plastic Tanks', 
        category: 'Engine Parts', 
        brand: 'Toyota', 
        cost: 6000, 
        priceA: 9000,
        priceB: 8500,
        priceM: 8750,
        reorderLevel: 2,
        uom: 'pcs',
        hsCode: '87089100',
        weight: 12.0,
        size: 'Standard',
        smc: 'SMC-ENG-009',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ELC-004', 
        description: 'Headlight Bulb H4 - Halogen 60/55W', 
        category: 'Electrical', 
        brand: 'Generic', 
        cost: 200, 
        priceA: 300,
        priceB: 280,
        priceM: 290,
        reorderLevel: 20,
        uom: 'pcs',
        hsCode: '85392100',
        weight: 0.1,
        size: 'H4',
        smc: 'SMC-ELC-004',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'SUS-001', 
        description: 'Shock Absorber Front - Gas Filled', 
        category: 'Engine Parts', 
        brand: 'Nissan', 
        cost: 3500, 
        priceA: 5000,
        priceB: 4500,
        priceM: 4750,
        reorderLevel: 4,
        uom: 'pcs',
        hsCode: '87088000',
        weight: 3.5,
        size: 'Standard',
        smc: 'SMC-SUS-001',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'SUS-002', 
        description: 'Shock Absorber Rear - Gas Filled', 
        category: 'Engine Parts', 
        brand: 'Nissan', 
        cost: 3200, 
        priceA: 4500,
        priceB: 4000,
        priceM: 4250,
        reorderLevel: 4,
        uom: 'pcs',
        hsCode: '87088000',
        weight: 3.2,
        size: 'Standard',
        smc: 'SMC-SUS-002',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
      { 
        partNo: 'ENG-010', 
        description: 'Thermostat - Wax Type 82°C', 
        category: 'Engine Parts', 
        brand: 'Generic', 
        cost: 300, 
        priceA: 450,
        priceB: 400,
        priceM: 425,
        reorderLevel: 15,
        uom: 'pcs',
        hsCode: '84818000',
        weight: 0.15,
        size: 'Standard',
        smc: 'SMC-ENG-010',
        imageP1: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop',
        imageP2: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400&h=400&fit=crop'
      },
    ];

    const createdParts = [];
    for (const partData of partsData) {
      const category = seededCategories.find(c => c.name === partData.category);
      const brand = seededBrands.find(b => b.name === partData.brand);

      if (category && brand) {
        const part = await prisma.part.upsert({
          where: { partNo: partData.partNo },
          update: {
            description: partData.description,
            categoryId: category.id,
            brandId: brand.id,
            cost: partData.cost,
            priceA: partData.priceA,
            priceB: partData.priceB,
            priceM: partData.priceM,
            reorderLevel: partData.reorderLevel,
            status: 'active',
            uom: partData.uom,
            hsCode: partData.hsCode,
            weight: partData.weight,
            size: partData.size,
            smc: partData.smc,
            imageP1: partData.imageP1,
            imageP2: partData.imageP2,
          },
          create: {
            partNo: partData.partNo,
            description: partData.description,
            categoryId: category.id,
            brandId: brand.id,
            cost: partData.cost,
            priceA: partData.priceA,
            priceB: partData.priceB,
            priceM: partData.priceM,
            reorderLevel: partData.reorderLevel,
            status: 'active',
            uom: partData.uom,
            hsCode: partData.hsCode,
            weight: partData.weight,
            size: partData.size,
            smc: partData.smc,
            imageP1: partData.imageP1,
            imageP2: partData.imageP2,
          },
        });
        createdParts.push(part);
      }
    }

    // Seed Stores FIRST (before stock movements)
    const storesData = [
      { name: 'Main Store', code: 'MAIN-STORE', address: '123 Main Street, City Center' },
      { name: 'Warehouse A', code: 'WAREHOUSE-A', address: '456 Industrial Road, Industrial Area' },
      { name: 'Branch Office', code: 'BRANCH-01', address: '789 Business Park, Downtown' },
      { name: 'Outlet Store', code: 'OUTLET-01', address: '321 Shopping Mall, Retail District' },
    ];

    const createdStores = [];
    for (const storeData of storesData) {
      const store = await prisma.store.upsert({
        where: { code: storeData.code },
        update: {},
        create: {
          code: storeData.code,
          name: storeData.name,
          address: storeData.address,
          status: 'active',
        },
      });
      createdStores.push(store);
    }

    // Seed Racks for each store
    const racksData = [
      { codeNo: 'RACK-001', storeCode: 'MAIN-STORE', description: 'Main Rack A' },
      { codeNo: 'RACK-002', storeCode: 'MAIN-STORE', description: 'Main Rack B' },
      { codeNo: 'RACK-003', storeCode: 'WAREHOUSE-A', description: 'Warehouse Rack 1' },
      { codeNo: 'RACK-004', storeCode: 'WAREHOUSE-A', description: 'Warehouse Rack 2' },
      { codeNo: 'RACK-005', storeCode: 'BRANCH-01', description: 'Branch Rack 1' },
      { codeNo: 'RACK-006', storeCode: 'OUTLET-01', description: 'Outlet Rack 1' },
    ];

    const createdRacks = [];
    for (const rackData of racksData) {
      const store = createdStores.find(s => s.code === rackData.storeCode);
      if (store) {
        const rack = await prisma.rack.upsert({
          where: { codeNo: rackData.codeNo },
          update: {},
          create: {
            codeNo: rackData.codeNo,
            storeId: store.id,
            description: rackData.description,
            status: 'Active',
          },
        });
        createdRacks.push(rack);
      }
    }

    // Seed Shelves for each rack
    const shelvesData = [
      { shelfNo: 'SHELF-A1', rackCode: 'RACK-001', description: 'Top Shelf' },
      { shelfNo: 'SHELF-A2', rackCode: 'RACK-001', description: 'Middle Shelf' },
      { shelfNo: 'SHELF-A3', rackCode: 'RACK-001', description: 'Bottom Shelf' },
      { shelfNo: 'SHELF-B1', rackCode: 'RACK-002', description: 'Top Shelf' },
      { shelfNo: 'SHELF-B2', rackCode: 'RACK-002', description: 'Middle Shelf' },
      { shelfNo: 'SHELF-W1', rackCode: 'RACK-003', description: 'Warehouse Shelf 1' },
      { shelfNo: 'SHELF-W2', rackCode: 'RACK-003', description: 'Warehouse Shelf 2' },
      { shelfNo: 'SHELF-BR1', rackCode: 'RACK-005', description: 'Branch Shelf 1' },
    ];

    const createdShelves = [];
    for (const shelfData of shelvesData) {
      const rack = createdRacks.find(r => r.codeNo === shelfData.rackCode);
      if (rack) {
        const shelf = await prisma.shelf.upsert({
          where: {
            rackId_shelfNo: {
              rackId: rack.id,
              shelfNo: shelfData.shelfNo,
            },
          },
          update: {},
          create: {
            shelfNo: shelfData.shelfNo,
            rackId: rack.id,
            description: shelfData.description,
            status: 'Active',
          },
        });
        createdShelves.push(shelf);
      }
    }

    // Seed Stock Movements (Stock In/Out) to create stock levels
    
    // Use the created stores, racks, and shelves
    const allStores = createdStores;
    const allRacks = createdRacks;
    const allShelves = createdShelves;
    
    const movements = [];
    
    // Create stock movements for the last 6 months with stores, racks, and shelves
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const movementDate = new Date(now);
      movementDate.setMonth(movementDate.getMonth() - monthOffset);
      
      // Stock In movements with locations
      for (let i = 0; i < createdParts.length; i++) {
        const part = createdParts[i];
        const qtyIn = Math.floor(Math.random() * 50) + 10; // 10-60 units
        
        // Assign random store, rack, and shelf
        const store = allStores[Math.floor(Math.random() * allStores.length)];
        const storeRacks = allRacks.filter(r => r.storeId === store.id);
        const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
        const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
        const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
        
        movements.push({
          partId: part.id,
          type: 'in',
          quantity: qtyIn,
          storeId: store.id,
          rackId: rack?.id || null,
          shelfId: shelf?.id || null,
          createdAt: new Date(movementDate.getTime() + Math.random() * 28 * 24 * 60 * 60 * 1000),
        });
      }
      
      // Stock Out movements (some parts)
      for (let i = 0; i < Math.floor(createdParts.length * 0.7); i++) {
        const part = createdParts[Math.floor(Math.random() * createdParts.length)];
        const qtyOut = Math.floor(Math.random() * 30) + 5; // 5-35 units
        
        const store = allStores[Math.floor(Math.random() * allStores.length)];
        const storeRacks = allRacks.filter(r => r.storeId === store.id);
        const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
        const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
        const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
        
        movements.push({
          partId: part.id,
          type: 'out',
          quantity: qtyOut,
          storeId: store.id,
          rackId: rack?.id || null,
          shelfId: shelf?.id || null,
          createdAt: new Date(movementDate.getTime() + Math.random() * 28 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // Create varied movement patterns for realistic analysis
    // Fast moving items (recent activity within 30 days)
    const fastMovingParts = createdParts.slice(0, Math.floor(createdParts.length * 0.3));
    for (const part of fastMovingParts) {
      // Multiple movements in last 30 days
      for (let j = 0; j < 3; j++) {
        const daysAgo = Math.random() * 30;
        const qty = Math.floor(Math.random() * 50) + 20;
        const store = allStores[Math.floor(Math.random() * allStores.length)];
        const storeRacks = allRacks.filter(r => r.storeId === store.id);
        const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
        const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
        const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
        
        await prisma.stockMovement.create({
          data: {
            partId: part.id,
            type: 'in',
            quantity: qty,
            storeId: store.id,
            rackId: rack?.id || null,
            shelfId: shelf?.id || null,
            createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });
      }
      // Some out movements too
      for (let j = 0; j < 2; j++) {
        const daysAgo = Math.random() * 30;
        const qty = Math.floor(Math.random() * 30) + 10;
        const store = allStores[Math.floor(Math.random() * allStores.length)];
        const storeRacks = allRacks.filter(r => r.storeId === store.id);
        const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
        const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
        const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
        
        await prisma.stockMovement.create({
          data: {
            partId: part.id,
            type: 'out',
            quantity: qty,
            storeId: store.id,
            rackId: rack?.id || null,
            shelfId: shelf?.id || null,
            createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    // Normal moving items (activity 30-90 days ago)
    const normalMovingParts = createdParts.slice(Math.floor(createdParts.length * 0.3), Math.floor(createdParts.length * 0.7));
    for (const part of normalMovingParts) {
      const daysAgo = 30 + Math.random() * 60; // 30-90 days ago
      const qty = Math.floor(Math.random() * 40) + 15;
      const store = allStores[Math.floor(Math.random() * allStores.length)];
      const storeRacks = allRacks.filter(r => r.storeId === store.id);
      const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
      const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
      const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
      
      await prisma.stockMovement.create({
        data: {
          partId: part.id,
          type: 'in',
          quantity: qty,
          storeId: store.id,
          rackId: rack?.id || null,
          shelfId: shelf?.id || null,
          createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Slow moving items (activity 90-180 days ago)
    const slowMovingParts = createdParts.slice(Math.floor(createdParts.length * 0.7), Math.floor(createdParts.length * 0.9));
    for (const part of slowMovingParts) {
      const daysAgo = 90 + Math.random() * 90; // 90-180 days ago
      const qty = Math.floor(Math.random() * 30) + 10;
      const store = allStores[Math.floor(Math.random() * allStores.length)];
      const storeRacks = allRacks.filter(r => r.storeId === store.id);
      const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
      const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
      const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
      
      await prisma.stockMovement.create({
        data: {
          partId: part.id,
          type: 'in',
          quantity: qty,
          storeId: store.id,
          rackId: rack?.id || null,
          shelfId: shelf?.id || null,
          createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Dead stock items (activity more than 180 days ago or no activity)
    const deadStockParts = createdParts.slice(Math.floor(createdParts.length * 0.9));
    for (const part of deadStockParts) {
      // Some have very old movements, some have none
      if (Math.random() > 0.3) {
        const daysAgo = 180 + Math.random() * 180; // 180-360 days ago
        const qty = Math.floor(Math.random() * 20) + 5;
        const store = allStores[Math.floor(Math.random() * allStores.length)];
        const storeRacks = allRacks.filter(r => r.storeId === store.id);
        const rack = storeRacks.length > 0 ? storeRacks[Math.floor(Math.random() * storeRacks.length)] : null;
        const rackShelves = rack ? allShelves.filter(s => s.rackId === rack.id) : [];
        const shelf = rackShelves.length > 0 ? rackShelves[Math.floor(Math.random() * rackShelves.length)] : null;
        
        await prisma.stockMovement.create({
          data: {
            partId: part.id,
            type: 'in',
            quantity: qty,
            storeId: store.id,
            rackId: rack?.id || null,
            shelfId: shelf?.id || null,
            createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });
      }
      // Others have no movements (will show as dead stock)
    }

    // Add historical movements with locations
    for (const movement of movements.slice(0, 100)) {
      await prisma.stockMovement.create({
        data: movement,
      });
    }


    // Seed Sample Transfers
    const allStoresForTransfer = await prisma.store.findMany();
    const allRacksForTransfer = await prisma.rack.findMany();
    const allShelvesForTransfer = await prisma.shelf.findMany();
    
    if (allStoresForTransfer.length >= 2 && createdParts.length > 0) {
      // Check if transfers already exist
      const transferNum1 = `STR-${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`;
      const transferNum2 = `STR-${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-002`;
      
      const existingTransfers = await prisma.transfer.findMany({
        where: {
          transferNumber: {
            in: [transferNum1, transferNum2],
          },
        },
      });

      if (existingTransfers.length === 0) {
        const transferDate1 = new Date(now);
        transferDate1.setDate(transferDate1.getDate() - 5);
        
        const transferDate2 = new Date(now);
        transferDate2.setDate(transferDate2.getDate() - 2);
        
        // Transfer 1
        const transfer1 = await prisma.transfer.create({
        data: {
          transferNumber: transferNum1,
          date: transferDate1,
          status: 'Completed',
          notes: 'Sample transfer from Main Store to Warehouse A',
          fromStoreId: allStoresForTransfer[0].id,
          toStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
          totalQty: 25,
          items: {
            create: [
              {
                partId: createdParts[0].id,
                fromStoreId: allStoresForTransfer[0].id,
                fromRackId: allRacksForTransfer[0]?.id || null,
                fromShelfId: allShelvesForTransfer[0]?.id || null,
                toStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
                toRackId: allRacksForTransfer[1]?.id || null,
                toShelfId: allShelvesForTransfer[1]?.id || null,
                quantity: 15,
              },
              {
                partId: createdParts[1]?.id || createdParts[0].id,
                fromStoreId: allStoresForTransfer[0].id,
                fromRackId: allRacksForTransfer[0]?.id || null,
                fromShelfId: allShelvesForTransfer[0]?.id || null,
                toStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
                toRackId: allRacksForTransfer[2]?.id || null,
                toShelfId: allShelvesForTransfer[2]?.id || null,
                quantity: 10,
              },
            ],
          },
        },
      });
      
      // Transfer 2
      const transfer2 = await prisma.transfer.create({
        data: {
          transferNumber: transferNum2,
          date: transferDate2,
          status: 'Pending',
          notes: 'Pending transfer for review',
          fromStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
          toStoreId: allStoresForTransfer[2]?.id || allStoresForTransfer[0].id,
          totalQty: 30,
          items: {
            create: [
              {
                partId: createdParts[2]?.id || createdParts[0].id,
                fromStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
                fromRackId: allRacksForTransfer[2]?.id || null,
                fromShelfId: allShelvesForTransfer[2]?.id || null,
                toStoreId: allStoresForTransfer[2]?.id || allStoresForTransfer[0].id,
                toRackId: allRacksForTransfer[3]?.id || null,
                toShelfId: allShelvesForTransfer[3]?.id || null,
                quantity: 20,
              },
              {
                partId: createdParts[3]?.id || createdParts[0].id,
                fromStoreId: allStoresForTransfer[1]?.id || allStoresForTransfer[0].id,
                fromRackId: allRacksForTransfer[2]?.id || null,
                fromShelfId: allShelvesForTransfer[2]?.id || null,
                toStoreId: allStoresForTransfer[2]?.id || allStoresForTransfer[0].id,
                toRackId: allRacksForTransfer[4]?.id || null,
                toShelfId: allShelvesForTransfer[4]?.id || null,
                quantity: 10,
              },
            ],
          },
        },
      });
      
      } else {
      }
    } else {
    }

    // Seed Sample Adjustments
    const allStoresForAdjustment = await prisma.store.findMany();
    
    if (allStoresForAdjustment.length > 0 && createdParts.length > 0) {
      const adjustmentDate1 = new Date(now);
      adjustmentDate1.setDate(adjustmentDate1.getDate() - 5);
      
      const adjustmentDate2 = new Date(now);
      adjustmentDate2.setDate(adjustmentDate2.getDate() - 10);
      
      const adjustmentDate3 = new Date(now);
      adjustmentDate3.setDate(adjustmentDate3.getDate() - 15);

      const store1 = allStoresForAdjustment[0];
      const part1 = createdParts[0];
      const part2 = createdParts[1];
      const part3 = createdParts[2] || createdParts[0];

      // Adjustment 1: Add inventory
      const adjustment1 = await prisma.adjustment.create({
        data: {
          date: adjustmentDate1,
          subject: 'Stock correction after physical count',
          storeId: store1.id,
          addInventory: true,
          notes: 'Found additional stock during inventory audit',
          totalAmount: (part1.cost || 0) * 10 + (part2.cost || 0) * 5,
          items: {
            create: [
              {
                partId: part1.id,
                quantity: 10,
                cost: part1.cost || null,
                notes: 'Additional stock found',
              },
              {
                partId: part2.id,
                quantity: 5,
                cost: part2.cost || null,
                notes: 'Stock correction',
              },
            ],
          },
        },
      });

      // Create stock movements for adjustment 1
      await prisma.stockMovement.createMany({
        data: [
          {
            partId: part1.id,
            type: 'in',
            quantity: 10,
            storeId: store1.id,
            referenceType: 'adjustment',
            referenceId: adjustment1.id,
            notes: 'Adjustment: Stock correction after physical count',
          },
          {
            partId: part2.id,
            type: 'in',
            quantity: 5,
            storeId: store1.id,
            referenceType: 'adjustment',
            referenceId: adjustment1.id,
            notes: 'Adjustment: Stock correction after physical count',
          },
        ],
      });

      // Adjustment 2: Remove inventory
      const adjustment2 = await prisma.adjustment.create({
        data: {
          date: adjustmentDate2,
          subject: 'Damaged items write-off',
          storeId: store1.id,
          addInventory: false,
          notes: 'Removed damaged items from inventory',
          totalAmount: (part1.cost || 0) * 3,
          items: {
            create: [
              {
                partId: part1.id,
                quantity: 3,
                cost: part1.cost || null,
                notes: 'Damaged items',
              },
            ],
          },
        },
      });

      // Create stock movements for adjustment 2
      await prisma.stockMovement.create({
        data: {
          partId: part1.id,
          type: 'out',
          quantity: 3,
          storeId: store1.id,
          referenceType: 'adjustment',
          referenceId: adjustment2.id,
          notes: 'Adjustment: Damaged items write-off',
        },
      });

      // Adjustment 3: Add inventory
      const adjustment3 = await prisma.adjustment.create({
        data: {
          date: adjustmentDate3,
          subject: 'Returned items from customer',
          storeId: store1.id,
          addInventory: true,
          notes: 'Items returned in good condition',
          totalAmount: (part3.cost || 0) * 8,
          items: {
            create: [
              {
                partId: part3.id,
                quantity: 8,
                cost: part3.cost || null,
                notes: 'Returned items',
              },
            ],
          },
        },
      });

      // Create stock movements for adjustment 3
      await prisma.stockMovement.create({
        data: {
          partId: part3.id,
          type: 'in',
          quantity: 8,
          storeId: store1.id,
          referenceType: 'adjustment',
          referenceId: adjustment3.id,
          notes: 'Adjustment: Returned items from customer',
        },
      });

    } else {
    }

    // Note: Summary will be printed at the end after all seeding is complete

    // Seed Sample Direct Purchase Orders
    const allStoresForDPO = await prisma.store.findMany();
    
    if (allStoresForDPO.length > 0 && createdParts.length > 0) {
      const dpoDate1 = new Date(now);
      dpoDate1.setDate(dpoDate1.getDate() - 3);
      
      const dpoDate2 = new Date(now);
      dpoDate2.setDate(dpoDate2.getDate() - 7);

      const store1 = allStoresForDPO[0];
      const part1 = createdParts[0];
      const part2 = createdParts[1];
      const part3 = createdParts[2] || createdParts[0];

      const dpoNumber1 = `DPO-${new Date().getFullYear()}-001`;
      const dpoNumber2 = `DPO-${new Date().getFullYear()}-002`;

      // Check if DPOs already exist
      const existingDPO1 = await prisma.directPurchaseOrder.findUnique({
        where: { dpoNumber: dpoNumber1 },
      });
      const existingDPO2 = await prisma.directPurchaseOrder.findUnique({
        where: { dpoNumber: dpoNumber2 },
      });

      if (!existingDPO1) {
        // DPO 1
        const dpo1 = await prisma.directPurchaseOrder.create({
          data: {
            dpoNumber: dpoNumber1,
          date: dpoDate1,
          storeId: store1.id,
          account: 'Cash Account',
          description: 'Direct purchase for urgent stock replenishment',
          status: 'Completed',
          totalAmount: (part1.cost || 0) * 20 + (part2.cost || 0) * 15,
          items: {
            create: [
              {
                partId: part1.id,
                quantity: 20,
                purchasePrice: part1.cost || 0,
                salePrice: part1.priceA || part1.cost || 0,
                amount: (part1.cost || 0) * 20,
              },
              {
                partId: part2.id,
                quantity: 15,
                purchasePrice: part2.cost || 0,
                salePrice: part2.priceA || part2.cost || 0,
                amount: (part2.cost || 0) * 15,
              },
            ],
          },
          expenses: {
            create: [
              {
                expenseType: 'Freight',
                payableAccount: 'Freight Payable',
                description: 'Shipping charges',
                amount: 500,
              },
            ],
          },
        },
      });

        // Create stock movements for DPO 1
        await prisma.stockMovement.createMany({
        data: [
          {
            partId: part1.id,
            type: 'in',
            quantity: 20,
            storeId: store1.id,
            referenceType: 'direct_purchase',
            referenceId: dpo1.id,
            notes: `Direct Purchase Order: ${dpo1.dpoNumber}`,
          },
          {
            partId: part2.id,
            type: 'in',
            quantity: 15,
            storeId: store1.id,
            referenceType: 'direct_purchase',
            referenceId: dpo1.id,
            notes: `Direct Purchase Order: ${dpo1.dpoNumber}`,
          },
        ],
        });
      }

      if (!existingDPO2) {
        // DPO 2
        const dpo2 = await prisma.directPurchaseOrder.create({
        data: {
          dpoNumber: dpoNumber2,
          date: dpoDate2,
          storeId: store1.id,
          account: 'Bank Account',
          description: 'Bulk purchase for seasonal demand',
          status: 'Completed',
          totalAmount: (part3.cost || 0) * 50,
          items: {
            create: [
              {
                partId: part3.id,
                quantity: 50,
                purchasePrice: part3.cost || 0,
                salePrice: part3.priceA || part3.cost || 0,
                amount: (part3.cost || 0) * 50,
              },
            ],
          },
        },
      });

        // Create stock movements for DPO 2
        await prisma.stockMovement.create({
          data: {
            partId: part3.id,
            type: 'in',
            quantity: 50,
            storeId: store1.id,
            referenceType: 'direct_purchase',
            referenceId: dpo2.id,
            notes: `Direct Purchase Order: ${dpo2.dpoNumber}`,
          },
        });
      }

      const dpoCount = (existingDPO1 ? 0 : 1) + (existingDPO2 ? 0 : 1);
      if (dpoCount > 0) {
      } else {
      }
    } else {
    }


    // Seed Accounting Data
    
    // Seed Main Groups
    const mainGroupsData = [
      { code: '1', name: 'Current Assets', type: 'asset', displayOrder: 1 },
      { code: '2', name: 'Long Term Assets', type: 'asset', displayOrder: 2 },
      { code: '3', name: 'Current Liabilities', type: 'liability', displayOrder: 3 },
      { code: '4', name: 'Long Term Liabilities', type: 'liability', displayOrder: 4 },
      { code: '5', name: 'Capital', type: 'equity', displayOrder: 5 },
      { code: '6', name: 'Drawings', type: 'equity', displayOrder: 6 },
      { code: '7', name: 'Revenues', type: 'revenue', displayOrder: 7 },
      { code: '8', name: 'Expenses', type: 'expense', displayOrder: 8 },
      { code: '9', name: 'Cost', type: 'cost', displayOrder: 9 },
    ];

    const createdMainGroups = [];
    for (const mgData of mainGroupsData) {
      const mg = await prisma.mainGroup.upsert({
        where: { code: mgData.code },
        update: {},
        create: mgData,
      });
      createdMainGroups.push(mg);
    }

    // Seed Subgroups
    const subgroupsData = [
      { mainGroupCode: '1', code: '101', name: 'Inventory' },
      { mainGroupCode: '1', code: '102', name: 'Cash' },
      { mainGroupCode: '1', code: '103', name: 'Bank' },
      { mainGroupCode: '1', code: '104', name: 'Sales Customer Receivables' },
      { mainGroupCode: '1', code: '108', name: 'BANK ACCOUNT' },
      { mainGroupCode: '2', code: '206', name: 'SHOP INVESTMENT' },
      { mainGroupCode: '3', code: '301', name: 'Purchase Orders Payables' },
      { mainGroupCode: '3', code: '302', name: 'Purchase Expenses Payables' },
      { mainGroupCode: '3', code: '303', name: 'Salaries' },
      { mainGroupCode: '4', code: '304', name: 'Other Payables' },
      { mainGroupCode: '5', code: '501', name: "Owner's Equity" },
      { mainGroupCode: '6', code: '601', name: 'Owner Drawings' },
      { mainGroupCode: '7', code: '701', name: 'Sales Revenue' },
      { mainGroupCode: '8', code: '801', name: 'Operating Expenses' },
      { mainGroupCode: '9', code: '901', name: 'Cost of Goods Sold' },
    ];

    const createdSubgroups = [];
    for (const sgData of subgroupsData) {
      const mainGroup = createdMainGroups.find(mg => mg.code === sgData.mainGroupCode);
      if (mainGroup) {
        const sg = await prisma.subgroup.upsert({
          where: { code: sgData.code },
          update: {},
          create: {
            mainGroupId: mainGroup.id,
            code: sgData.code,
            name: sgData.name,
            isActive: true,
            canDelete: true,
          },
        });
        createdSubgroups.push(sg);
      }
    }

    // Seed Sample Accounts
    const accountsData = [
      { subgroupCode: '102', code: '102001', name: 'Cash in Hand', openingBalance: 50000 },
      { subgroupCode: '103', code: '103015', name: 'JAZCASH', openingBalance: 25000 },
      { subgroupCode: '103', code: '103016', name: 'EASYPAISA', openingBalance: 15000 },
      { subgroupCode: '103', code: '103017', name: 'BANK ALFALAH', openingBalance: 100000 },
      { subgroupCode: '103', code: '103018', name: 'HBL', openingBalance: 75000 },
      { subgroupCode: '103', code: '103019', name: 'CASH', openingBalance: 30000 },
      { subgroupCode: '104', code: '104001', name: 'Accounts Receivable', openingBalance: 0 },
      { subgroupCode: '301', code: '301001', name: 'Accounts Payable', openingBalance: 0 },
      { subgroupCode: '501', code: '501001', name: "Owner's Capital", openingBalance: 500000 },
      { subgroupCode: '701', code: '701001', name: 'Sales Revenue', openingBalance: 0 },
      { subgroupCode: '801', code: '801001', name: 'Operating Expenses', openingBalance: 0 },
      { subgroupCode: '901', code: '901001', name: 'Cost of Goods Sold', openingBalance: 0 },
    ];

    const createdAccounts = [];
    for (const accData of accountsData) {
      const subgroup = createdSubgroups.find(sg => sg.code === accData.subgroupCode);
      if (subgroup) {
        const acc = await prisma.account.upsert({
          where: { code: accData.code },
          update: {},
          create: {
            subgroupId: subgroup.id,
            code: accData.code,
            name: accData.name,
            openingBalance: accData.openingBalance,
            currentBalance: accData.openingBalance,
            status: 'Active',
            canDelete: true,
          },
        });
        createdAccounts.push(acc);
      }
    }


    // Seed Customers
    const customersData = [
      {
        name: 'Ahmed Auto Parts',
        address: '123 Main Street, Karachi',
        email: 'ahmed@autoparts.com',
        contactNo: '+92-300-1234567',
        cnic: '42101-1234567-1',
        openingBalance: 50000,
        creditLimit: 200000,
      },
      {
        name: 'Hassan Motors',
        address: '456 Business Avenue, Lahore',
        email: 'hassan@motors.com',
        contactNo: '+92-300-2345678',
        cnic: '35202-2345678-2',
        openingBalance: 75000,
        creditLimit: 300000,
      },
      {
        name: 'Ali Trading Company',
        address: '789 Market Road, Islamabad',
        email: 'ali@trading.com',
        contactNo: '+92-300-3456789',
        cnic: '37303-3456789-3',
        openingBalance: 100000,
        creditLimit: 500000,
      },
      {
        name: 'Zain Enterprises',
        address: '321 Commercial Plaza, Faisalabad',
        email: 'zain@enterprises.com',
        contactNo: '+92-300-4567890',
        cnic: '36104-4567890-4',
        openingBalance: 30000,
        creditLimit: 150000,
      },
      {
        name: 'Bilal Auto Services',
        address: '654 Service Center, Rawalpindi',
        email: 'bilal@autoservices.com',
        contactNo: '+92-300-5678901',
        cnic: '37305-5678901-5',
        openingBalance: 25000,
        creditLimit: 100000,
      },
    ];

    const createdCustomers = [];
    for (const customerData of customersData) {
      // Check if customer exists by name
      const existing = await prisma.customer.findFirst({
        where: { name: customerData.name },
      });
      
      if (!existing) {
        const customer = await prisma.customer.create({
          data: customerData,
        });
        createdCustomers.push(customer);
      } else {
        createdCustomers.push(existing);
      }
    }

    // Seed Suppliers
    const suppliersData = [
      {
        code: 'SUP-001',
        name: 'Auto Parts Distributors Ltd',
        companyName: 'Auto Parts Distributors Limited',
        address: '100 Industrial Area, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        country: 'Pakistan',
        zipCode: '75000',
        email: 'info@autopartsdist.com',
        phone: '+92-21-12345678',
        cnic: '42101-9876543-1',
        contactPerson: 'Mr. Muhammad Ali',
        taxId: 'TAX-001-2024',
        paymentTerms: 'Net 30',
        notes: 'Primary supplier for engine parts',
      },
      {
        code: 'SUP-002',
        name: 'Brake Systems International',
        companyName: 'Brake Systems International Pvt Ltd',
        address: '200 Manufacturing Zone, Lahore',
        city: 'Lahore',
        state: 'Punjab',
        country: 'Pakistan',
        zipCode: '54000',
        email: 'sales@brakesystems.com',
        phone: '+92-42-23456789',
        cnic: '35202-8765432-2',
        contactPerson: 'Ms. Fatima Khan',
        taxId: 'TAX-002-2024',
        paymentTerms: 'Net 45',
        notes: 'Specialized in brake components',
      },
      {
        code: 'SUP-003',
        name: 'Electrical Components Co',
        companyName: 'Electrical Components Company',
        address: '300 Tech Park, Islamabad',
        city: 'Islamabad',
        state: 'ICT',
        country: 'Pakistan',
        zipCode: '44000',
        email: 'contact@electricalcomp.com',
        phone: '+92-51-34567890',
        cnic: '37303-7654321-3',
        contactPerson: 'Mr. Usman Ahmed',
        taxId: 'TAX-003-2024',
        paymentTerms: 'Net 30',
        notes: 'Electrical parts supplier',
      },
      {
        code: 'SUP-004',
        name: 'Filter Manufacturing Inc',
        companyName: 'Filter Manufacturing Incorporated',
        address: '400 Production Street, Faisalabad',
        city: 'Faisalabad',
        state: 'Punjab',
        country: 'Pakistan',
        zipCode: '38000',
        email: 'orders@filtermanufacturing.com',
        phone: '+92-41-45678901',
        cnic: '36104-6543210-4',
        contactPerson: 'Mr. Saeed Hassan',
        taxId: 'TAX-004-2024',
        paymentTerms: 'Net 15',
        notes: 'Filter specialist',
      },
    ];

    const createdSuppliers = [];
    for (const supplierData of suppliersData) {
      const supplier = await prisma.supplier.upsert({
        where: { code: supplierData.code },
        update: supplierData,
        create: supplierData,
      });
      createdSuppliers.push(supplier);
    }

    // Seed Expense Types
    const expenseTypesData = [
      {
        code: 'EXP-001',
        name: 'Office Rent',
        description: 'Monthly office rental expenses',
        category: 'Operating',
        budget: 50000,
        spent: 45000,
      },
      {
        code: 'EXP-002',
        name: 'Utilities',
        description: 'Electricity, water, gas bills',
        category: 'Operating',
        budget: 25000,
        spent: 22000,
      },
      {
        code: 'EXP-003',
        name: 'Salaries',
        description: 'Employee salaries and wages',
        category: 'Personnel',
        budget: 200000,
        spent: 200000,
      },
      {
        code: 'EXP-004',
        name: 'Transportation',
        description: 'Vehicle fuel and maintenance',
        category: 'Operating',
        budget: 30000,
        spent: 28000,
      },
      {
        code: 'EXP-005',
        name: 'Marketing',
        description: 'Advertising and promotional expenses',
        category: 'Marketing',
        budget: 40000,
        spent: 35000,
      },
      {
        code: 'EXP-006',
        name: 'Office Supplies',
        description: 'Stationery and office materials',
        category: 'Operating',
        budget: 15000,
        spent: 12000,
      },
    ];

    const createdExpenseTypes = [];
    for (const expenseTypeData of expenseTypesData) {
      const expenseType = await prisma.expenseType.upsert({
        where: { code: expenseTypeData.code },
        update: expenseTypeData,
        create: expenseTypeData,
      });
      createdExpenseTypes.push(expenseType);
    }

    // Seed Posted Expenses
    const postedExpensesData = [
      {
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        expenseTypeId: createdExpenseTypes[0].id,
        amount: 50000,
        paidTo: 'Property Management Co',
        paymentMode: 'Bank Transfer',
        referenceNumber: 'TXN-001-2024',
        description: 'Monthly office rent for January',
      },
      {
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        expenseTypeId: createdExpenseTypes[1].id,
        amount: 15000,
        paidTo: 'K-Electric',
        paymentMode: 'Online Payment',
        referenceNumber: 'TXN-002-2024',
        description: 'Electricity bill for December',
      },
      {
        date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        expenseTypeId: createdExpenseTypes[2].id,
        amount: 200000,
        paidTo: 'Payroll Account',
        paymentMode: 'Bank Transfer',
        referenceNumber: 'TXN-003-2024',
        description: 'Monthly salaries for December',
      },
      {
        date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        expenseTypeId: createdExpenseTypes[3].id,
        amount: 12000,
        paidTo: 'Shell Petrol Station',
        paymentMode: 'Cash',
        referenceNumber: 'TXN-004-2024',
        description: 'Vehicle fuel expenses',
      },
      {
        date: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        expenseTypeId: createdExpenseTypes[4].id,
        amount: 20000,
        paidTo: 'Digital Marketing Agency',
        paymentMode: 'Bank Transfer',
        referenceNumber: 'TXN-005-2024',
        description: 'Social media advertising campaign',
      },
    ];

    for (const expenseData of postedExpensesData) {
      await prisma.postedExpense.create({
        data: expenseData,
      });
    }

    // Seed Purchase Orders
    if (createdSuppliers.length > 0 && createdParts.length > 0) {
      const poDate1 = new Date(now);
      poDate1.setDate(poDate1.getDate() - 7);
      
      const poDate2 = new Date(now);
      poDate2.setDate(poDate2.getDate() - 14);

      const poNumber1 = `PO-${new Date().getFullYear()}-001`;
      const poNumber2 = `PO-${new Date().getFullYear()}-002`;

      // Check if POs already exist
      const existingPO1 = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poNumber1 },
      });
      const existingPO2 = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poNumber2 },
      });

      if (!existingPO1) {
        const po1 = await prisma.purchaseOrder.create({
          data: {
            poNumber: poNumber1,
            date: poDate1,
            supplierId: createdSuppliers[0].id,
            status: 'Completed',
            expectedDate: new Date(poDate1.getTime() + 7 * 24 * 60 * 60 * 1000),
            notes: 'Regular stock replenishment order',
            totalAmount: (createdParts[0].cost || 0) * 50 + (createdParts[1].cost || 0) * 30,
          items: {
            create: [
              {
                partId: createdParts[0].id,
                quantity: 50,
                unitCost: createdParts[0].cost || 0,
                totalCost: (createdParts[0].cost || 0) * 50,
                receivedQty: 50,
                notes: 'Received in full',
              },
              {
                partId: createdParts[1].id,
                quantity: 30,
                unitCost: createdParts[1].cost || 0,
                totalCost: (createdParts[1].cost || 0) * 30,
                receivedQty: 30,
                notes: 'Received in full',
              },
            ],
          },
        },
      });

      if (!existingPO2) {
        const po2 = await prisma.purchaseOrder.create({
          data: {
            poNumber: poNumber2,
            date: poDate2,
            supplierId: createdSuppliers[1].id,
            status: 'Pending',
            expectedDate: new Date(poDate2.getTime() + 14 * 24 * 60 * 60 * 1000),
            notes: 'Pending approval',
            totalAmount: (createdParts[2].cost || 0) * 40 + (createdParts[3].cost || 0) * 20,
            items: {
              create: [
                {
                  partId: createdParts[2].id,
                  quantity: 40,
                  unitCost: createdParts[2].cost || 0,
                  totalCost: (createdParts[2].cost || 0) * 40,
                  receivedQty: 0,
                  notes: 'Awaiting delivery',
                },
                {
                  partId: createdParts[3].id,
                  quantity: 20,
                  unitCost: createdParts[3].cost || 0,
                  totalCost: (createdParts[3].cost || 0) * 20,
                  receivedQty: 0,
                  notes: 'Awaiting delivery',
                },
              ],
            },
          },
        });
      }

      const poCount = (existingPO1 ? 0 : 1) + (existingPO2 ? 0 : 1);
      if (poCount > 0) {
      } else {
      }
    } else {
    }

    // Seed Journal Entries
    if (createdAccounts.length >= 4) {
      const journalDate1 = new Date(now);
      journalDate1.setDate(journalDate1.getDate() - 3);

      const journalEntryNo1 = `JE-${new Date().getFullYear()}-001`;
      const journalEntryNo2 = `JE-${new Date().getFullYear()}-002`;

      // Check if journal entries already exist
      const existingJE1 = await prisma.journalEntry.findUnique({
        where: { entryNo: journalEntryNo1 },
      });
      const existingJE2 = await prisma.journalEntry.findUnique({
        where: { entryNo: journalEntryNo2 },
      });

      if (!existingJE1) {
        const journal1 = await prisma.journalEntry.create({
          data: {
            entryNo: journalEntryNo1,
            entryDate: journalDate1,
            reference: 'REF-001',
            description: 'Opening balance adjustment',
            totalDebit: 100000,
            totalCredit: 100000,
            status: 'posted',
            createdBy: 'System',
            postedBy: 'Admin',
            postedAt: journalDate1,
            lines: {
              create: [
                {
                  accountId: createdAccounts[0].id, // Cash account
                  description: 'Opening cash balance',
                  debit: 100000,
                  credit: 0,
                  lineOrder: 1,
                },
                {
                  accountId: createdAccounts[8].id, // Owner's Capital
                  description: 'Opening capital',
                  debit: 0,
                  credit: 100000,
                  lineOrder: 2,
                },
              ],
            },
          },
        });

      }

      if (!existingJE2) {
        const journalDate2 = new Date(now);
        journalDate2.setDate(journalDate2.getDate() - 1);

        const journal2 = await prisma.journalEntry.create({
          data: {
            entryNo: journalEntryNo2,
            entryDate: journalDate2,
            reference: 'REF-002',
            description: 'Sales revenue entry',
            totalDebit: 50000,
            totalCredit: 50000,
            status: 'posted',
            createdBy: 'System',
            postedBy: 'Admin',
            postedAt: journalDate2,
            lines: {
              create: [
                {
                  accountId: createdAccounts[1].id, // Bank account
                  description: 'Sales revenue received',
                  debit: 50000,
                  credit: 0,
                  lineOrder: 1,
                },
                {
                  accountId: createdAccounts[9].id, // Sales Revenue
                  description: 'Sales revenue',
                  debit: 0,
                  credit: 50000,
                  lineOrder: 2,
                },
              ],
            },
          },
        });

      }

      const jeCount = (existingJE1 ? 0 : 1) + (existingJE2 ? 0 : 1);
      if (jeCount > 0) {
      } else {
      }
    } else {
    }

    // Seed Kits
    if (createdParts.length >= 5) {
      const kitsData = [
        {
          badge: 'KIT-001',
          name: 'Brake Service Kit',
          description: 'Complete brake service kit including pads, discs, and fluid',
          sellingPrice: 8500,
          status: 'Active',
          items: [
            { partIndex: 3, quantity: 1, partNo: 'BRK-001' }, // Brake Pad Set Front
            { partIndex: 4, quantity: 1, partNo: 'BRK-002' }, // Brake Pad Set Rear
            { partIndex: 15, quantity: 2, partNo: 'BRK-004' }, // Brake Fluid
          ],
        },
        {
          badge: 'KIT-002',
          name: 'Engine Maintenance Kit',
          description: 'Essential engine maintenance parts kit',
          sellingPrice: 3500,
          status: 'Active',
          items: [
            { partIndex: 0, quantity: 1, partNo: 'ENG-001' }, // Engine Oil Filter
            { partIndex: 1, quantity: 1, partNo: 'ENG-002' }, // Air Filter
            { partIndex: 2, quantity: 1, partNo: 'ENG-003' }, // Fuel Filter
            { partIndex: 8, quantity: 1, partNo: 'ENG-006' }, // Spark Plug Set
          ],
        },
        {
          badge: 'KIT-003',
          name: 'Filter Replacement Kit',
          description: 'Complete filter replacement kit for regular maintenance',
          sellingPrice: 2000,
          status: 'Active',
          items: [
            { partIndex: 0, quantity: 1, partNo: 'ENG-001' }, // Engine Oil Filter
            { partIndex: 1, quantity: 1, partNo: 'ENG-002' }, // Air Filter
            { partIndex: 13, quantity: 1, partNo: 'FIL-004' }, // Cabin Air Filter
          ],
        },
        {
          badge: 'KIT-004',
          name: 'Electrical System Kit',
          description: 'Complete electrical system components',
          sellingPrice: 25000,
          status: 'Active',
          items: [
            { partIndex: 10, quantity: 1, partNo: 'ELC-001' }, // Alternator
            { partIndex: 11, quantity: 1, partNo: 'ELC-002' }, // Starter Motor
            { partIndex: 12, quantity: 1, partNo: 'ELC-003' }, // Battery
          ],
        },
        {
          badge: 'KIT-005',
          name: 'Cooling System Kit',
          description: 'Complete cooling system maintenance kit',
          sellingPrice: 12000,
          status: 'Active',
          items: [
            { partIndex: 9, quantity: 1, partNo: 'ENG-008' }, // Water Pump
            { partIndex: 16, quantity: 1, partNo: 'ENG-009' }, // Radiator
            { partIndex: 19, quantity: 1, partNo: 'ENG-010' }, // Thermostat
          ],
        },
      ];

      const createdKits = [];
      for (const kitData of kitsData) {
        let totalCost = 0;
        const kitItems = [];

        for (const item of kitData.items) {
          const part = createdParts[item.partIndex];
          if (part && part.cost) {
            const itemCost = part.cost * item.quantity;
            totalCost += itemCost;
            kitItems.push({
              partId: part.id,
              partNo: item.partNo,
              partName: part.description || item.partNo,
              quantity: item.quantity,
              costPerUnit: part.cost,
            });
          }
        }

        try {
          const kit = await prisma.kit.create({
            data: {
              badge: kitData.badge,
              name: kitData.name,
              description: kitData.description,
              sellingPrice: kitData.sellingPrice,
              totalCost: totalCost,
              itemsCount: kitItems.length,
              status: kitData.status,
              items: {
                create: kitItems,
              },
            },
          });
          createdKits.push(kit);
        } catch (error: any) {
          // If kit already exists, skip it
          if (error.code !== 'P2002') {
          }
        }
      }
    } else {
    }

    // Add More Customers
    const additionalCustomersData = [
      {
        name: 'Mehran Auto Works',
        address: '555 Service Road, Multan',
        email: 'mehran@autoworks.com',
        contactNo: '+92-300-6789012',
        cnic: '36105-6789012-6',
        openingBalance: 40000,
        creditLimit: 180000,
      },
      {
        name: 'Sadiq Trading',
        address: '888 Trade Center, Peshawar',
        email: 'sadiq@trading.com',
        contactNo: '+92-300-7890123',
        cnic: '17306-7890123-7',
        openingBalance: 60000,
        creditLimit: 250000,
      },
      {
        name: 'Karachi Motors Ltd',
        address: '999 Business Hub, Karachi',
        email: 'info@karachimotors.com',
        contactNo: '+92-300-8901234',
        cnic: '42107-8901234-8',
        openingBalance: 150000,
        creditLimit: 600000,
      },
    ];

    for (const customerData of additionalCustomersData) {
      const existing = await prisma.customer.findFirst({
        where: { name: customerData.name },
      });
      
      if (!existing) {
        await prisma.customer.create({
          data: customerData,
        });
      }
    }

    // Add More Suppliers
    const additionalSuppliersData = [
      {
        code: 'SUP-005',
        name: 'Global Auto Parts',
        companyName: 'Global Auto Parts Trading Company',
        address: '500 Export Zone, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        country: 'Pakistan',
        zipCode: '75000',
        email: 'sales@globalautoparts.com',
        phone: '+92-21-34567890',
        cnic: '42101-5432109-5',
        contactPerson: 'Mr. Tariq Mehmood',
        taxId: 'TAX-005-2024',
        paymentTerms: 'Net 30',
        notes: 'International supplier',
      },
      {
        code: 'SUP-006',
        name: 'Premium Components',
        companyName: 'Premium Components Manufacturing',
        address: '600 Production Avenue, Lahore',
        city: 'Lahore',
        state: 'Punjab',
        country: 'Pakistan',
        zipCode: '54000',
        email: 'orders@premiumcomponents.com',
        phone: '+92-42-45678901',
        cnic: '35202-4321098-6',
        contactPerson: 'Ms. Ayesha Malik',
        taxId: 'TAX-006-2024',
        paymentTerms: 'Net 15',
        notes: 'Premium quality parts',
      },
    ];

    for (const supplierData of additionalSuppliersData) {
      await prisma.supplier.upsert({
        where: { code: supplierData.code },
        update: supplierData,
        create: supplierData,
      });
    }

    // Seed Vouchers
    if (createdAccounts.length >= 4) {
      const voucherDate1 = new Date(now);
      voucherDate1.setDate(voucherDate1.getDate() - 10);

      const voucherDate2 = new Date(now);
      voucherDate2.setDate(voucherDate2.getDate() - 5);

      const voucherDate3 = new Date(now);
      voucherDate3.setDate(voucherDate3.getDate() - 3);

      // Receipt Voucher
      try {
        const receiptVoucher = await prisma.voucher.create({
          data: {
            voucherNumber: 'RV-1019',
            type: 'receipt',
            date: voucherDate1,
            narration: 'Payment received from customer',
            cashBankAccount: createdAccounts[1].name, // Bank account
            totalDebit: 50000,
            totalCredit: 50000,
            status: 'posted',
            createdBy: 'System',
            approvedBy: 'Admin',
            approvedAt: voucherDate1,
            entries: {
              create: [
                {
                  accountId: createdAccounts[1].id, // Bank account
                  accountName: createdAccounts[1].name,
                  description: 'Payment received',
                  debit: 50000,
                  credit: 0,
                  sortOrder: 1,
                },
                {
                  accountId: createdAccounts[8].id, // Accounts Receivable
                  accountName: createdAccounts[8].name,
                  description: 'Customer payment',
                  debit: 0,
                  credit: 50000,
                  sortOrder: 2,
                },
              ],
            },
          },
        });
      } catch (error: any) {
        if (error.code !== 'P2002') {
        }
      }

      // Payment Voucher
      try {
        const paymentVoucher = await prisma.voucher.create({
          data: {
            voucherNumber: 'PV-2881',
            type: 'payment',
            date: voucherDate2,
            narration: 'Payment made to supplier',
            cashBankAccount: createdAccounts[0].name, // Cash account
            totalDebit: 30000,
            totalCredit: 30000,
            status: 'posted',
            createdBy: 'System',
            approvedBy: 'Admin',
            approvedAt: voucherDate2,
            entries: {
              create: [
                {
                  accountId: createdAccounts[7].id, // Accounts Payable
                  accountName: createdAccounts[7].name,
                  description: 'Supplier payment',
                  debit: 30000,
                  credit: 0,
                  sortOrder: 1,
                },
                {
                  accountId: createdAccounts[0].id, // Cash account
                  accountName: createdAccounts[0].name,
                  description: 'Payment made',
                  debit: 0,
                  credit: 30000,
                  sortOrder: 2,
                },
              ],
            },
          },
        });
      } catch (error: any) {
        if (error.code !== 'P2002') {
        }
      }

      // Journal Voucher
      try {
        const journalVoucher = await prisma.voucher.create({
          data: {
            voucherNumber: 'JV-4633',
            type: 'journal',
            date: voucherDate3,
            narration: 'Adjustment entry for depreciation',
            totalDebit: 10000,
            totalCredit: 10000,
            status: 'posted',
            createdBy: 'System',
            approvedBy: 'Admin',
            approvedAt: voucherDate3,
            entries: {
              create: [
                {
                  accountId: createdAccounts[10].id, // Operating Expenses
                  accountName: createdAccounts[10].name,
                  description: 'Depreciation expense',
                  debit: 10000,
                  credit: 0,
                  sortOrder: 1,
                },
                {
                  accountId: createdAccounts[2].id, // Bank account
                  accountName: createdAccounts[2].name,
                  description: 'Accumulated depreciation',
                  debit: 0,
                  credit: 10000,
                  sortOrder: 2,
                },
              ],
            },
          },
        });
      } catch (error: any) {
        if (error.code !== 'P2002') {
        }
      }

      // Contra Voucher
      try {
        const contraVoucher = await prisma.voucher.create({
          data: {
            voucherNumber: 'CV-100',
            type: 'contra',
            date: voucherDate3,
            narration: 'Cash transfer between accounts',
            cashBankAccount: createdAccounts[0].name,
            totalDebit: 20000,
            totalCredit: 20000,
            status: 'posted',
            createdBy: 'System',
            approvedBy: 'Admin',
            approvedAt: voucherDate3,
            entries: {
              create: [
                {
                  accountId: createdAccounts[1].id, // Bank account
                  accountName: createdAccounts[1].name,
                  description: 'Cash deposited to bank',
                  debit: 20000,
                  credit: 0,
                  sortOrder: 1,
                },
                {
                  accountId: createdAccounts[0].id, // Cash account
                  accountName: createdAccounts[0].name,
                  description: 'Cash withdrawn',
                  debit: 0,
                  credit: 20000,
                  sortOrder: 2,
                },
              ],
            },
          },
        });
      } catch (error: any) {
        if (error.code !== 'P2002') {
        }
      }
    } else {
    }

    // Final Summary
    const allCategories = await prisma.category.findMany();
    const allBrands = await prisma.brand.findMany();
    const allParts = await prisma.part.findMany();
    const allStores = await prisma.store.findMany();
    const allCustomers = await prisma.customer.findMany();
    const allSuppliers = await prisma.supplier.findMany();
    const allKits = await prisma.kit.findMany();
    const allVouchers = await prisma.voucher.findMany();
    const allExpenseTypes = await prisma.expenseType.findMany();
    const allPostedExpenses = await prisma.postedExpense.findMany();
    const allPurchaseOrders = await prisma.purchaseOrder.findMany();
    const allJournalEntries = await prisma.journalEntry.findMany();
    
    // End of try block
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// SEED FILE DISABLED - Do not run automatically
// To re-enable, uncomment the code below
/*
// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}
*/

export default seed;
