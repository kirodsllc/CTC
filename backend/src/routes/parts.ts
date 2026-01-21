import express, { Request, Response } from 'express';
import prisma from '../config/database';
import { getCanonicalPartId, isExactPartNoMatch } from '../services/partCanonical';

const router = express.Router();

// Get all parts with filters
router.get('/', async (req: Request, res: Response) => {
  // Add cache headers to prevent stale data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    const {
      search,
      category_id,
      category_name,
      subcategory_id,
      subcategory_name,
      brand_id,
      brand_name,
      application_id,
      application_name,
      status,
      master_part_no,
      part_no,
      description,
      created_from,
      created_to,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Check if search is an exact partNo match (for duplicate handling)
    if (search) {
      const searchStr = (search as string).trim();
      const exactPartNo = await isExactPartNoMatch(prisma, searchStr);
      
      if (exactPartNo) {
        // Get canonical part ID for this partNo
        const canonicalPartId = await getCanonicalPartId(prisma, exactPartNo);
        console.log(`🔍 [PARTS API] Exact partNo match: "${exactPartNo}", canonical Part ID: ${canonicalPartId}`);
        
        // For exact partNo match, return only the canonical part
        if (canonicalPartId) {
          where.id = canonicalPartId;
        } else {
          // Part not found, return empty result
          where.id = 'non-existent-id';
        }
      } else {
        // General search - searches across multiple fields
        where.OR = [
          { partNo: { contains: searchStr } },
          { description: { contains: searchStr } },
          { masterPart: { masterPartNo: { contains: searchStr } } },
          { brand: { name: { contains: searchStr } } },
          { category: { name: { contains: searchStr } } },
          { subcategory: { name: { contains: searchStr } } },
          { application: { name: { contains: searchStr } } },
        ];
      }
    }

    // Specific field filters (combine with AND logic)
    const specificFilters: any[] = [];

    if (master_part_no) {
      // Use partial match (contains) for master part number to show related keywords
      const masterPartNoValue = (master_part_no as string).trim();
      console.log(`🔍 Filtering parts by master part number (partial match): "${masterPartNoValue}"`);
      specificFilters.push({
        masterPart: {
          masterPartNo: { contains: masterPartNoValue },
        },
      });
    }

    if (part_no) {
      // Filter by part_no to get all family parts (parts with same part_no value)
      // For family parts, we want ALL parts with the same part_no, not just canonical
      const partNoValue = (part_no as string).trim();
      console.log(`🔍 Filtering parts by part number (exact match for family): "${partNoValue}"`);
      // Use exact match (case-sensitive) to get all parts in the family
      // This will return all parts that have the exact same partNo value
      specificFilters.push({
        partNo: partNoValue, // Exact match to get all family parts
      });
    }

    if (description) {
      specificFilters.push({
        description: { contains: description as string },
      });
    }
    
    // Combine specific filters with AND
    // BUT: If we already set where.id (for canonical part), don't add other filters
    if (specificFilters.length > 0 && !where.id) {
      if (where.OR) {
        // If we have both general search and specific filters, we need to combine them properly
        // Use AND to combine general search OR with specific filters
        where.AND = [
          { OR: where.OR },
          ...specificFilters,
        ];
        delete where.OR;
      } else {
        // Only specific filters, use AND
        where.AND = specificFilters;
      }
    }

    // Category filter - by ID or name
    let foundCategory: any = null;
    if (category_id) {
      foundCategory = await prisma.category.findUnique({
        where: { id: category_id as string },
      });
      if (foundCategory) {
        if (where.AND) {
          where.AND.push({ categoryId: foundCategory.id });
        } else {
          where.categoryId = foundCategory.id;
        }
      }
    } else if (category_name && category_name !== 'all') {
      foundCategory = await prisma.category.findFirst({
        where: { name: { contains: category_name as string } },
      });
      if (foundCategory) {
        if (where.AND) {
          where.AND.push({ categoryId: foundCategory.id });
        } else {
          where.categoryId = foundCategory.id;
        }
      }
    }

    // Subcategory filter - by ID or name
    if (subcategory_id) {
      if (where.AND) {
        where.AND.push({ subcategoryId: subcategory_id as string });
      } else {
        where.subcategoryId = subcategory_id as string;
      }
    } else if (subcategory_name && subcategory_name !== 'all') {
      // If category is already filtered, ensure subcategory belongs to that category
      let subcategoryWhere: any = { name: { contains: subcategory_name as string } };
      if (foundCategory) {
        subcategoryWhere.categoryId = foundCategory.id;
      }
      const subcategory = await prisma.subcategory.findFirst({
        where: subcategoryWhere,
      });
      if (subcategory) {
        if (where.AND) {
          where.AND.push({ subcategoryId: subcategory.id });
        } else {
          where.subcategoryId = subcategory.id;
        }
      }
    }

    // Application filter - by ID or name
    if (application_id) {
      if (where.AND) {
        where.AND.push({ applicationId: application_id as string });
      } else {
        where.applicationId = application_id as string;
      }
    } else if (application_name && application_name !== 'all') {
      const application = await prisma.application.findFirst({
        where: { name: { contains: application_name as string } },
      });
      if (application) {
        if (where.AND) {
          where.AND.push({ applicationId: application.id });
        } else {
          where.applicationId = application.id;
        }
      }
    }

    // Brand filter - by ID or name
    if (brand_id) {
      if (where.AND) {
        where.AND.push({ brandId: brand_id as string });
      } else {
        where.brandId = brand_id as string;
      }
    } else if (brand_name) {
      const brand = await prisma.brand.findFirst({
        where: { name: { contains: brand_name as string } },
      });
      if (brand) {
        if (where.AND) {
          where.AND.push({ brandId: brand.id });
        } else {
          where.brandId = brand.id;
        }
      }
    }

    if (status) {
      where.status = status as string;
    }

    // Date range filter for createdAt
    if (created_from || created_to) {
      if (!where.createdAt) {
        where.createdAt = {};
      }
      if (created_from) {
        where.createdAt.gte = new Date(created_from as string);
      }
      if (created_to) {
        // Set to end of day for "to" date
        const toDate = new Date(created_to as string);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Get parts with relations
    console.log("🔍 Prisma query where clause:", JSON.stringify(where, null, 2));
    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        include: {
          masterPart: true,
          brand: true,
          category: true,
          subcategory: true,
          application: true,
        },
        orderBy: [
          { costUpdatedAt: 'desc' }, // Most recently cost-updated first (prioritize parts with cost updates)
          { updatedAt: 'desc' }, // Then by most recently updated
          { createdAt: 'desc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.part.count({ where }),
    ]);
    console.log(`📊 Found ${parts.length} parts (total: ${total}) with the filter`);
    if (master_part_no) {
      console.log(`📋 Parts with master part "${master_part_no}":`, parts.map(p => ({
        id: p.id,
        partNo: p.partNo,
        masterPartNo: p.masterPart?.masterPartNo
      })));
    }
    if (part_no) {
      console.log(`📋 Parts with part number "${part_no}":`, parts.map(p => ({
        id: p.id,
        partNo: p.partNo,
        masterPartNo: p.masterPart?.masterPartNo,
        description: p.description
      })));
      console.log(`🔍 Part number filter details:`, {
        filterValue: part_no,
        filterType: 'exact match',
        totalFound: parts.length,
        expectedCount: total
      });
    }

    // Transform data for response
    const transformedParts = parts.map((part) => {
      // 🔍 LOG: Log cost source for debugging (one-time per request for specific parts)
      if (part.partNo === '6C0570' || (search && (search as string).includes('6C0570'))) {
        console.log(`💰 [PARTS API] Part ${part.partNo} (ID: ${part.id}):`);
        console.log(`   Cost from DB (part.cost): ${part.cost}`);
        console.log(`   Cost Source: ${(part as any).costSource || 'null'}`);
        console.log(`   Cost Source Ref: ${(part as any).costSourceRef || 'null'}`);
        console.log(`   Cost Updated At: ${(part as any).costUpdatedAt || 'null'}`);
      }
      
      return {
        id: part.id,
        master_part_no: part.masterPart?.masterPartNo || null,
        part_no: part.partNo,
        brand_name: part.brand?.name || null,
        category_name: part.category?.name || null,
        subcategory_name: part.subcategory?.name || null,
        application_name: part.application?.name || null,
        application: part.application ? { id: part.application.id, name: part.application.name } : null,
        application_id: part.applicationId || null,
        description: part.description,
        hs_code: part.hsCode,
        weight: part.weight,
        reorder_level: part.reorderLevel,
        uom: part.uom,
        cost: part.cost, // ⭐ SOURCE: Part.cost field from database
        costSource: (part as any).costSource || null, // ⭐ Include costSource for canonical selection
        costSourceRef: (part as any).costSourceRef || null, // ⭐ Include costSourceRef
        costUpdatedAt: (part as any).costUpdatedAt || null, // ⭐ Include costUpdatedAt for canonical selection
        price_a: part.priceA,
        price_b: part.priceB,
        price_m: part.priceM,
        smc: part.smc,
        size: part.size,
        origin: part.origin || null,
        image_p1: part.imageP1,
        image_p2: part.imageP2,
        status: part.status,
        created_at: part.createdAt,
        updated_at: part.updatedAt,
      };
    });

    res.json({
      data: transformedParts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching parts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parts for price management (with stock quantities) - MUST BE BEFORE /:id routes to avoid route conflicts
router.get('/price-management', async (req: Request, res: Response) => {
  // Add cache headers to prevent stale data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    const { search, category, page = '1', limit = '1000' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { status: 'active' };

    if (search) {
      const searchStr = (search as string).trim();
      const exactPartNo = await isExactPartNoMatch(prisma, searchStr);
      
      if (exactPartNo) {
        // For exact partNo match, return only the canonical part
        const canonicalPartId = await getCanonicalPartId(prisma, exactPartNo);
        console.log(`🔍 [PRICE-MANAGEMENT API] Exact partNo match: "${exactPartNo}", canonical Part ID: ${canonicalPartId}`);
        if (canonicalPartId) {
          where.id = canonicalPartId;
        } else {
          // Part not found, return empty result
          where.id = 'non-existent-id';
        }
      } else {
        // General search
        where.OR = [
          { partNo: { contains: search as string } },
          { description: { contains: search as string } },
        ];
      }
    }

    if (category && category !== 'all') {
      const categoryRecord = await prisma.category.findFirst({
        where: { name: { contains: category as string,  } },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    // Get all parts
    const parts = await prisma.part.findMany({
      where,
      include: {
        category: true,
        brand: true,
      },
      orderBy: [
        { costUpdatedAt: 'desc' }, // Most recently cost-updated first (prioritize parts with cost updates)
        { updatedAt: 'desc' }, // Then by most recently updated
        { partNo: 'asc' },
      ],
    });

    // Get stock movements to calculate quantities
    const partIds = parts.map(p => p.id);
    const movements = await prisma.stockMovement.findMany({
      where: {
        partId: { in: partIds },
      },
      select: {
        partId: true,
        quantity: true,
        type: true,
      },
    });

    // Calculate stock by part
    const stockByPart: Record<string, number> = {};
    for (const movement of movements) {
      if (!stockByPart[movement.partId]) {
        stockByPart[movement.partId] = 0;
      }
      if (movement.type === 'in') {
        stockByPart[movement.partId] += movement.quantity;
      } else {
        stockByPart[movement.partId] -= movement.quantity;
      }
    }

    // Build result
    const result = parts.map(part => {
      const qty = Math.max(0, stockByPart[part.id] || 0);
      // ⭐ SOURCE: Part.cost field from database (same as /parts endpoint)
      const effectiveCost = part.cost ?? 0;

      // 🔍 LOG: Log cost source for debugging (one-time per request for specific parts)
      if (part.partNo === '6C0570' || (search && (search as string).includes('6C0570'))) {
        console.log(`💰 [PRICE-MANAGEMENT API] Part ${part.partNo} (ID: ${part.id}):`);
        console.log(`   Cost from DB (part.cost): ${part.cost}`);
        console.log(`   Effective Cost returned: ${effectiveCost}`);
        console.log(`   Cost Source: ${(part as any).costSource || 'null'}`);
        console.log(`   Cost Source Ref: ${(part as any).costSourceRef || 'null'}`);
      }

      return {
        id: part.id,
        partNo: part.partNo,
        description: part.description || '',
        category: part.category?.name || 'Uncategorized',
        brand: part.brand?.name || 'Unknown',
        qty: qty,
        cost: effectiveCost, // ⭐ SOURCE: Part.cost field from database
        costSource: (part as any).costSource || null, // ⭐ Include costSource for canonical selection
        costSourceRef: (part as any).costSourceRef || null, // ⭐ Include costSourceRef
        costUpdatedAt: (part as any).costUpdatedAt || null, // ⭐ Include costUpdatedAt for canonical selection
        priceA: part.priceA ?? 0,
        priceB: part.priceB ?? 0,
        priceM: part.priceM ?? 0, // Return 0 if null/undefined
      };
    });

    // Apply search filter (if not already applied in query)
    let filteredResult = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredResult = filteredResult.filter(item =>
        item.partNo.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = filteredResult.length;
    const paginatedResult = filteredResult.slice(skip, skip + limitNum);

    res.json({
      data: paginatedResult,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching parts for price management:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk update prices - MUST BE BEFORE /:id routes
router.post('/bulk-update-prices', async (req: Request, res: Response) => {
  try {
    const {
      part_ids,
      price_field, // 'cost', 'priceA', 'priceB', 'all'
      update_type, // 'percentage', 'fixed'
      update_value,
      reason,
      updated_by,
    } = req.body;

    if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
      return res.status(400).json({ error: 'part_ids array is required' });
    }

    if (!price_field || !update_type || update_value === undefined) {
      return res.status(400).json({ error: 'price_field, update_type, and update_value are required' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }

    // Get all parts to update
    const parts = await prisma.part.findMany({
      where: {
        id: { in: part_ids },
      },
    });

    if (parts.length === 0) {
      return res.status(404).json({ error: 'No parts found' });
    }

    const updateValue = parseFloat(update_value);
    if (isNaN(updateValue)) {
      return res.status(400).json({ error: 'update_value must be a valid number' });
    }

    // Update parts and create history records
    const updatedParts = [];
    const historyRecords = [];

    for (const part of parts) {
      const updates: any = {};
      const historyData: any = {
        partId: part.id,
        partNo: part.partNo,
        description: part.description,
        priceField: price_field,
        updateType: update_type,
        updateValue: updateValue,
        itemsUpdated: part_ids.length,
        reason: reason,
        updatedBy: updated_by || 'System',
      };

      const applyUpdate = (currentPrice: number) => {
        if (update_type === 'percentage') {
          return Math.round((currentPrice * (1 + updateValue / 100)) * 100) / 100;
        } else {
          return Math.round((currentPrice + updateValue) * 100) / 100;
        }
      };

      if (price_field === 'cost' || price_field === 'all') {
        const oldCost = part.cost || 0;
        const newCost = applyUpdate(oldCost);
        updates.cost = newCost;
        if (price_field === 'cost') {
          historyData.oldValue = oldCost;
          historyData.newValue = newCost;
        }
      }

      if (price_field === 'priceA' || price_field === 'all') {
        const oldPriceA = part.priceA || 0;
        const newPriceA = applyUpdate(oldPriceA);
        updates.priceA = newPriceA;
        if (price_field === 'priceA') {
          historyData.oldValue = oldPriceA;
          historyData.newValue = newPriceA;
        }
      }

      if (price_field === 'priceB' || price_field === 'all') {
        const oldPriceB = part.priceB || 0;
        const newPriceB = applyUpdate(oldPriceB);
        updates.priceB = newPriceB;
        if (price_field === 'priceB') {
          historyData.oldValue = oldPriceB;
          historyData.newValue = newPriceB;
        }
      }

      // Update part
      const updatedPart = await prisma.part.update({
        where: { id: part.id },
        data: updates,
      });

      updatedParts.push(updatedPart);

      // Create history record
      await prisma.priceHistory.create({
        data: historyData,
      });
    }

    res.json({
      message: `Successfully updated ${updatedParts.length} parts`,
      updated_count: updatedParts.length,
    });
  } catch (error: any) {
    console.error('Error bulk updating prices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get price update history - MUST BE BEFORE /:id routes
router.get('/price-history', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
      prisma.priceHistory.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          part: {
            select: {
              partNo: true,
              description: true,
            },
          },
        },
      }),
      prisma.priceHistory.count(),
    ]);

    const result = history.map(h => ({
      id: h.id,
      date: h.createdAt.toISOString(),
      itemsUpdated: h.itemsUpdated,
      priceField: h.priceField,
      updateType: h.updateType === 'percentage' ? 'Percentage (%)' : h.updateType === 'fixed' ? 'Fixed Amount' : h.updateType,
      value: h.updateValue || h.newValue || 0,
      reason: h.reason,
      updatedBy: h.updatedBy || 'System',
    }));

    res.json({
      data: result,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single part by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        masterPart: true,
        brand: true,
        category: true,
        subcategory: true,
        application: true,
        models: true,
      },
    });

    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json({
      id: part.id,
      master_part_no: part.masterPart?.masterPartNo || null,
      part_no: part.partNo,
      brand_name: part.brand?.name || null,
      brand_id: part.brandId || null,
      category_name: part.category?.name || null,
      category_id: part.categoryId || null,
      subcategory_name: part.subcategory?.name || null,
      subcategory_id: part.subcategoryId || null,
      application_name: part.application?.name || null,
      application_id: part.applicationId || null,
      application: part.application ? { id: part.application.id, name: part.application.name } : null,
      description: part.description,
      hs_code: part.hsCode,
      weight: part.weight,
      reorder_level: part.reorderLevel,
      uom: part.uom,
      cost: part.cost,
      price_a: part.priceA || null,
      price_b: part.priceB || null,
      price_m: part.priceM || null,
      smc: part.smc || null,
      size: part.size || null,
      origin: part.origin || null,
      image_p1: part.imageP1 || null,
      image_p2: part.imageP2 || null,
      status: part.status || "active",
      remarks: (part as any).remarks || null,
      models: part.models.map((m) => ({
        id: m.id,
        name: m.name,
        qty_used: m.qtyUsed,
      })),
      created_at: part.createdAt,
      updated_at: part.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching part:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new part
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      master_part_no,
      part_no,
      brand_name,
      description,
      category_id,
      subcategory_id,
      application_id,
      hs_code,
      weight,
      reorder_level,
      uom,
      cost,
      price_a,
      price_b,
      price_m,
      smc,
      size,
      origin,
      image_p1,
      image_p2,
      status,
      models,
    } = req.body;

    // Validate required fields
    const partNoStr = part_no ? String(part_no).trim() : '';
    if (!partNoStr || partNoStr === '') {
      return res.status(400).json({ error: 'Part number is required' });
    }

    // Handle master part
    let masterPartId = null;
    if (master_part_no && String(master_part_no).trim()) {
      const masterPartNoValue = String(master_part_no).trim();
      console.log(`🔍 [POST] Creating/updating master part: "${masterPartNoValue}"`);
      try {
        const masterPart = await prisma.masterPart.upsert({
          where: { masterPartNo: masterPartNoValue },
          update: {},
          create: { masterPartNo: masterPartNoValue },
        });
        masterPartId = masterPart.id;
        console.log(`✅ [POST] Master part created/found with ID: ${masterPartId}`);
      } catch (error: any) {
        console.error(`❌ [POST] Error handling master part "${masterPartNoValue}":`, error);
      }
    } else {
      console.log(`⚠️ [POST] No master part number provided or empty string. Received:`, master_part_no);
    }

    // Handle brand
    let brandId = null;
    if (brand_name) {
      const brand = await prisma.brand.upsert({
        where: { name: brand_name },
        update: {},
        create: { name: brand_name },
      });
      brandId = brand.id;
    }

    // Helper function to check if string looks like a UUID
    const isUUID = (str: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Validate and handle category (auto-create if not found)
    let validatedCategoryId = null;
    if (category_id && String(category_id).trim() !== '') {
      try {
        const categoryIdStr = String(category_id).trim();
        let category = null;
        
        if (isUUID(categoryIdStr)) {
          category = await prisma.category.findUnique({
            where: { id: categoryIdStr },
          });
          console.log(`[POST] Category lookup by ID: ${category ? 'found' : 'not found'}`);
        }
        
        if (!category) {
          category = await prisma.category.findUnique({
            where: { name: categoryIdStr },
          });
          console.log(`[POST] Category lookup by name: ${category ? 'found' : 'not found'}`);
        }
        
        // If not found, auto-create it
        if (!category) {
          console.log(`[POST] Attempting to auto-create category: "${categoryIdStr}"`);
          try {
            category = await prisma.category.create({
              data: {
                name: categoryIdStr,
                status: 'active',
              },
            });
            console.log(`[POST] Category auto-created: ${category.name} (ID: ${category.id})`);
          } catch (createError: any) {
            console.error(`[POST] Error auto-creating category: ${createError.message}`);
            // If creation fails (e.g., unique constraint), try to find it again
            category = await prisma.category.findUnique({
              where: { name: categoryIdStr },
            });
            if (category) {
              console.log(`[POST] Category found after creation attempt: ${category.name}`);
            }
          }
        }
        
        if (category) {
          validatedCategoryId = category.id;
          console.log(`[POST] Category validated: ${category.name} (ID: ${validatedCategoryId})`);
        }
      } catch (error: any) {
        console.error('Error validating category:', error);
        validatedCategoryId = null;
      }
    }

    // Validate and handle subcategory
    let validatedSubcategoryId = null;
    if (subcategory_id && String(subcategory_id).trim() !== '') {
      try {
        const subcategoryIdStr = String(subcategory_id).trim();
        let subcategory = null;
        
        if (isUUID(subcategoryIdStr)) {
          subcategory = await prisma.subcategory.findUnique({
            where: { id: subcategoryIdStr },
            include: { category: true },
          });
        }
        
        if (!subcategory) {
          subcategory = await prisma.subcategory.findFirst({
            where: { name: subcategoryIdStr },
            include: { category: true },
          });
        }
        
        // If still not found and we have a category, auto-create it
        if (!subcategory && validatedCategoryId) {
          try {
            subcategory = await prisma.subcategory.create({
              data: {
                name: subcategoryIdStr,
                categoryId: validatedCategoryId,
                status: 'active',
              },
              include: { category: true },
            });
            console.log(`Subcategory auto-created: ${subcategory.name} (ID: ${subcategory.id})`);
          } catch (createError: any) {
            // If creation fails (e.g., unique constraint), try to find it again
            subcategory = await prisma.subcategory.findFirst({
              where: { 
                name: subcategoryIdStr,
                categoryId: validatedCategoryId 
              },
              include: { category: true },
            });
            if (subcategory) {
              console.log(`Subcategory found after creation attempt: ${subcategory.name}`);
            } else {
              console.error('Error auto-creating subcategory:', createError);
            }
          }
        }
        
        if (subcategory) {
          validatedSubcategoryId = subcategory.id;
          // Auto-set category if not already set
          if (!validatedCategoryId) {
            validatedCategoryId = subcategory.categoryId;
          }
          console.log(`Subcategory validated: ${subcategory.name} (ID: ${validatedSubcategoryId})`);
        } else {
          console.log(`Subcategory not found and cannot be created (no category): ${subcategoryIdStr}`);
        }
      } catch (error: any) {
        console.error('Error validating subcategory:', error);
        validatedSubcategoryId = null;
      }
    }

    // Validate and handle application (with auto-creation if name provided and subcategory exists)
    let validatedApplicationId = null;
    if (application_id && String(application_id).trim() !== '') {
      try {
        const applicationIdStr = String(application_id).trim();
        let application = null;
        
        if (isUUID(applicationIdStr)) {
          // Try to find by ID
          application = await prisma.application.findUnique({
            where: { id: applicationIdStr },
            include: { subcategory: { include: { category: true } } },
          });
        }
        
        // If not found by ID, try to find by name
        if (!application) {
          if (validatedSubcategoryId) {
            // Try within the validated subcategory
            application = await prisma.application.findFirst({
              where: { 
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId 
              },
              include: { subcategory: { include: { category: true } } },
            });
          }
          
          // If still not found, try any subcategory
          if (!application) {
            application = await prisma.application.findFirst({
              where: { name: applicationIdStr },
              include: { subcategory: { include: { category: true } } },
            });
          }
        }
        
        // If still not found and we have a subcategory, auto-create it
        if (!application && validatedSubcategoryId) {
          try {
            application = await prisma.application.create({
              data: {
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId,
                status: 'active',
              },
              include: { subcategory: { include: { category: true } } },
            });
            console.log(`Application auto-created: ${application.name} (ID: ${application.id})`);
          } catch (createError: any) {
            // If creation fails (e.g., unique constraint), try to find it again
            application = await prisma.application.findFirst({
              where: { 
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId 
              },
              include: { subcategory: { include: { category: true } } },
            });
            if (application) {
              console.log(`Application found after creation attempt: ${application.name}`);
            } else {
              console.error('Error auto-creating application:', createError);
            }
          }
        }
        
        if (application) {
          validatedApplicationId = application.id;
          // Auto-set subcategory and category if not already set
          if (!validatedSubcategoryId) {
            validatedSubcategoryId = application.subcategoryId;
            if (application.subcategory?.categoryId) {
              validatedCategoryId = application.subcategory.categoryId;
            }
          }
          console.log(`Application validated: ${application.name} (ID: ${validatedApplicationId})`);
        } else {
          console.log(`Application not found and cannot be created (no subcategory): ${applicationIdStr}`);
        }
      } catch (error: any) {
        console.error('Error validating application:', error);
        validatedApplicationId = null;
      }
    }

    // Create part with models
    const part = await prisma.part.create({
      data: {
        masterPartId,
        partNo: partNoStr,
        brandId,
        description: description ? String(description).trim() : null,
        categoryId: validatedCategoryId || null,
        subcategoryId: validatedSubcategoryId || null,
        applicationId: validatedApplicationId || null,
        hsCode: hs_code ? String(hs_code).trim() : null,
        weight: weight ? parseFloat(String(weight)) : null,
        reorderLevel: reorder_level ? parseInt(String(reorder_level)) : 0,
        uom: uom ? String(uom).trim() : 'pcs',
        cost: cost !== null && cost !== undefined ? parseFloat(String(cost)) : null,
        priceA: price_a !== null && price_a !== undefined ? parseFloat(String(price_a)) : null,
        priceB: price_b !== null && price_b !== undefined ? parseFloat(String(price_b)) : null,
        priceM: price_m !== null && price_m !== undefined ? parseFloat(String(price_m)) : null,
        smc: smc ? String(smc).trim() : null,
        size: size ? String(size).trim() : null,
        origin: origin ? String(origin).trim() : null,
        imageP1: image_p1 ? String(image_p1).trim() : null,
        imageP2: image_p2 ? String(image_p2).trim() : null,
        status: (() => {
          if (!status) return 'active';
          const statusStr = String(status).trim();
          if (statusStr === 'A' || statusStr === 'a') return 'active';
          if (statusStr === 'N' || statusStr === 'n') return 'inactive';
          return statusStr === 'active' || statusStr === 'inactive' ? statusStr : 'active';
        })(),
        models: models && Array.isArray(models) && models.length > 0
          ? {
              create: models
                .filter((m: any) => m && m.name && String(m.name).trim() !== '')
                .map((m: any) => ({
                  name: String(m.name).trim(),
                  qtyUsed: m.qty_used || m.qtyUsed || 1,
                })),
            }
          : undefined,
      },
      include: {
        masterPart: true,
        brand: true,
        category: true,
        subcategory: true,
        application: true,
        models: true,
      },
    });

    res.status(201).json({
      id: part.id,
      master_part_no: part.masterPart?.masterPartNo || null,
      part_no: part.partNo,
      brand_name: part.brand?.name || null,
      category_name: part.category?.name || null,
      subcategory_name: part.subcategory?.name || null,
      application_name: part.application?.name || null,
      application: part.application ? { id: part.application.id, name: part.application.name } : null,
      application_id: part.applicationId || null,
      description: part.description,
      hs_code: part.hsCode,
      weight: part.weight,
      reorder_level: part.reorderLevel,
      uom: part.uom,
      cost: part.cost,
      price_a: part.priceA,
      price_b: part.priceB,
      price_m: part.priceM,
      smc: part.smc,
      size: part.size,
      origin: part.origin || null,
      image_p1: part.imageP1,
      image_p2: part.imageP2,
      status: part.status,
      models: part.models.map((m) => ({
        id: m.id,
        name: m.name,
        qty_used: m.qtyUsed,
      })),
      created_at: part.createdAt,
      updated_at: part.updatedAt,
    });
  } catch (error: any) {
    console.error('Error creating part:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      // Allow duplicate partNo - duplicates are now allowed per schema
      if (field === 'partNo' || field === 'part_no') {
        // If we get here, the database constraint still exists
        // The schema has been updated to allow duplicates, but migration needs to be run
        console.log('⚠️ Duplicate partNo detected - database constraint may still exist');
        console.log('💡 Run migration: backend/src/db/migrations/002_remove_part_no_unique.sql');
        // Return error with instructions
        return res.status(400).json({ 
          error: 'Part number already exists. Please run the database migration to remove the unique constraint on part_no.',
          details: 'Migration file: backend/src/db/migrations/002_remove_part_no_unique.sql'
        });
      } else {
        return res.status(400).json({ 
          error: `A part with this ${field} already exists`,
          details: error.meta 
        });
      }
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return res.status(400).json({ 
        error: 'Invalid reference to related record',
        details: error.meta 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update part
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      master_part_no,
      part_no,
      brand_name,
      description,
      category_id,
      subcategory_id,
      application_id,
      hs_code,
      weight,
      reorder_level,
      uom,
      cost,
      price_a,
      price_b,
      price_m,
      smc,
      size,
      origin,
      image_p1,
      image_p2,
      status,
      models,
    } = req.body;

    // Handle master part
    let masterPartId = null;
    if (master_part_no && String(master_part_no).trim()) {
      const masterPartNoValue = String(master_part_no).trim();
      console.log(`🔍 [PUT] Creating/updating master part: "${masterPartNoValue}"`);
      try {
        const masterPart = await prisma.masterPart.upsert({
          where: { masterPartNo: masterPartNoValue },
          update: {},
          create: { masterPartNo: masterPartNoValue },
        });
        masterPartId = masterPart.id;
        console.log(`✅ [PUT] Master part created/found with ID: ${masterPartId}`);
      } catch (error: any) {
        console.error(`❌ [PUT] Error handling master part "${masterPartNoValue}":`, error);
      }
    } else {
      console.log(`⚠️ [PUT] No master part number provided or empty string. Received:`, master_part_no);
    }

    // Handle brand
    let brandId = null;
    if (brand_name) {
      const brand = await prisma.brand.upsert({
        where: { name: brand_name },
        update: {},
        create: { name: brand_name },
      });
      brandId = brand.id;
    }

    // Helper function to check if string looks like a UUID
    const isUUID = (str: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Validate category exists if provided (auto-create if not found)
    let validatedCategoryId = null;
    if (category_id && String(category_id).trim() !== '') {
      try {
        const categoryIdStr = String(category_id).trim();
        let category = null;
        
        if (isUUID(categoryIdStr)) {
          // Try to find by ID
          category = await prisma.category.findUnique({
            where: { id: categoryIdStr },
          });
          console.log(`[PUT] Category lookup by ID: ${category ? 'found' : 'not found'}`);
        } else {
          // Try to find by name
          category = await prisma.category.findUnique({
            where: { name: categoryIdStr },
          });
          console.log(`[PUT] Category lookup by name: ${category ? 'found' : 'not found'}`);
        }
        
        // If not found, auto-create it
        if (!category) {
          console.log(`[PUT] Attempting to auto-create category: "${categoryIdStr}"`);
          try {
            category = await prisma.category.create({
              data: {
                name: categoryIdStr,
                status: 'active',
              },
            });
            console.log(`[PUT] Category auto-created: ${category.name} (ID: ${category.id})`);
          } catch (createError: any) {
            console.error(`[PUT] Error auto-creating category: ${createError.message}`);
            // If creation fails (e.g., unique constraint), try to find it again
            category = await prisma.category.findUnique({
              where: { name: categoryIdStr },
            });
            if (category) {
              console.log(`[PUT] Category found after creation attempt: ${category.name}`);
            }
          }
        }
        
        if (category) {
          validatedCategoryId = category.id;
          console.log(`[PUT] Category validated: ${category.name} (ID: ${validatedCategoryId})`);
        }
      } catch (error: any) {
        console.error('Error validating category:', error);
        validatedCategoryId = null;
      }
    }

    // Validate subcategory exists
    let validatedSubcategoryId = null;
    if (subcategory_id && String(subcategory_id).trim() !== '') {
      try {
        const subcategoryIdStr = String(subcategory_id).trim();
        console.log(`[PUT] Validating subcategory: "${subcategoryIdStr}" (isUUID: ${isUUID(subcategoryIdStr)}, validatedCategoryId: ${validatedCategoryId})`);
        let subcategory = null;
        
        if (isUUID(subcategoryIdStr)) {
          // Try to find by ID
          subcategory = await prisma.subcategory.findUnique({
            where: { id: subcategoryIdStr },
            include: { category: true },
          });
          console.log(`[PUT] Subcategory lookup by ID: ${subcategory ? 'found' : 'not found'}`);
        }
        
        // If not found by ID, try to find by name
        if (!subcategory) {
          if (validatedCategoryId) {
            // Try within the validated category
            subcategory = await prisma.subcategory.findFirst({
              where: { 
                name: subcategoryIdStr,
                categoryId: validatedCategoryId 
              },
              include: { category: true },
            });
            console.log(`[PUT] Subcategory lookup by name in category: ${subcategory ? 'found' : 'not found'}`);
          }
          
          // If still not found, try any category
          if (!subcategory) {
            subcategory = await prisma.subcategory.findFirst({
              where: { name: subcategoryIdStr },
              include: { category: true },
            });
            console.log(`[PUT] Subcategory lookup by name (any category): ${subcategory ? 'found' : 'not found'}`);
          }
        }
        
        // If still not found and we have a category, auto-create it
        if (!subcategory && validatedCategoryId) {
          console.log(`[PUT] Attempting to auto-create subcategory: "${subcategoryIdStr}" in category: ${validatedCategoryId}`);
          try {
            subcategory = await prisma.subcategory.create({
              data: {
                name: subcategoryIdStr,
                categoryId: validatedCategoryId,
                status: 'active',
              },
              include: { category: true },
            });
            console.log(`[PUT] Subcategory auto-created: ${subcategory.name} (ID: ${subcategory.id})`);
          } catch (createError: any) {
            console.error(`[PUT] Error auto-creating subcategory: ${createError.message}`);
            // If creation fails (e.g., unique constraint), try to find it again
            subcategory = await prisma.subcategory.findFirst({
              where: { 
                name: subcategoryIdStr,
                categoryId: validatedCategoryId 
              },
              include: { category: true },
            });
            if (subcategory) {
              console.log(`[PUT] Subcategory found after creation attempt: ${subcategory.name}`);
            } else {
              console.error(`[PUT] Subcategory still not found after creation attempt`);
            }
          }
        } else if (!subcategory) {
          console.log(`[PUT] Subcategory not found and cannot be created (no category): ${subcategoryIdStr}`);
        }
        
        if (subcategory) {
          validatedSubcategoryId = subcategory.id;
          // Auto-set category if not already set
          if (!validatedCategoryId) {
            validatedCategoryId = subcategory.categoryId;
          }
          console.log(`[PUT] Subcategory validated: ${subcategory.name} (ID: ${validatedSubcategoryId})`);
        }
      } catch (error: any) {
        console.error('Error validating subcategory:', error);
        validatedSubcategoryId = null;
      }
    }

    // Validate application exists
    let validatedApplicationId = null;
    if (application_id && String(application_id).trim() !== '') {
      try {
        const applicationIdStr = String(application_id).trim();
        console.log(`[PUT] Validating application: "${applicationIdStr}" (isUUID: ${isUUID(applicationIdStr)}, validatedSubcategoryId: ${validatedSubcategoryId})`);
        let application = null;
        
        if (isUUID(applicationIdStr)) {
          // Try to find by ID
          application = await prisma.application.findUnique({
            where: { id: applicationIdStr },
            include: { subcategory: { include: { category: true } } },
          });
          console.log(`[PUT] Application lookup by ID: ${application ? 'found' : 'not found'}`);
        }
        
        // If not found by ID, try to find by name
        if (!application) {
          if (validatedSubcategoryId) {
            // Try within the validated subcategory
            application = await prisma.application.findFirst({
              where: { 
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId 
              },
              include: { subcategory: { include: { category: true } } },
            });
            console.log(`[PUT] Application lookup by name in subcategory: ${application ? 'found' : 'not found'}`);
          }
          
          // If still not found, try any subcategory
          if (!application) {
            application = await prisma.application.findFirst({
              where: { name: applicationIdStr },
              include: { subcategory: { include: { category: true } } },
            });
            console.log(`[PUT] Application lookup by name (any subcategory): ${application ? 'found' : 'not found'}`);
          }
        }
        
        // If still not found and we have a subcategory, auto-create it
        if (!application && validatedSubcategoryId) {
          console.log(`[PUT] Attempting to auto-create application: "${applicationIdStr}" in subcategory: ${validatedSubcategoryId}`);
          try {
            application = await prisma.application.create({
              data: {
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId,
                status: 'active',
              },
              include: { subcategory: { include: { category: true } } },
            });
            console.log(`[PUT] Application auto-created: ${application.name} (ID: ${application.id})`);
          } catch (createError: any) {
            console.error(`[PUT] Error auto-creating application: ${createError.message}`);
            // If creation fails (e.g., unique constraint), try to find it again
            application = await prisma.application.findFirst({
              where: { 
                name: applicationIdStr,
                subcategoryId: validatedSubcategoryId 
              },
              include: { subcategory: { include: { category: true } } },
            });
            if (application) {
              console.log(`[PUT] Application found after creation attempt: ${application.name}`);
            } else {
              console.error(`[PUT] Application still not found after creation attempt`);
            }
          }
        } else if (!application) {
          console.log(`[PUT] Application not found and cannot be created (no subcategory): ${applicationIdStr}`);
        }
        
        if (application) {
          validatedApplicationId = application.id;
          // Auto-set subcategory and category if not already set
          if (!validatedSubcategoryId) {
            validatedSubcategoryId = application.subcategoryId;
            if (application.subcategory?.categoryId) {
              validatedCategoryId = application.subcategory.categoryId;
            }
          }
          console.log(`[PUT] Application validated: ${application.name} (ID: ${validatedApplicationId})`);
        }
      } catch (error: any) {
        console.error('Error validating application:', error);
        validatedApplicationId = null;
      }
    }

    // Ensure foreign key relationships are valid
    // If subcategory is set, category must also be set and match
    if (validatedSubcategoryId && !validatedCategoryId) {
      // Get category from subcategory
      try {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: validatedSubcategoryId },
        });
        if (subcategory) {
          validatedCategoryId = subcategory.categoryId;
        } else {
          // Subcategory doesn't exist, clear it
          validatedSubcategoryId = null;
        }
      } catch (error) {
        validatedSubcategoryId = null;
      }
    }
    
    // If application is set, subcategory and category must also be set and match
    if (validatedApplicationId) {
      if (!validatedSubcategoryId) {
        // Get subcategory from application
        try {
          const application = await prisma.application.findUnique({
            where: { id: validatedApplicationId },
            include: { subcategory: true },
          });
          if (application) {
            validatedSubcategoryId = application.subcategoryId;
            if (application.subcategory) {
              validatedCategoryId = application.subcategory.categoryId;
            }
          } else {
            // Application doesn't exist, clear it
            validatedApplicationId = null;
          }
        } catch (error) {
          validatedApplicationId = null;
        }
      } else {
        // Verify application belongs to subcategory
        try {
          const application = await prisma.application.findUnique({
            where: { id: validatedApplicationId },
          });
          if (application && application.subcategoryId !== validatedSubcategoryId) {
            // Application doesn't belong to subcategory, clear it
            validatedApplicationId = null;
          }
        } catch (error) {
          validatedApplicationId = null;
        }
      }
    }

    // Delete existing models and create new ones
    if (models && Array.isArray(models)) {
      await prisma.model.deleteMany({
        where: { partId: id },
      });
    }

    // Build update data object
    const updateData: any = {
      masterPartId,
      partNo: part_no,
      brandId,
      description: description || null,
      categoryId: validatedCategoryId,
      subcategoryId: validatedSubcategoryId,
      applicationId: validatedApplicationId,
      hsCode: hs_code || null,
      weight: weight ? parseFloat(weight) : null,
      reorderLevel: reorder_level ? parseInt(reorder_level) : 0,
      uom: uom || 'pcs',
      cost: cost ? parseFloat(cost) : null,
      priceA: price_a ? parseFloat(price_a) : null,
      priceB: price_b ? parseFloat(price_b) : null,
      priceM: price_m ? parseFloat(price_m) : null,
      smc: smc || null,
      size: size || null,
      origin: origin || null,
      status: status || 'active',
    };

    // Handle images - explicitly set to null if provided as null/empty string, otherwise keep existing if not provided
    if ('image_p1' in req.body) {
      updateData.imageP1 = (image_p1 && image_p1.trim() !== '') ? image_p1 : null;
    }
    if ('image_p2' in req.body) {
      updateData.imageP2 = (image_p2 && image_p2.trim() !== '') ? image_p2 : null;
    }

    // Handle models
    if (models && Array.isArray(models)) {
      updateData.models = {
        create: models.map((m: any) => ({
          name: m.name,
          qtyUsed: m.qty_used || m.qtyUsed || 1,
        })),
      };
    }

    // Update part
    const part = await prisma.part.update({
      where: { id },
      data: updateData,
      include: {
        masterPart: true,
        brand: true,
        category: true,
        subcategory: true,
        application: true,
        models: true,
      },
    });

    // Debug log to verify application is included
    console.log(`Part updated - Application: ${part.application?.name || 'null'}, Application ID: ${part.applicationId || 'null'}`);

    res.json({
      id: part.id,
      // Step 1: Master Part No
      master_part_no: part.masterPart?.masterPartNo || null,
      // Step 2: Part Number
      part_no: part.partNo,
      // Step 3: Brand
      brand_name: part.brand?.name || null,
      brand_id: part.brandId || null,
      // Step 4: Description
      description: part.description || null,
      // Step 5: Category
      category_name: part.category?.name || null,
      category_id: part.categoryId || null,
      // Step 6: Subcategory
      subcategory_name: part.subcategory?.name || null,
      subcategory_id: part.subcategoryId || null,
      // Step 7: Application
      application_name: part.application?.name || null,
      application_id: part.applicationId || null,
      application: part.application ? { id: part.application.id, name: part.application.name } : null,
      // Step 8: Other fields
      hs_code: part.hsCode || null,
      weight: part.weight || null,
      reorder_level: part.reorderLevel || 0,
      uom: part.uom || "pcs",
      cost: part.cost || null,
      price_a: part.priceA || null,
      price_b: part.priceB || null,
      price_m: part.priceM || null,
      smc: part.smc || null,
      size: part.size || null,
      origin: part.origin || null,
      image_p1: part.imageP1 || null,
      image_p2: part.imageP2 || null,
      status: part.status || "active",
      remarks: (part as any).remarks || null,
      models: part.models.map((m) => ({
        id: m.id,
        name: m.name,
        qty_used: m.qtyUsed,
      })),
      created_at: part.createdAt,
      updated_at: part.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating part:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete part
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if part exists
    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            kitItems: true,
            stockMovements: true,
            purchaseOrderItems: true,
            directPurchaseOrderItems: true,
            adjustmentItems: true,
            transferItems: true,
            verificationItems: true,
            priceHistory: true,
          },
        },
      },
    });

    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    // KitItem has onDelete: Restrict, so we need to check this first
    if (part._count.kitItems > 0) {
      // Get kit names that use this part
      const kitItems = await prisma.kitItem.findMany({
        where: { partId: id },
        include: {
          kit: {
            select: {
              name: true,
              badge: true,
            },
          },
        },
        take: 5, // Limit to first 5 for error message
      });

      const kitNames = kitItems.map(ki => ki.kit.name || ki.kit.badge).join(', ');
      const moreKits = part._count.kitItems > 5 ? ` and ${part._count.kitItems - 5} more` : '';
      
      return res.status(400).json({
        error: `Cannot delete part because it is used in ${part._count.kitItems} kit(s)`,
        details: `This part is used in the following kits: ${kitNames}${moreKits}. Please remove this part from all kits before deleting it.`,
        kitCount: part._count.kitItems,
      });
    }

    // Other relationships have onDelete: Cascade, but we can inform the user
    const relatedCounts = {
      stockMovements: part._count.stockMovements,
      purchaseOrderItems: part._count.purchaseOrderItems,
      directPurchaseOrderItems: part._count.directPurchaseOrderItems,
      adjustmentItems: part._count.adjustmentItems,
      transferItems: part._count.transferItems,
      verificationItems: part._count.verificationItems,
      priceHistory: part._count.priceHistory,
    };

    const totalRelated = Object.values(relatedCounts).reduce((sum, count) => sum + count, 0);

    // Delete price history records FIRST (they don't have cascade and reference the part)
    if (part._count.priceHistory > 0) {
      await prisma.priceHistory.deleteMany({
        where: { partId: id },
      });
    }

    // Delete the part (cascade deletes will handle other related records)
    await prisma.part.delete({
      where: { id },
    });

    res.json({
      message: 'Part deleted successfully',
      deletedRelatedRecords: totalRelated > 0 ? {
        stockMovements: relatedCounts.stockMovements,
        purchaseOrderItems: relatedCounts.purchaseOrderItems,
        directPurchaseOrderItems: relatedCounts.directPurchaseOrderItems,
        adjustmentItems: relatedCounts.adjustmentItems,
        transferItems: relatedCounts.transferItems,
        verificationItems: relatedCounts.verificationItems,
        priceHistory: relatedCounts.priceHistory,
      } : null,
    });
  } catch (error: any) {
    console.error('Error deleting part:', error);
    
    // Handle foreign key constraint errors more gracefully
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete part due to foreign key constraints',
        details: 'This part is referenced by other records in the system. Please remove all references before deleting.',
        code: error.code,
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Update individual part prices - MUST BE AFTER /:id routes
router.put('/:id/prices', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cost, priceA, priceB, reason, updated_by } = req.body;

    const part = await prisma.part.findUnique({
      where: { id },
    });

    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const updates: any = {};
    const historyRecords: any[] = [];

    if (cost !== undefined) {
      const oldCost = part.cost || 0;
      const newCost = parseFloat(cost);
      if (!isNaN(newCost)) {
        updates.cost = newCost;
        historyRecords.push({
          partId: part.id,
          partNo: part.partNo,
          description: part.description,
          priceField: 'cost',
          updateType: 'individual',
          oldValue: oldCost,
          newValue: newCost,
          itemsUpdated: 1,
          reason: reason || 'Individual price update',
          updatedBy: updated_by || 'System',
        });
      }
    }

    if (priceA !== undefined) {
      const oldPriceA = part.priceA || 0;
      const newPriceA = parseFloat(priceA);
      if (!isNaN(newPriceA)) {
        updates.priceA = newPriceA;
        historyRecords.push({
          partId: part.id,
          partNo: part.partNo,
          description: part.description,
          priceField: 'priceA',
          updateType: 'individual',
          oldValue: oldPriceA,
          newValue: newPriceA,
          itemsUpdated: 1,
          reason: reason || 'Individual price update',
          updatedBy: updated_by || 'System',
        });
      }
    }

    if (priceB !== undefined) {
      const oldPriceB = part.priceB || 0;
      const newPriceB = parseFloat(priceB);
      if (!isNaN(newPriceB)) {
        updates.priceB = newPriceB;
        historyRecords.push({
          partId: part.id,
          partNo: part.partNo,
          description: part.description,
          priceField: 'priceB',
          updateType: 'individual',
          oldValue: oldPriceB,
          newValue: newPriceB,
          itemsUpdated: 1,
          reason: reason || 'Individual price update',
          updatedBy: updated_by || 'System',
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid price fields to update' });
    }

    // Update part
    const updatedPart = await prisma.part.update({
      where: { id },
      data: updates,
    });

    // Create history records
    for (const historyData of historyRecords) {
      await prisma.priceHistory.create({
        data: historyData,
      });
    }

    res.json({
      id: updatedPart.id,
      part_no: updatedPart.partNo,
      cost: updatedPart.cost,
      price_a: updatedPart.priceA,
      price_b: updatedPart.priceB,
    });
  } catch (error: any) {
    console.error('Error updating part prices:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
