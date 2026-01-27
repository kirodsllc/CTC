import express, { Request, Response } from 'express';
import prisma from '../config/database';
import { processPurchaseReceive } from '../utils/inventoryFormulas';
import { getCanonicalPartId } from '../services/partCanonical';

const router = express.Router();

// Get inventory dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      totalParts,
      activeParts,
      totalValue,
      categoriesCount,
      activeKits,
      suppliersCount,
    ] = await Promise.all([
      prisma.part.count(),
      prisma.part.count({ where: { status: 'active' } }),
      prisma.part.aggregate({
        _sum: {
          cost: true,
        },
        where: {
          status: 'active',
        },
      }),
      prisma.category.count({ where: { status: 'active' } }),
      prisma.kit.count({ where: { status: 'Active' } }),
      prisma.supplier.count({ where: { status: 'active' } }),
    ]);

    // Get total quantity from stock movements
    const totalQtyResult = await prisma.stockMovement.aggregate({
      _sum: {
        quantity: true,
      },
    });

    // Calculate stock levels from movements
    const allMovements = await prisma.stockMovement.findMany({
      select: {
        partId: true,
        quantity: true,
        type: true,
      },
    });

    // Group movements by part
    const stockByPart: Record<string, { in: number; out: number }> = {};
    for (const movement of allMovements) {
      if (!stockByPart[movement.partId]) {
        stockByPart[movement.partId] = { in: 0, out: 0 };
      }
      if (movement.type === 'in') {
        stockByPart[movement.partId].in += movement.quantity;
      } else {
        stockByPart[movement.partId].out += movement.quantity;
      }
    }

    // Calculate low stock and out of stock
    const parts = await prisma.part.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        reorderLevel: true,
      },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const part of parts) {
      const stock = stockByPart[part.id] || { in: 0, out: 0 };
      const currentStock = stock.in - stock.out;

      if (currentStock <= 0) {
        outOfStockCount++;
      } else if (part.reorderLevel > 0 && currentStock <= part.reorderLevel) {
        lowStockCount++;
      }
    }

    // Get chart data: Category Value Distribution
    const partsWithCategories = await prisma.part.findMany({
      where: { status: 'active' },
      include: {
        category: true,
      },
    });

    // Get all stock movements for these parts
    const partIds = partsWithCategories.map(p => p.id);
    const allPartMovements = partIds.length > 0 ? await prisma.stockMovement.findMany({
      where: {
        partId: { in: partIds },
      },
      select: {
        partId: true,
        quantity: true,
        type: true,
      },
    }) : [];

    // Group movements by part
    const movementsByPart: Record<string, { in: number; out: number }> = {};
    for (const movement of allPartMovements) {
      if (!movementsByPart[movement.partId]) {
        movementsByPart[movement.partId] = { in: 0, out: 0 };
      }
      if (movement.type === 'in') {
        movementsByPart[movement.partId].in += movement.quantity;
      } else {
        movementsByPart[movement.partId].out += movement.quantity;
      }
    }

    // Calculate category values
    const categoryValueMap: Record<string, number> = {};
    const categoryCountMap: Record<string, number> = {};
    
    for (const part of partsWithCategories) {
      const stock = movementsByPart[part.id] || { in: 0, out: 0 };
      const currentStock = stock.in - stock.out;
      // Use cost if available, otherwise use 0 (will show value as 0)
      const value = (part.cost || 0) * Math.max(0, currentStock);
      
      const catName = part.category ? part.category.name : 'Uncategorized';
      categoryValueMap[catName] = (categoryValueMap[catName] || 0) + value;
      categoryCountMap[catName] = (categoryCountMap[catName] || 0) + 1;
    }

    const categoryValueData = Object.entries(categoryValueMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    // Generate consistent colors for categories
    const categoryColors = [
      'hsl(0, 70%, 50%)',    // Red
      'hsl(30, 70%, 50%)',   // Orange
      'hsl(60, 70%, 50%)',   // Yellow
      'hsl(120, 70%, 50%)',  // Green
      'hsl(180, 70%, 50%)',  // Cyan
      'hsl(240, 70%, 50%)',  // Blue
      'hsl(270, 70%, 50%)',  // Purple
      'hsl(300, 70%, 50%)',  // Magenta
    ];

    const categoryDistribution = Object.entries(categoryCountMap)
      .map(([name, count], index) => ({
        name,
        value: count,
        color: categoryColors[index % categoryColors.length],
      }))
      .sort((a, b) => b.value - a.value);

    // Get brand values
    const partsWithBrands = await prisma.part.findMany({
      where: { status: 'active' },
      include: {
        brand: true,
      },
    });

    const brandValueMap: Record<string, number> = {};
    for (const part of partsWithBrands) {
      const stock = movementsByPart[part.id] || { in: 0, out: 0 };
      const currentStock = stock.in - stock.out;
      const value = (part.cost || 0) * currentStock;
      
      if (part.brand) {
        brandValueMap[part.brand.name] = (brandValueMap[part.brand.name] || 0) + value;
      } else {
        // Handle parts without brand
        const brandName = 'No Brand';
        brandValueMap[brandName] = (brandValueMap[brandName] || 0) + value;
      }
    }

    const topBrandsByValue = Object.entries(brandValueMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Get stock movement trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const movementsLast6Months = await prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        quantity: true,
        type: true,
        createdAt: true,
      },
    });

    // Group by month
    const monthlyData: Record<string, { in: number; out: number }> = {};
    for (const movement of movementsLast6Months) {
      const monthKey = new Date(movement.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { in: 0, out: 0 };
      }
      if (movement.type === 'in') {
        monthlyData[monthKey].in += movement.quantity;
      } else {
        monthlyData[monthKey].out += movement.quantity;
      }
    }

    // Generate last 6 months
    const stockMovementData = [];
    let balance = 0;
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      const monthData = monthlyData[monthKey] || { in: 0, out: 0 };
      balance += monthData.in - monthData.out;
      stockMovementData.push({
        month: monthKey,
        balance,
        stockIn: monthData.in,
        stockOut: monthData.out,
      });
    }

    res.json({
      totalParts,
      activeParts,
      totalValue: totalValue._sum.cost || 0,
      totalQty: totalQtyResult._sum.quantity || 0,
      categoriesCount,
      activeKits,
      suppliersCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      charts: {
        categoryValueData,
        categoryDistribution,
        topBrandsByValue,
        stockMovementData,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock movements
router.get('/movements', async (req: Request, res: Response) => {
  try {
    const {
      part_id,
      type,
      from_date,
      to_date,
      store_id,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (part_id) {
      where.partId = part_id as string;
    }

    if (type) {
      where.type = type as string;
    }

    if (store_id) {
      where.storeId = store_id as string;
    }

    if (from_date || to_date) {
      where.createdAt = {};
      if (from_date) {
        where.createdAt.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.createdAt.lte = new Date(to_date as string);
      }
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          part: {
            include: {
              brand: true,
              category: true,
            },
          },
          store: true,
          rack: true,
          shelf: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Get reserved quantities for all parts in movements
    // Check both StockMovement with referenceType='stock_reservation' and StockReservation table
    const partIdsSet = new Set(movements.map(m => m.partId));
    const partIds = Array.from(partIdsSet);
    
    
    // Initialize with empty objects if no parts
    const reservedByPart: Record<string, number> = {};
    const stockBalanceByPart: Record<string, number> = {};
    
    if (partIds.length === 0) {
    } else {
      // Get reservations from StockMovement (new method)
      const stockMovementReservations = await prisma.stockMovement.findMany({
        where: {
          partId: { in: partIds },
          referenceType: 'stock_reservation',
        },
      });

      // Get reservations from StockReservation table (legacy method)
      const stockReservations = await prisma.stockReservation.findMany({
        where: {
          partId: { in: partIds },
          status: 'reserved',
        },
      });

      // Group reservations by partId (combine both sources)
      stockMovementReservations.forEach(res => {
        reservedByPart[res.partId] = (reservedByPart[res.partId] || 0) + res.quantity;
      });
      stockReservations.forEach(res => {
        reservedByPart[res.partId] = (reservedByPart[res.partId] || 0) + res.quantity;
      });

      // Calculate current stock balance for each part
      // IMPORTANT: Get ALL movements for these parts (not just current page) to calculate accurate stock balance
      const allMovements = await prisma.stockMovement.findMany({
        where: {
          partId: { in: partIds },
          OR: [
            { referenceType: null },
            { referenceType: { not: 'stock_reservation' } }
          ]
        },
        select: {
          partId: true,
          type: true,
          quantity: true,
        },
      });

      // Calculate stock balance per part
      allMovements.forEach(m => {
        if (!stockBalanceByPart[m.partId]) {
          stockBalanceByPart[m.partId] = 0;
        }
        if (m.type === 'in') {
          stockBalanceByPart[m.partId] += m.quantity;
        } else {
          stockBalanceByPart[m.partId] -= m.quantity;
        }
      });

      // Debug logging
      partIds.slice(0, 5).forEach(partId => {
        const stock = stockBalanceByPart[partId] || 0;
        const reserved = reservedByPart[partId] || 0;
        const available = Math.max(0, stock - reserved);
        const part = movements.find(m => m.partId === partId);
      });
    }

    const responseData = movements.map(m => {
        const currentStock = stockBalanceByPart[m.partId] || 0;
        const reservedQty = reservedByPart[m.partId] || 0;
        const availableQty = Math.max(0, currentStock - reservedQty);
        
        // Debug: Log first few movements - ALWAYS log to diagnose
        if (movements.indexOf(m) < 5) {
        }
        
        const movementData = {
          id: m.id,
          part_id: m.partId,
          part_no: m.part.partNo,
          part_description: m.part.description,
          brand: m.part.brand?.name || null,
          category: m.part.category?.name || null,
          type: m.type,
          quantity: m.quantity,
          reserved_quantity: reservedQty,
          current_stock: currentStock,
          available_quantity: availableQty,
          store_id: m.storeId,
          store_name: m.store?.name || null,
          rack_id: m.rackId,
          rack_code: m.rack?.codeNo || null,
          shelf_id: m.shelfId,
          shelf_no: m.shelf?.shelfNo || null,
          reference_type: m.referenceType,
          reference_id: m.referenceId,
          notes: m.notes,
          created_at: m.createdAt,
        };
        
        // Verify data is being set correctly
        if (movements.indexOf(m) === 0) {
        }
        
        return movementData;
      });

    // CRITICAL DEBUG: Verify responseData has the fields before sending
    if (responseData.length > 0) {
      const firstItem = responseData[0];
    }

    res.json({
      data: responseData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create stock movement (Stock In/Out)
router.post('/movements', async (req: Request, res: Response) => {
  try {
    const {
      part_id,
      type,
      quantity,
      store_id,
      rack_id,
      shelf_id,
      reference_type,
      reference_id,
      notes,
    } = req.body;

    if (!part_id || !type || !quantity) {
      return res.status(400).json({ error: 'part_id, type, and quantity are required' });
    }

    if (type !== 'in' && type !== 'out') {
      return res.status(400).json({ error: 'type must be "in" or "out"' });
    }

    const movement = await prisma.stockMovement.create({
      data: {
        partId: part_id,
        type: type,
        quantity: parseInt(quantity),
        storeId: store_id || null,
        rackId: rack_id || null,
        shelfId: shelf_id || null,
        referenceType: reference_type || null,
        referenceId: reference_id || null,
        notes: notes || null,
      },
      include: {
        part: {
          include: {
            brand: true,
          },
        },
        store: true,
      },
    });

    res.status(201).json({
      id: movement.id,
      part_id: movement.partId,
      part_no: movement.part.partNo,
      type: movement.type,
      quantity: movement.quantity,
      created_at: movement.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock balance for a part
router.get('/balance/:partId', async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const movements = await prisma.stockMovement.findMany({
      where: { partId },
    });

    const stockIn = movements
      .filter(m => m.type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);
    const stockOut = movements
      .filter(m => m.type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);
    const currentStock = stockIn - stockOut;

    const part = await prisma.part.findUnique({
      where: { id: partId },
      include: {
        brand: true,
        category: true,
      },
    });

    res.json({
      part_id: partId,
      part_no: part?.partNo,
      part_description: part?.description,
      brand: part?.brand?.name || null,
      category: part?.category?.name || null,
      stock_in: stockIn,
      stock_out: stockOut,
      current_stock: currentStock,
      reorder_level: part?.reorderLevel || 0,
      is_low_stock: part?.reorderLevel ? currentStock <= part.reorderLevel : false,
      is_out_of_stock: currentStock <= 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all stock balances
router.get('/balances', async (req: Request, res: Response) => {
  try {
    const { search, category_id, low_stock, out_of_stock, in_stock, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { status: 'active' };
    if (category_id) {
      where.categoryId = category_id as string;
    }

    const parts = await prisma.part.findMany({
      where,
      include: {
        brand: true,
        category: true,
        masterPart: true,
      },
      skip,
      take: limitNum,
    });

    // Get stock movements for these parts with location info
    const partIds = parts.map(p => p.id);
    const movements = await prisma.stockMovement.findMany({
      where: {
        partId: { in: partIds },
      },
      select: {
        partId: true,
        quantity: true,
        type: true,
        rack: {
          select: {
            id: true,
            codeNo: true,
          },
        },
        shelf: {
          select: {
            id: true,
            shelfNo: true,
          },
        },
      },
    });

    // Group movements by part and location
    const stockByPart: Record<string, { in: number; out: number; locations: Set<string> }> = {};
    for (const movement of movements) {
      if (!stockByPart[movement.partId]) {
        stockByPart[movement.partId] = { in: 0, out: 0, locations: new Set() };
      }
      if (movement.type === 'in') {
        stockByPart[movement.partId].in += movement.quantity;
      } else {
        stockByPart[movement.partId].out += movement.quantity;
      }
      
      // Collect location info
      if (movement.rack?.codeNo) {
        const location = movement.shelf?.shelfNo 
          ? `${movement.rack.codeNo}${movement.shelf.shelfNo}`
          : movement.rack.codeNo;
        stockByPart[movement.partId].locations.add(location);
      }
    }

    const balances = parts.map(part => {
      const stock = stockByPart[part.id] || { in: 0, out: 0, locations: new Set() };
      const currentStock = stock.in - stock.out;
      const locations = Array.from(stock.locations);
      const location = locations.length > 0 ? locations[0] : null; // Use first location or null

      return {
        part_id: part.id,
        part_no: part.partNo,
        master_part_no: part.masterPart?.masterPartNo || null,
        description: part.description,
        brand: part.brand?.name || null,
        category: part.category?.name || null,
        location: location,
        stock_in: stock.in,
        stock_out: stock.out,
        current_stock: currentStock,
        reorder_level: part.reorderLevel,
        is_low_stock: part.reorderLevel ? currentStock <= part.reorderLevel : false,
        is_out_of_stock: currentStock <= 0,
        cost: part.cost,
        price: part.priceA || part.priceB || part.priceM || null,
        value: (part.cost || 0) * currentStock,
      };
    });

    // Apply filters
    let filteredBalances = balances;
    if (String(in_stock ?? '').toLowerCase() === 'true') {
      filteredBalances = filteredBalances.filter(b => b.current_stock > 0);
    }
    if (low_stock === 'true') {
      filteredBalances = filteredBalances.filter(b => b.is_low_stock && !b.is_out_of_stock);
    }
    if (out_of_stock === 'true') {
      filteredBalances = filteredBalances.filter(b => b.is_out_of_stock);
    }
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredBalances = filteredBalances.filter(b =>
        b.part_no.toLowerCase().includes(searchLower) ||
        b.description?.toLowerCase().includes(searchLower) ||
        b.brand?.toLowerCase().includes(searchLower)
      );
    }

    const total = await prisma.part.count({ where });

    res.json({
      data: filteredBalances,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock movement analysis
router.get('/stock-analysis', async (req: Request, res: Response) => {
  try {
    const {
      fast_moving_days = '30',
      slow_moving_days = '90',
      dead_stock_days = '180',
      analysis_period = '6',
      search,
      category,
      classification,
    } = req.query;

    const fastMovingDays = parseInt(fast_moving_days as string);
    const slowMovingDays = parseInt(slow_moving_days as string);
    const deadStockDays = parseInt(dead_stock_days as string);
    const analysisPeriodMonths = parseInt(analysis_period as string);

    // Calculate analysis period start date
    const analysisStartDate = new Date();
    analysisStartDate.setMonth(analysisStartDate.getMonth() - analysisPeriodMonths);

    // Get all active parts
    const where: any = { status: 'active' };
    if (category && category !== 'all' && category !== 'All Categories') {
      const categoryRecord = await prisma.category.findFirst({
        where: { name: { contains: category as string } },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    const parts = await prisma.part.findMany({
      where,
      include: {
        brand: true,
        category: true,
      },
    });

    // Get all stock movements for these parts
    const partIds = parts.map(p => p.id);
    const allMovements = await prisma.stockMovement.findMany({
      where: {
        partId: { in: partIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group movements by part
    const movementsByPart: Record<string, typeof allMovements> = {};
    for (const movement of allMovements) {
      if (!movementsByPart[movement.partId]) {
        movementsByPart[movement.partId] = [];
      }
      movementsByPart[movement.partId].push(movement);
    }

    // Calculate stock levels and analysis metrics
    const stockByPart: Record<string, { in: number; out: number; lastMovementDate: Date | null }> = {};
    for (const part of parts) {
      const movements = movementsByPart[part.id] || [];
      stockByPart[part.id] = {
        in: 0,
        out: 0,
        lastMovementDate: movements.length > 0 ? movements[0].createdAt : null,
      };
      for (const movement of movements) {
        if (movement.type === 'in') {
          stockByPart[part.id].in += movement.quantity;
        } else {
          stockByPart[part.id].out += movement.quantity;
        }
      }
    }

    // Calculate turnover (movements in analysis period)
    const turnoverByPart: Record<string, number> = {};
    for (const part of parts) {
      const movements = movementsByPart[part.id] || [];
      const periodMovements = movements.filter(m => m.createdAt >= analysisStartDate);
      // Calculate total quantity moved (both in and out)
      const totalMoved = periodMovements.reduce((sum, m) => sum + m.quantity, 0);
      // Turnover = total moved / analysis period in months
      turnoverByPart[part.id] = totalMoved / analysisPeriodMonths;
    }

    // Build analysis results
    const results = [];
    const now = new Date();

    for (const part of parts) {
      const stock = stockByPart[part.id] || { in: 0, out: 0, lastMovementDate: null };
      const currentStock = stock.in - stock.out;
      const value = (part.cost || 0) * currentStock;

      // Calculate days idle
      let daysIdle = 0;
      if (stock.lastMovementDate) {
        const diffTime = now.getTime() - stock.lastMovementDate.getTime();
        daysIdle = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else {
        // If no movement, consider it very old (e.g., 365 days)
        daysIdle = 365;
      }

      const turnover = turnoverByPart[part.id] || 0;

      // Classify item
      let itemClassification: 'Fast' | 'Normal' | 'Slow' | 'Dead' = 'Normal';
      if (daysIdle >= deadStockDays || turnover === 0) {
        itemClassification = 'Dead';
      } else if (daysIdle >= slowMovingDays) {
        itemClassification = 'Slow';
      } else if (daysIdle <= fastMovingDays && turnover >= 5) {
        itemClassification = 'Fast';
      }

      // Apply classification filter
      if (classification && classification !== 'All' && classification !== 'all') {
        if (itemClassification !== classification) {
          continue;
        }
      }

      // Apply search filter
      if (search) {
        const searchLower = (search as string).toLowerCase();
        const matchesSearch =
          part.partNo.toLowerCase().includes(searchLower) ||
          (part.description || '').toLowerCase().includes(searchLower) ||
          (part.category?.name || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) {
          continue;
        }
      }

      results.push({
        id: part.id,
        partNo: part.partNo,
        description: part.description || '',
        category: part.category?.name || 'Uncategorized',
        quantity: currentStock,
        value: value,
        daysIdle: daysIdle,
        turnover: Math.round(turnover * 10) / 10, // Round to 1 decimal
        classification: itemClassification,
      });
    }

    // Sort by part number
    results.sort((a, b) => a.partNo.localeCompare(b.partNo));

    res.json({
      data: results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock balance & valuation with store and location details
router.get('/stock-balance-valuation', async (req: Request, res: Response) => {
  try {
    const { search, category, store, page = '1', limit = '1000' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get all active parts
    const where: any = { status: 'active' };
    if (category && category !== 'All Categories') {
      const categoryRecord = await prisma.category.findFirst({
        where: { name: { contains: category as string } },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    const parts = await prisma.part.findMany({
      where,
      include: {
        brand: true,
        category: true,
      },
    });

    // Get all stock movements with store, rack, and shelf information
    const partIds = parts.map(p => p.id);
    const movements = await prisma.stockMovement.findMany({
      where: {
        partId: { in: partIds },
      },
      include: {
        store: true,
        rack: true,
        shelf: true,
      },
    });

    // Group movements by part, store, rack, and shelf for accurate location-based tracking
    // Key format: partId_storeId_rackId_shelfId
    const stockByLocation: Record<string, { 
      in: number; 
      out: number; 
      store: any; 
      rack: any; 
      shelf: any;
    }> = {};
    
    for (const movement of movements) {
      // Use consistent keys for null values
      const storeId = movement.storeId || 'no-store';
      const rackId = movement.rackId || 'no-rack';
      const shelfId = movement.shelfId || 'no-shelf';
      const key = `${movement.partId}_${storeId}_${rackId}_${shelfId}`;
      
      if (!stockByLocation[key]) {
        stockByLocation[key] = {
          in: 0,
          out: 0,
          store: movement.store,
          rack: movement.rack,
          shelf: movement.shelf,
        };
      }
      
      // Accumulate quantities correctly
      if (movement.type === 'in') {
        stockByLocation[key].in += movement.quantity;
      } else if (movement.type === 'out') {
        stockByLocation[key].out += movement.quantity;
      }
    }

    // Build result array - one row per part-store-location combination
    const result: any[] = [];
    let itemId = 1;

    for (const part of parts) {
      // Find all locations for this part
      const partLocations = Object.entries(stockByLocation).filter(([key]) => key.startsWith(`${part.id}_`));
      
      if (partLocations.length === 0) {
        // If no movements, include the part with zero stock (only if matches search)
        const matchesSearch = !search || 
          part.partNo.toLowerCase().includes((search as string).toLowerCase()) || 
          (part.description || '').toLowerCase().includes((search as string).toLowerCase());
        
        if (matchesSearch) {
          result.push({
            id: itemId++,
            partNo: part.partNo,
            description: part.description || '',
            category: part.category?.name || 'Uncategorized',
            uom: part.uom || 'pcs',
            quantity: 0,
            cost: part.cost || 0,
            value: 0,
            store: 'No Store',
            location: '-',
          });
        }
      } else {
        // Create an entry for each location
        for (const [key, stockData] of partLocations) {
          const quantity = stockData.in - stockData.out;
          const storeName = stockData.store?.name || 'No Store';
          
          // Apply store filter
          if (store && store !== 'All Stores' && storeName !== store) {
            continue;
          }
          
          // Build location string
          const rackCode = stockData.rack?.codeNo || '';
          const shelfNo = stockData.shelf?.shelfNo || '';
          const location = rackCode && shelfNo 
            ? `${rackCode}/${shelfNo}` 
            : rackCode || shelfNo || '-';
          
          // Include all items (including zero or negative quantity for accurate reporting)
          // Negative quantities indicate data issues but should be shown
          result.push({
            id: itemId++,
            partNo: part.partNo,
            description: part.description || '',
            category: part.category?.name || 'Uncategorized',
            uom: part.uom || 'pcs',
            quantity: quantity,
            cost: part.cost || 0,
            value: (part.cost || 0) * Math.max(0, quantity), // Value should not be negative
            store: storeName,
            location: location,
          });
        }
      }
    }

    // Apply search filter
    let filteredResult = result;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredResult = filteredResult.filter(item =>
        item.partNo.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter (already done in query, but double-check)
    if (category && category !== 'All Categories') {
      filteredResult = filteredResult.filter(item => 
        item.category.toLowerCase().includes((category as string).toLowerCase())
      );
    }

    // Sort by part number
    filteredResult.sort((a, b) => a.partNo.localeCompare(b.partNo));

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
    res.status(500).json({ error: error.message });
  }
});

// Get transfers
router.get('/transfers', async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    if (from_date || to_date) {
      where.date = {};
      if (from_date) {
        where.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.date.lte = new Date(to_date as string);
      }
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: {
          fromStore: true,
          toStore: true,
          items: {
            include: {
              part: {
                include: {
                  brand: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.transfer.count({ where }),
    ]);

    res.json({
      data: transfers.map(t => ({
        id: t.id,
        transfer_number: t.transferNumber,
        date: t.date,
        status: t.status,
        notes: t.notes,
        total_qty: t.totalQty,
        from_store: t.fromStore?.name || null,
        to_store: t.toStore?.name || null,
        items_count: t.items.length,
        created_at: t.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create transfer
router.post('/transfers', async (req: Request, res: Response) => {
  try {
    const { transfer_number, date, from_store_id, to_store_id, notes, items } = req.body;

    if (!transfer_number || !date || !items || items.length === 0) {
      return res.status(400).json({ error: 'transfer_number, date, and items are required' });
    }

    const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    const transfer = await prisma.transfer.create({
      data: {
        transferNumber: transfer_number,
        date: new Date(date),
        fromStoreId: from_store_id || null,
        toStoreId: to_store_id || null,
        notes: notes || null,
        totalQty: totalQty,
        status: 'Draft',
        items: {
          create: items.map((item: any) => ({
            partId: item.part_id,
            fromStoreId: item.from_store_id || null,
            fromRackId: item.from_rack_id || null,
            fromShelfId: item.from_shelf_id || null,
            toStoreId: item.to_store_id || null,
            toRackId: item.to_rack_id || null,
            toShelfId: item.to_shelf_id || null,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.status(201).json({
      id: transfer.id,
      transfer_number: transfer.transferNumber,
      date: transfer.date,
      status: transfer.status,
      total_qty: transfer.totalQty,
      items_count: transfer.items.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single transfer
router.get('/transfers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
            fromStore: true,
            fromRack: true,
            fromShelf: true,
            toStore: true,
            toRack: true,
            toShelf: true,
          },
        },
      },
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.json({
      id: transfer.id,
      transfer_number: transfer.transferNumber,
      date: transfer.date,
      status: transfer.status,
      notes: transfer.notes,
      total_qty: transfer.totalQty,
      from_store_id: transfer.fromStoreId,
      from_store: transfer.fromStore?.name || null,
      to_store_id: transfer.toStoreId,
      to_store: transfer.toStore?.name || null,
      items: transfer.items.map(item => ({
        id: item.id,
        part_id: item.partId,
        part_no: item.part.partNo,
        part_description: item.part.description,
        brand: item.part.brand?.name || '',
        category: item.part.category?.name || '',
        quantity: item.quantity,
        from_store_id: item.fromStoreId,
        from_store: item.fromStore?.name || null,
        from_rack_id: item.fromRackId,
        from_rack: item.fromRack?.codeNo || null,
        from_shelf_id: item.fromShelfId,
        from_shelf: item.fromShelf?.shelfNo || null,
        to_store_id: item.toStoreId,
        to_store: item.toStore?.name || null,
        to_rack_id: item.toRackId,
        to_rack: item.toRack?.codeNo || null,
        to_shelf_id: item.toShelfId,
        to_shelf: item.toShelf?.shelfNo || null,
      })),
      created_at: transfer.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update transfer
router.put('/transfers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transfer_number, date, from_store_id, to_store_id, notes, status, items } = req.body;

    // Check if transfer exists
    const existingTransfer = await prisma.transfer.findUnique({ where: { id } });
    if (!existingTransfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const totalQty = items ? items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) : existingTransfer.totalQty;

    // Update transfer
    const transfer = await prisma.transfer.update({
      where: { id },
      data: {
        ...(transfer_number && { transferNumber: transfer_number }),
        ...(date && { date: new Date(date) }),
        ...(from_store_id !== undefined && { fromStoreId: from_store_id || null }),
        ...(to_store_id !== undefined && { toStoreId: to_store_id || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status && { status }),
        ...(totalQty !== undefined && { totalQty }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              partId: item.part_id,
              fromStoreId: item.from_store_id || null,
              fromRackId: item.from_rack_id || null,
              fromShelfId: item.from_shelf_id || null,
              toStoreId: item.to_store_id || null,
              toRackId: item.to_rack_id || null,
              toShelfId: item.to_shelf_id || null,
              quantity: item.quantity,
            })),
          },
        }),
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.json({
      id: transfer.id,
      transfer_number: transfer.transferNumber,
      date: transfer.date,
      status: transfer.status,
      total_qty: transfer.totalQty,
      items_count: transfer.items.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transfer
router.delete('/transfers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({ where: { id } });
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    await prisma.transfer.delete({ where: { id } });

    res.json({ message: 'Transfer deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get adjustments
router.get('/adjustments', async (req: Request, res: Response) => {
  try {
    const { from_date, to_date, status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (from_date || to_date) {
      where.date = {};
      if (from_date) {
        where.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.date.lte = new Date(to_date as string);
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const [adjustments, total] = await Promise.all([
      prisma.adjustment.findMany({
        where,
        include: {
          store: true,
          items: {
            include: {
              part: {
                include: {
                  brand: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.adjustment.count({ where }),
    ]);

    // Fetch vouchers separately
    const voucherIds = adjustments.map((a: any) => a.voucherId).filter(Boolean);
    const vouchers = voucherIds.length > 0 ? await prisma.voucher.findMany({
      where: { id: { in: voucherIds } },
      select: {
        id: true,
        voucherNumber: true,
        status: true,
      },
    }) : [];
    const voucherMap = new Map(vouchers.map(v => [v.id, v]));

    res.json({
      data: adjustments.map((a: any) => {
        const voucher = a.voucherId ? voucherMap.get(a.voucherId) : null;
        return {
          id: a.id,
          date: a.date,
          subject: a.subject,
          store_id: a.storeId,
          store_name: a.store?.name || null,
          add_inventory: a.addInventory,
          notes: a.notes,
          total_amount: a.totalAmount,
          status: a.status,
          voucher_id: a.voucherId,
          voucher_number: voucher?.voucherNumber || null,
          voucher_status: voucher?.status || null,
          items_count: a.items.length,
          items: a.items.map((item: any) => ({
            id: item.id,
            part_id: item.partId,
            part_no: item.part.partNo,
            part_description: item.part.description,
            brand: item.part.brand?.name || '',
            quantity: item.quantity,
            cost: item.cost,
            notes: item.notes,
            rack_id: item.rackId,
            rack_code: item.rack?.codeNo || null,
            shelf_id: item.shelfId,
            shelf_no: item.shelf?.shelfNo || null,
          })),
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create adjustment
router.post('/adjustments', async (req: Request, res: Response) => {
  try {
    const { date, subject, store_id, add_inventory, notes, items } = req.body;

    if (!date || !items || items.length === 0) {
      return res.status(400).json({ error: 'date and items are required' });
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item: any) => {
      const cost = item.cost || 0;
      const qty = item.quantity || 0;
      return sum + (cost * qty);
    }, 0);

    // Fetch adjustment items with part details for voucher description
    const parts = await prisma.part.findMany({
      where: {
        id: { in: items.map((item: any) => item.part_id) },
      },
      include: {
        brand: true,
      },
    });

    const partMap = new Map(parts.map(p => [p.id, p]));

    // Build voucher description from items
    const itemDescriptions = items.map((item: any) => {
      const part = partMap.get(item.part_id);
      const partInfo = part 
        ? `${part.partNo}/${part.description || ''}/${part.brand?.name || ''}/${part.partNo}`
        : `Part ${item.part_id}`;
      return `Item: ${partInfo} is ${add_inventory !== false ? 'added' : 'remove'} from Adjust Inventory, Qty:${item.quantity}, Rate: ${item.cost || 0}`;
    }).join('; ');

    // Find required accounts
    const inventoryAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '101001' }, // Inventory
          { code: '104005' }, // Inventory - General (fallback)
          { code: '104001' }, // Raw Materials (fallback)
        ],
        status: 'Active',
      },
      include: {
        subgroup: { include: { mainGroup: true } },
      },
    });

    if (!inventoryAccount) {
      return res.status(400).json({ error: 'Inventory account (101001) not found. Please create it first.' });
    }

    let secondAccount;
    if (add_inventory !== false) {
      // Quantity increase: Credit Owner Equity (501003)
      secondAccount = await prisma.account.findFirst({
        where: {
          code: '501003',
          status: 'Active',
        },
        include: {
          subgroup: { include: { mainGroup: true } },
        },
      });

      if (!secondAccount) {
        // Try to create Owner Capital account
        const capitalSubgroup = await prisma.subgroup.findFirst({
          where: { code: '501' },
        });

        if (capitalSubgroup) {
          secondAccount = await prisma.account.create({
            data: {
              code: '501003',
              name: 'OWNER CAPITAL',
              description: 'Owner Capital account for inventory adjustments',
              openingBalance: 0,
              currentBalance: 0,
              status: 'Active',
              subgroupId: capitalSubgroup.id,
            },
            include: {
              subgroup: { include: { mainGroup: true } },
            },
          });
        } else {
          return res.status(400).json({ error: 'Owner Capital account (501003) not found and cannot be created. Please create subgroup 501 first.' });
        }
      }
    } else {
      // Quantity decrease: Debit Dispose Inventory (801014)
      secondAccount = await prisma.account.findFirst({
        where: {
          code: '801014',
          status: 'Active',
        },
        include: {
          subgroup: { include: { mainGroup: true } },
        },
      });

      if (!secondAccount) {
        // Try to create Dispose Inventory account
        const expenseSubgroup = await prisma.subgroup.findFirst({
          where: { code: '801' },
        });

        if (expenseSubgroup) {
          secondAccount = await prisma.account.create({
            data: {
              code: '801014',
              name: 'Dispose Inventory',
              description: 'Dispose Inventory expense account for inventory adjustments',
              openingBalance: 0,
              currentBalance: 0,
              status: 'Active',
              subgroupId: expenseSubgroup.id,
            },
            include: {
              subgroup: { include: { mainGroup: true } },
            },
          });
        } else {
          return res.status(400).json({ error: 'Dispose Inventory account (801014) not found and cannot be created. Please create subgroup 801 first.' });
        }
      }
    }

    // Generate JV voucher number
    const voucherCount = await prisma.voucher.count({
      where: { type: 'journal' },
    });
    const jvNumber = voucherCount + 1;
    const voucherNumber = `JV${String(jvNumber).padStart(4, '0')}`;

    // Prepare voucher entries - CRITICAL: accountId must be set for balance sheet queries
    const voucherEntries = [];
    
    if (add_inventory !== false) {
      // Quantity increase: Debit Inventory, Credit Owner Equity
      voucherEntries.push({
        accountId: inventoryAccount.id, // Must set accountId for balance sheet queries
        accountName: `${inventoryAccount.code}-${inventoryAccount.name}`,
        description: itemDescriptions,
        debit: totalAmount,
        credit: 0,
        sortOrder: 0,
      });
      voucherEntries.push({
        accountId: secondAccount.id, // Must set accountId for balance sheet queries
        accountName: `${secondAccount.code}-${secondAccount.name}`,
        description: `Add Adjust Inventory:`,
        debit: 0,
        credit: totalAmount,
        sortOrder: 1,
      });
    } else {
      // Quantity decrease: Debit Dispose Inventory, Credit Inventory
      voucherEntries.push({
        accountId: secondAccount.id, // Must set accountId for balance sheet queries
        accountName: `${secondAccount.code}-${secondAccount.name}`,
        description: `Dispose Adjust Inventory:`,
        debit: totalAmount,
        credit: 0,
        sortOrder: 0,
      });
      voucherEntries.push({
        accountId: inventoryAccount.id, // Must set accountId for balance sheet queries
        accountName: `${inventoryAccount.code}-${inventoryAccount.name}`,
        description: itemDescriptions,
        debit: 0,
        credit: totalAmount,
        sortOrder: 1,
      });
    }

    // Create voucher and auto-post it (status: posted) so it appears in balance sheet immediately
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        type: 'journal',
        date: new Date(date),
        narration: `Adjust Inventory: ${subject || 'Stock adjustment'}`,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
        status: 'posted', // Auto-post so it appears in balance sheet immediately
        createdBy: 'System',
        approvedBy: 'System',
        approvedAt: new Date(),
        entries: {
          create: voucherEntries,
        },
      },
      include: {
        entries: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update account balances immediately since voucher is posted
    for (const entry of voucher.entries) {
      if (!entry.accountId || !entry.account) {
        continue;
      }

      const accountType = entry.account.subgroup.mainGroup.type.toLowerCase();
      const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
        ? (entry.debit - entry.credit)
        : (entry.credit - entry.debit);

      await prisma.account.update({
        where: { id: entry.accountId },
        data: {
          currentBalance: {
            increment: balanceChange,
          },
        },
      });
    }

    // Create adjustment with status "pending" and link voucher
    const adjustment = await prisma.adjustment.create({
      data: {
        date: new Date(date),
        subject: subject || null,
        storeId: store_id || null,
        addInventory: add_inventory !== false,
        notes: notes || null,
        totalAmount: totalAmount,
        status: 'pending', // Pending - will be approved when store manager updates
        voucherId: voucher.id,
        items: {
          create: items.map((item: any) => ({
            partId: item.part_id,
            quantity: item.quantity,
            cost: item.cost || null,
            notes: item.notes || null,
            // rackId and shelfId will be assigned by store manager
          })),
        },
      } as any,
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    }) as any;

    // NOTE: Stock movements are NOT created here - they will be created when store manager approves

    res.status(201).json({
      id: adjustment.id,
      date: adjustment.date,
      subject: adjustment.subject,
      total_amount: adjustment.totalAmount,
      items_count: (adjustment as any).items.length,
      status: (adjustment as any).status,
      voucher_id: (adjustment as any).voucherId,
      voucher_number: voucher.voucherNumber,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get adjustments by store
router.get('/adjustments/by-store', async (req: Request, res: Response) => {
  try {
    const { store_id, status, page = '1', limit = '50' } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      storeId: store_id as string,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const [adjustments, total] = await Promise.all([
      prisma.adjustment.findMany({
        where,
        include: {
          store: true,
          items: {
            include: {
              part: {
                include: {
                  brand: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.adjustment.count({ where }),
    ]);

    // Fetch vouchers separately
    const adjustmentIds = adjustments.map((a: any) => a.id);
    const vouchers = await prisma.voucher.findMany({
      where: {
        id: { in: adjustments.map((a: any) => a.voucherId).filter(Boolean) },
      },
      select: {
        id: true,
        voucherNumber: true,
        status: true,
      },
    });
    const voucherMap = new Map(vouchers.map(v => [v.id, v]));

    res.json({
      data: adjustments.map((a: any) => {
        const voucher = a.voucherId ? voucherMap.get(a.voucherId) : null;
        return {
          id: a.id,
          date: a.date,
          subject: a.subject,
          store_id: a.storeId,
          store_name: a.store?.name || null,
          add_inventory: a.addInventory,
          notes: a.notes,
          total_amount: a.totalAmount,
          status: a.status,
          voucher_id: a.voucherId,
          voucher_number: voucher?.voucherNumber || null,
          voucher_status: voucher?.status || null,
          items: a.items.map((item: any) => ({
            id: item.id,
          part_id: item.partId,
          part_no: item.part.partNo,
          part_description: item.part.description,
          brand: item.part.brand?.name || '',
          category: item.part.category?.name || '',
          quantity: item.quantity,
          cost: item.cost,
          notes: item.notes,
          rack_id: item.rackId,
          rack_code: item.rack?.codeNo || null,
          shelf_id: item.shelfId,
          shelf_no: item.shelf?.shelfNo || null,
        })),
        items_count: a.items.length,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single adjustment
router.get('/adjustments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const adjustment = await prisma.adjustment.findUnique({
      where: { id },
      include: {
        store: true,
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    }) as any;

    if (!adjustment) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    // Fetch voucher separately
    const voucher = adjustment.voucherId ? await prisma.voucher.findUnique({
      where: { id: adjustment.voucherId },
      select: {
        id: true,
        voucherNumber: true,
        status: true,
      },
    }) : null;

    res.json({
      id: adjustment.id,
      date: adjustment.date,
      subject: adjustment.subject,
      store_id: adjustment.storeId,
      store_name: adjustment.store?.name || null,
      add_inventory: adjustment.addInventory,
      notes: adjustment.notes,
      total_amount: adjustment.totalAmount,
      status: adjustment.status,
      voucher_id: adjustment.voucherId,
      voucher_number: voucher?.voucherNumber || null,
      voucher_status: voucher?.status || null,
      items: adjustment.items.map((item: any) => ({
        id: item.id,
        part_id: item.partId,
        part_no: item.part.partNo,
        part_description: item.part.description,
        brand: item.part.brand?.name || '',
        category: item.part.category?.name || '',
        quantity: item.quantity,
        cost: item.cost,
        notes: item.notes,
        rack_id: item.rackId,
        rack_code: item.rack?.codeNo || null,
        shelf_id: item.shelfId,
        shelf_no: item.shelf?.shelfNo || null,
      })),
      created_at: adjustment.createdAt,
      updated_at: adjustment.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update adjustment
router.put('/adjustments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, subject, store_id, add_inventory, notes, items } = req.body;

    // Check if adjustment exists
    const existingAdjustment = await prisma.adjustment.findUnique({ where: { id } });
    if (!existingAdjustment) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    // Calculate total amount
    const totalAmount = items ? items.reduce((sum: number, item: any) => {
      const cost = item.cost || 0;
      const qty = item.quantity || 0;
      return sum + (cost * qty);
    }, 0) : existingAdjustment.totalAmount;

    // Delete existing stock movements for this adjustment
    await prisma.stockMovement.deleteMany({
      where: {
        referenceType: 'adjustment',
        referenceId: id,
      },
    });

    // Update adjustment
    const adjustment = await prisma.adjustment.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(subject !== undefined && { subject: subject || null }),
        ...(store_id !== undefined && { storeId: store_id || null }),
        ...(add_inventory !== undefined && { addInventory: add_inventory }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              partId: item.part_id,
              quantity: item.quantity,
              cost: item.cost || null,
              notes: item.notes || null,
            })),
          },
        }),
      } as any,
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    }) as any;

    // Create new stock movements for adjustment
    if (items) {
      for (const item of items) {
        await prisma.stockMovement.create({
          data: {
            partId: item.part_id,
            type: add_inventory !== false ? 'in' : 'out',
            quantity: item.quantity,
            storeId: store_id || null,
            referenceType: 'adjustment',
            referenceId: adjustment.id,
            notes: `Adjustment: ${subject || 'Stock adjustment'}`,
          },
        });
      }
    }

    res.json({
      id: adjustment.id,
      date: adjustment.date,
      subject: adjustment.subject,
      total_amount: adjustment.totalAmount,
      items_count: adjustment.items.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve adjustment (assign rack/shelf and approve)
router.put('/adjustments/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // Array of { id, rack_id?, shelf_id? }

    // Fetch adjustment with voucher and items
    const adjustment = await prisma.adjustment.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        store: true,
      },
    }) as any;

    // Fetch voucher separately
    const voucher = adjustment?.voucherId ? await prisma.voucher.findUnique({
      where: { id: adjustment.voucherId },
      include: {
        entries: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    }) : null;

    if (adjustment) {
      adjustment.voucher = voucher;
    }

    if (!adjustment) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    if (adjustment.status === 'approved') {
      return res.status(400).json({ error: 'Adjustment is already approved' });
    }

    if (!adjustment.voucher) {
      return res.status(400).json({ error: 'Voucher not found for this adjustment' });
    }

    // Update adjustment items with rack/shelf assignments
    if (items && Array.isArray(items)) {
      for (const itemUpdate of items) {
        await prisma.adjustmentItem.update({
          where: { id: itemUpdate.id },
          data: {
            rackId: itemUpdate.rack_id || null,
            shelfId: itemUpdate.shelf_id || null,
          } as any,
        });
      }
    }

    // Create stock movements with rack/shelf
    for (const item of adjustment.items) {
      // Find the rack/shelf from the update request
      const itemUpdate = items?.find((i: any) => i.id === item.id);
      
      await prisma.stockMovement.create({
        data: {
          partId: item.partId,
          type: adjustment.addInventory ? 'in' : 'out',
          quantity: item.quantity,
          storeId: adjustment.storeId || null,
          rackId: itemUpdate?.rack_id || null,
          shelfId: itemUpdate?.shelf_id || null,
          referenceType: 'adjustment',
          referenceId: adjustment.id,
          notes: `Adjustment: ${adjustment.subject || 'Stock adjustment'}`,
        },
      });
    }

    // Voucher is already posted when adjustment is created, so just fetch it
    // Only update if it's still in draft status (backward compatibility)
    let updatedVoucher;
    if (adjustment.voucher && adjustment.voucher.status === 'draft') {
      // Legacy: If voucher is still draft, post it now
      updatedVoucher = await prisma.voucher.update({
        where: { id: adjustment.voucherId! },
        data: {
          status: 'posted',
          approvedBy: 'Store Manager',
          approvedAt: new Date(),
        },
        include: {
          entries: {
            include: {
              account: {
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Update account balances only if voucher was just posted
      for (const entry of updatedVoucher.entries) {
        if (!entry.accountId || !entry.account) {
          continue;
        }

        const accountType = entry.account.subgroup.mainGroup.type.toLowerCase();
        const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
          ? (entry.debit - entry.credit)
          : (entry.credit - entry.debit);

        await prisma.account.update({
          where: { id: entry.accountId },
          data: {
            currentBalance: {
              increment: balanceChange,
            },
          },
        });
      }
    } else {
      // Voucher is already posted, just fetch it
      updatedVoucher = await prisma.voucher.findUnique({
        where: { id: adjustment.voucherId! },
        include: {
          entries: {
            include: {
              account: {
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    // Update adjustment status to approved
    const updatedAdjustment = await prisma.adjustment.update({
      where: { id },
      data: {
        status: 'approved',
      } as any,
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    }) as any;

    // Fetch voucher separately
    const updatedVoucherInfo = updatedAdjustment.voucherId ? await prisma.voucher.findUnique({
      where: { id: updatedAdjustment.voucherId },
      select: {
        id: true,
        voucherNumber: true,
        status: true,
      },
    }) : null;

    updatedAdjustment.voucher = updatedVoucherInfo;

    res.json({
      id: updatedAdjustment.id,
      date: updatedAdjustment.date,
      subject: updatedAdjustment.subject,
      total_amount: updatedAdjustment.totalAmount,
      status: updatedAdjustment.status,
      voucher_id: updatedAdjustment.voucherId,
      voucher_number: updatedAdjustment.voucher?.voucherNumber || null,
      voucher_status: updatedAdjustment.voucher?.status || null,
      items: (updatedAdjustment.items || []).map((item: any) => ({
        id: item.id,
        part_id: item.partId,
        part_no: item.part.partNo,
        quantity: item.quantity,
        cost: item.cost,
        rack_id: item.rackId,
        rack_code: item.rack?.codeNo || null,
        shelf_id: item.shelfId,
        shelf_no: item.shelf?.shelfNo || null,
      })),
      items_count: updatedAdjustment.items.length,
      message: 'Adjustment approved successfully. Voucher auto-approved and accounts updated.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete adjustment
router.delete('/adjustments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const adjustment = await prisma.adjustment.findUnique({ where: { id } });
    if (!adjustment) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    // Delete associated stock movements
    await prisma.stockMovement.deleteMany({
      where: {
        referenceType: 'adjustment',
        referenceId: id,
      },
    });

    // Delete adjustment (items will be deleted via cascade)
    await prisma.adjustment.delete({ where: { id } });

    res.json({ message: 'Adjustment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get purchase orders
router.get('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    if (from_date || to_date) {
      where.date = {};
      if (from_date) {
        where.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.date.lte = new Date(to_date as string);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          items: {
            include: {
              part: {
                include: {
                  brand: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Sort by creation date, newest first
        },
        skip,
        take: limitNum,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    // Fetch suppliers for orders that have supplierId
    const supplierIds = orders.filter(po => po.supplierId).map(po => po.supplierId);
    const suppliers = supplierIds.length > 0 
      ? await prisma.supplier.findMany({
          where: { id: { in: supplierIds as string[] } },
        })
      : [];
    const supplierMap = new Map(suppliers.map(s => [s.id, s.companyName || s.name || 'N/A']));

    res.json({
      data: orders.map(po => ({
        id: po.id,
        po_number: po.poNumber,
        date: po.date,
        supplier_id: po.supplierId,
        supplier_name: po.supplierId ? supplierMap.get(po.supplierId) || 'N/A' : 'N/A',
        status: po.status,
        expected_date: po.expectedDate,
        notes: po.notes,
        total_amount: po.totalAmount,
        items_count: po.items.length,
        items: po.items.map(item => ({
          id: item.id,
          part_id: item.partId,
          part_no: item.part.partNo,
          part_description: item.part.description,
          brand: item.part.brand?.name || '',
          quantity: item.quantity,
          unit_cost: item.unitCost,
          total_cost: item.totalCost,
          received_qty: item.receivedQty,
          notes: item.notes,
        })),
        created_at: po.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get purchase orders by part ID
router.get('/purchase-orders/by-part/:partId', async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Find all purchase order items for this part
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { partId },
      include: {
        purchaseOrder: {
          include: {
            items: {
              include: {
                part: {
                  include: {
                    brand: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        purchaseOrder: {
          createdAt: 'desc',
        },
      },
      skip,
      take: limitNum,
    });

    // Get unique purchase orders and their suppliers
    const uniquePOIds = [...new Set(poItems.map(item => item.purchaseOrderId))];
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { id: { in: uniquePOIds } },
      include: {
        items: {
          where: { partId },
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    // Fetch suppliers
    const supplierIds = purchaseOrders.filter(po => po.supplierId).map(po => po.supplierId);
    const suppliers = supplierIds.length > 0 
      ? await prisma.supplier.findMany({
          where: { id: { in: supplierIds as string[] } },
        })
      : [];
    const supplierMap = new Map(suppliers.map(s => [s.id, s.companyName || s.name || 'N/A']));

    // Format response with purchase order details and the specific item for this part
    const result = purchaseOrders.map(po => {
      const itemForPart = po.items.find(item => item.partId === partId);
      return {
        id: po.id,
        po_number: po.poNumber,
        date: po.date,
        supplier_id: po.supplierId,
        supplier_name: po.supplierId ? supplierMap.get(po.supplierId) || 'N/A' : 'N/A',
        status: po.status,
        expected_date: po.expectedDate,
        notes: po.notes,
        total_amount: po.totalAmount,
        item: itemForPart ? {
          id: itemForPart.id,
          part_id: itemForPart.partId,
          part_no: itemForPart.part.partNo,
          part_description: itemForPart.part.description,
          brand: itemForPart.part.brand?.name || '',
          quantity: itemForPart.quantity,
          unit_cost: itemForPart.unitCost,
          total_cost: itemForPart.totalCost,
          received_qty: itemForPart.receivedQty,
          notes: itemForPart.notes,
        } : null,
        created_at: po.createdAt,
      };
    }).filter(po => po.item !== null); // Only return POs that have items for this part

    const total = await prisma.purchaseOrderItem.count({
      where: { partId },
    });

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
    res.status(500).json({ error: error.message });
  }
});

// Generate next PO number
async function generatePoNumber(): Promise<string> {
  try {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}${month}-`;
    
    // Find all PO numbers for current month
    const existingOrders = await prisma.purchaseOrder.findMany({
      where: {
        poNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        poNumber: 'desc',
      },
    });
    
    // Extract numbers and find max
    const numbers = existingOrders
      .map(order => {
        const match = order.poNumber.match(new RegExp(`^${prefix}(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  } catch (error) {
    // Fallback
    const year = String(new Date().getFullYear()).slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-3);
    return `PO-${year}${month}-${timestamp}`;
  }
}

// Create purchase order
router.post('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { po_number, date, supplier_id, expected_date, notes, items } = req.body;

    if (!date || !items || items.length === 0) {
      return res.status(400).json({ error: 'date and items are required' });
    }

    // Auto-generate PO number if not provided or if it already exists
    let poNumber = po_number;
    if (!poNumber || poNumber.trim() === '') {
      poNumber = await generatePoNumber();
    } else {
      // Check if PO number already exists
      const existing = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poNumber.trim() },
      });
      if (existing) {
        // Generate a new one if it exists
        poNumber = await generatePoNumber();
      }
    }

    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + (item.total_cost || (item.unit_cost * item.quantity));
    }, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        poNumber: poNumber.trim(),
        date: new Date(date),
        supplierId: supplier_id || null,
        expectedDate: expected_date ? new Date(expected_date) : null,
        notes: notes || null,
        totalAmount: totalAmount,
        status: 'Draft',
        items: {
          create: items.map((item: any) => ({
            partId: item.part_id,
            quantity: item.quantity,
            unitCost: item.unit_cost,
            totalCost: item.total_cost || (item.unit_cost * item.quantity),
            receivedQty: item.received_qty || 0,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    res.status(201).json({
      id: order.id,
      po_number: order.poNumber,
      date: order.date,
      status: order.status,
      total_amount: order.totalAmount,
      items_count: order.items.length,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Unique constraint violation - try to generate a new PO number
      try {
        const { date, supplier_id, expected_date, notes, items } = req.body;
        const poNumber = await generatePoNumber();
        const totalAmount = items.reduce((sum: number, item: any) => {
          return sum + (item.total_cost || (item.unit_cost * item.quantity));
        }, 0);

        const order = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            date: new Date(date),
            supplierId: supplier_id || null,
            expectedDate: expected_date ? new Date(expected_date) : null,
            notes: notes || null,
            totalAmount: totalAmount,
            status: 'Draft',
            items: {
              create: items.map((item: any) => ({
                partId: item.part_id,
                quantity: item.quantity,
                unitCost: item.unit_cost,
                totalCost: item.total_cost || (item.unit_cost * item.quantity),
                receivedQty: item.received_qty || 0,
                notes: item.notes || null,
              })),
            },
          },
          include: {
            items: {
              include: {
                part: true,
              },
            },
          },
        });

        return res.status(201).json({
          id: order.id,
          po_number: order.poNumber,
          date: order.date,
          status: order.status,
          total_amount: order.totalAmount,
          items_count: order.items.length,
        });
      } catch (retryError: any) {
        return res.status(500).json({ error: 'Failed to create purchase order. Please try again.' });
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Get single purchase order
router.get('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Fetch supplier if supplierId exists
    let supplierName = 'N/A';
    if (order.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: order.supplierId },
      });
      supplierName = supplier ? (supplier.companyName || supplier.name || 'N/A') : 'N/A';
    }

    res.json({
      id: order.id,
      po_number: order.poNumber,
      date: order.date,
      supplier_id: order.supplierId,
      supplier_name: supplierName,
      status: order.status,
      expected_date: order.expectedDate,
      notes: order.notes,
      total_amount: order.totalAmount,
      items: order.items.map(item => ({
        id: item.id,
        part_id: item.partId,
        part_no: item.part.partNo,
        part_description: item.part.description,
        brand: item.part.brand?.name || '',
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        received_qty: item.receivedQty,
        notes: item.notes,
      })),
      created_at: order.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update purchase order
router.put('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { po_number, date, supplier_id, expected_date, notes, status, items, expenses } = req.body;

    const existingOrder = await prisma.purchaseOrder.findUnique({ 
      where: { id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });
    if (!existingOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Calculate total amount from received items
    const receivedItems = items ? items.filter((item: any) => item.received_qty > 0) : existingOrder.items.filter(item => item.receivedQty > 0);
    const totalAmount = receivedItems.reduce((sum: number, item: any) => {
      if (items) {
        return sum + (item.total_cost || (item.unit_cost * item.received_qty));
      } else {
        return sum + (item.totalCost || (item.unitCost * item.receivedQty));
      }
    }, 0);

    // Calculate total expenses if provided
    const totalExpenses = expenses ? expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) : 0;
    const grandTotal = totalAmount + totalExpenses;

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(po_number && { poNumber: po_number }),
        ...(date && { date: new Date(date) }),
        ...(supplier_id !== undefined && { supplierId: supplier_id || null }),
        ...(expected_date && { expectedDate: new Date(expected_date) }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status && { status }),
        ...(totalAmount !== undefined && { totalAmount: grandTotal }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              partId: item.part_id,
              quantity: item.quantity,
              unitCost: item.unit_cost,
              totalCost: item.total_cost || (item.unit_cost * item.quantity),
              receivedQty: item.received_qty || 0,
              notes: item.notes || null,
            })),
          },
        }),
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    // Recalculate grandTotal from updated order items (in case items were updated)
    const updatedReceivedItems = order.items.filter(item => item.receivedQty > 0);
    const updatedTotalAmount = updatedReceivedItems.reduce((sum: number, item: any) => {
      return sum + (item.totalCost || (item.unitCost * item.receivedQty));
    }, 0);
    const updatedGrandTotal = updatedTotalAmount + totalExpenses;

    // Create stock movements when order is received
    if (status === 'Received' && existingOrder.status !== 'Received') {
      const { store_id } = req.body;
      try {
        // Create stock movements for all received items
        for (const item of order.items) {
          if (item.receivedQty > 0) {
            // Check if stock movement already exists for this PO and item
            const existingMovement = await prisma.stockMovement.findFirst({
              where: {
                referenceType: 'purchase',
                referenceId: order.id,
                partId: item.partId,
              },
            });

            // Only create if movement doesn't exist
            if (!existingMovement) {
              await prisma.stockMovement.create({
                data: {
                  partId: item.partId,
                  type: 'in',
                  quantity: item.receivedQty,
                  storeId: store_id || null,
                  referenceType: 'purchase',
                  referenceId: order.id,
                  notes: `Purchase Order ${order.poNumber} - Received`,
                },
              });
            }
          }
        }
        
        // Clear reserved stock when order is received
        // Delete stockReservation records for all parts in this order
        try {
          const deletedReservations = await prisma.stockReservation.deleteMany({
            where: {
              partId: {
                in: order.items.map(item => item.partId),
              },
              status: 'reserved',
            },
          });
          if (deletedReservations.count > 0) {
          }
        } catch (reservationError: any) {
          // Don't fail the purchase order update if reservation clearing fails
        }
      } catch (stockError: any) {
        // Don't fail the purchase order update if stock movement creation fails
      }
    }

    // Create journal entry when order is received
    if (status === 'Received' && existingOrder.status !== 'Received' && updatedGrandTotal > 0) {
      try {
        // Check if journal entry already exists for this PO
        const existingJournal = await prisma.journalEntry.findFirst({
          where: {
            reference: `PO-${order.poNumber}`,
          },
        });

        if (!existingJournal) {
          // Get supplier name and account
          let supplierName = 'Supplier';
          let supplierAccount = null;
          if (order.supplierId) {
            const supplier = await prisma.supplier.findUnique({
              where: { id: order.supplierId },
            });
            if (supplier) {
              supplierName = supplier.companyName || supplier.name || 'Supplier';
              // Find supplier account by name (format: "Name" or "Company Name")
              supplierAccount = await prisma.account.findFirst({
                where: {
                  AND: [
                    { code: { startsWith: '301' } },
                    {
                      OR: [
                        { name: supplier.name || '' },
                        { name: supplier.companyName },
                      ],
                    },
                  ],
                },
              });
            }
          }

          // Find Inventory account (101001-Inventory)
          const inventoryAccount = await prisma.account.findFirst({
            where: {
              OR: [
                { code: '101001' }, // Inventory
                { code: '104005' }, // Inventory - General (fallback)
                { code: '104001' }, // Raw Materials (fallback)
              ],
            },
          });

          // If supplier account not found, create it
          if (!supplierAccount && order.supplierId) {
            const supplier = await prisma.supplier.findUnique({
              where: { id: order.supplierId },
            });
            if (supplier) {
              const payablesSubgroup = await prisma.subgroup.findFirst({
                where: { code: '301' },
              });
              if (payablesSubgroup) {
                const existingAccounts = await prisma.account.findMany({
                  where: { code: { startsWith: '301' } },
                  orderBy: { code: 'desc' },
                });
                let accountCode = '301001';
                if (existingAccounts.length > 0) {
                  const lastCode = existingAccounts[0].code;
                  const match = lastCode.match(/^301(\d+)$/);
                  if (match) {
                    const lastNum = parseInt(match[1], 10);
                    const nextNum = lastNum + 1;
                    accountCode = `301${String(nextNum).padStart(3, '0')}`;
                  }
                }
                supplierAccount = await prisma.account.create({
                  data: {
                    subgroupId: payablesSubgroup.id,
                    code: accountCode,
                    name: `${supplier.name || supplier.companyName}`,
                    description: `Supplier Account: ${supplier.companyName}`,
                    openingBalance: 0,
                    currentBalance: 0,
                    status: 'Active',
                    canDelete: false,
                  },
                });
              }
            }
          }

          // Fallback to generic Accounts Payable if no supplier account
          if (!supplierAccount) {
            supplierAccount = await prisma.account.findFirst({
              where: { code: '301001' },
            });
          }

          if (inventoryAccount && supplierAccount) {
            // Generate journal entry number (format: JV4705)
            const count = await prisma.journalEntry.count();
            const entryNo = `JV${String(count + 1).padStart(4, '0')}`;

            // Create journal entry lines
            const journalLines: any[] = [];

            // Debit: Inventory account
            const inventoryDescription = order.items
              .filter((item: any) => item.receivedQty > 0)
              .map((item: any) => {
                const partName = item.part?.partNo || 'Item';
                return `PO: ${order.poNumber} Inventory Added ,${partName}/, Qty ${item.receivedQty}, Rate ${item.unitCost}, Cost: ${item.totalCost}`;
              }).join('; ') || `PO: ${order.poNumber} Inventory Added`;

            journalLines.push({
              accountId: inventoryAccount.id,
              description: inventoryDescription,
              debit: updatedTotalAmount,
              credit: 0,
              lineOrder: 0,
            });

            // Debit: Expense accounts (if any)
            if (expenses && expenses.length > 0) {
              for (let i = 0; i < expenses.length; i++) {
                const exp = expenses[i];
                if (exp.amount > 0 && exp.payableAccount) {
                  // Find expense account by name or code (302009 for purchase expenses)
                  let expenseAccount = await prisma.account.findFirst({
                    where: {
                      OR: [
                        { code: '302009' }, // Purchase expenses payables
                        { name: { contains: exp.payableAccount } },
                        { code: exp.payableAccount },
                      ],
                    },
                  });

                  // If not found, try to find in 302 subgroup
                  if (!expenseAccount) {
                    const expenseSubgroup = await prisma.subgroup.findFirst({
                      where: { code: '302' },
                    });
                    if (expenseSubgroup) {
                      expenseAccount = await prisma.account.findFirst({
                        where: {
                          subgroupId: expenseSubgroup.id,
                          name: { contains: exp.payableAccount },
                        },
                      });
                    }
                  }

                  if (expenseAccount) {
                    journalLines.push({
                      accountId: expenseAccount.id,
                      description: exp.type || `Expense for PO ${order.poNumber}`,
                      debit: exp.amount,
                      credit: 0,
                      lineOrder: journalLines.length,
                    });
                  }
                }
              }
            }

            // Credit: Supplier Account
            journalLines.push({
              accountId: supplierAccount.id,
              description: `PO: ${order.poNumber} ${supplierName} Liability Created`,
              debit: 0,
              credit: updatedGrandTotal,
              lineOrder: journalLines.length,
            });

            // Create journal entry
            const journalEntry = await prisma.journalEntry.create({
              data: {
                entryNo,
                entryDate: order.date,
                reference: `PO-${order.poNumber}`,
                description: `Purchase Order ${order.poNumber} received from ${supplierName}`,
                totalDebit: updatedGrandTotal,
                totalCredit: updatedGrandTotal,
                status: 'posted', // Auto-post the entry
                createdBy: 'System',
                postedBy: 'System',
                postedAt: new Date(),
                lines: {
                  create: journalLines,
                },
              },
            });

            // Create Voucher automatically when PO is received
            try {
              
              // Generate voucher number (format: JV4707)
              // Get the highest journal voucher number
              const lastVoucher = await prisma.voucher.findFirst({
                where: {
                  type: 'journal',
                  voucherNumber: {
                    startsWith: 'JV',
                  },
                },
                orderBy: {
                  voucherNumber: 'desc',
                },
              });

              let nextNumber = 1;
              if (lastVoucher) {
                // Extract number from voucher number (e.g., "JV4707" -> 4707)
                const match = lastVoucher.voucherNumber.match(/^JV(\d+)$/);
                if (match) {
                  nextNumber = parseInt(match[1]) + 1;
                } else {
                  // Fallback: count all journal vouchers
                  const voucherCount = await prisma.voucher.count({
                    where: { type: 'journal' },
                  });
                  nextNumber = voucherCount + 1;
                }
              }
              const voucherNumber = `JV${String(nextNumber).padStart(4, '0')}`;

              // Get account details for voucher entries
              const voucherEntries = [];
              for (const line of journalLines) {
                const account = await prisma.account.findUnique({
                  where: { id: line.accountId },
                  select: { code: true, name: true },
                });

                voucherEntries.push({
                  accountId: line.accountId,
                  accountName: account ? `${account.code}-${account.name}` : 'Account',
                  description: line.description || `Purchase Order ${order.poNumber}`,
                  debit: line.debit,
                  credit: line.credit,
                  sortOrder: line.lineOrder,
                });
              }

              // Extract PO number for narration (e.g., "PO-15" -> "15", "PO-DEMO-001" -> extract number)
              let poNumberDisplay = order.poNumber;
              // Try to extract just the number part if it exists
              const poNumberMatch = order.poNumber.match(/PO-.*?(\d+)$/);
              if (poNumberMatch) {
                poNumberDisplay = poNumberMatch[1];
              } else {
                // Remove common prefixes
                poNumberDisplay = order.poNumber.replace(/^PO-?/i, '').replace(/^DEMO-?/i, '');
              }

              // Create voucher
              const voucher = await prisma.voucher.create({
                data: {
                  voucherNumber,
                  type: 'journal',
                  date: order.date,
                  narration: `Purchase Order Number: ${poNumberDisplay}`,
                  totalDebit: updatedGrandTotal,
                  totalCredit: updatedGrandTotal,
                  status: 'posted', // Auto-approve the voucher
                  createdBy: 'System',
                  approvedBy: 'System',
                  approvedAt: new Date(),
                  entries: {
                    create: voucherEntries,
                  },
                },
              });

            } catch (voucherError: any) {
              // Don't fail the purchase order update if voucher creation fails
            }

            // Update account balances
            for (const line of journalLines) {
              const account = await prisma.account.findUnique({
                where: { id: line.accountId },
                include: {
                  subgroup: {
                    include: { mainGroup: true },
                  },
                },
              });

              if (account) {
                const accountType = account.subgroup.mainGroup.type.toLowerCase();
                // Assets and Expenses: increase with debit, decrease with credit
                // Liabilities, Equity, Revenue: increase with credit, decrease with debit
                const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
                  ? (line.debit - line.credit)
                  : (line.credit - line.debit);

                await prisma.account.update({
                  where: { id: line.accountId },
                  data: {
                    currentBalance: {
                      increment: balanceChange,
                    },
                  },
                });
              }
            }

          } else {
          }
        }
      } catch (journalError: any) {
        // Don't fail the purchase order update if journal entry creation fails
      }
    }

    res.json({
      id: order.id,
      po_number: order.poNumber,
      date: order.date,
      status: order.status,
      total_amount: order.totalAmount,
      items_count: order.items.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete purchase order - Comprehensive deletion that removes all related data
router.delete('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find the purchase order with all related data
    const order = await prisma.purchaseOrder.findUnique({ 
      where: { id },
      include: {
        items: true,
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Step 1: Delete stock movements related to this PO
    // Check multiple ways to find related stock movements:
    // 1. By referenceType='purchase' and referenceId=PO id
    // 2. By PO number in notes field
    // 3. Case-insensitive matching for referenceType
    const stockMovementsToDelete = await prisma.stockMovement.findMany({
      where: {
        OR: [
          {
            AND: [
              { referenceType: { in: ['purchase', 'Purchase', 'PURCHASE'] } },
              { referenceId: id },
            ],
          },
          {
            notes: {
              contains: order.poNumber,
            },
          },
          {
            notes: {
              contains: `PO-${order.poNumber}`,
            },
          },
        ],
      },
    });

    // Delete the stock movements - use the same comprehensive query
    const deletedStockMovements = await prisma.stockMovement.deleteMany({
      where: {
        OR: [
          {
            AND: [
              { referenceType: { in: ['purchase', 'Purchase', 'PURCHASE'] } },
              { referenceId: id },
            ],
          },
          {
            notes: {
              contains: order.poNumber,
            },
          },
          {
            notes: {
              contains: `PO-${order.poNumber}`,
            },
          },
        ],
      },
    });
    
    // If we found movements but didn't delete them, log a warning
    if (stockMovementsToDelete.length > 0 && deletedStockMovements.count === 0) {
    }

    // Step 2: Find and reverse journal entries related to this PO
    // Search by multiple criteria to catch all related entries:
    // Handle variations: "PO-{poNumber}", "PO-PO-{poNumber}", or just "{poNumber}" in reference/description
    const poNumberVariations = [
      order.poNumber,                                    // "PO-API-TEST-001"
      `PO-${order.poNumber}`,                            // "PO-PO-API-TEST-001"
      `PO-PO-${order.poNumber}`,                         // "PO-PO-PO-API-TEST-001" (if any)
    ];
    
    // Also extract just the number part for matching
    const poNumberMatch1 = order.poNumber.match(/(\d+)$/);
    if (poNumberMatch1) {
      poNumberVariations.push(poNumberMatch1[1]);          // "001" or "API-TEST-001" part
    }
    
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          // Match by reference field
          ...poNumberVariations.map(poVar => ({
            reference: { contains: poVar },
          })),
          // Match by description field
          ...poNumberVariations.map(poVar => ({
            description: { contains: poVar },
          })),
          // Also check journal lines descriptions
          {
            lines: {
              some: {
                OR: poNumberVariations.map(poVar => ({
                  description: { contains: poVar },
                })),
              },
            },
          },
        ],
      },
      include: {
        lines: {
          include: {
            account: {
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (journalEntries.length > 0) {
    }

    // Reverse account balances for each journal entry
    for (const entry of journalEntries) {
      if (entry.status === 'posted') {
        // Reverse the account balances
        for (const line of entry.lines) {
          const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
          // Calculate reverse balance change (opposite of what was done)
          const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
            ? (line.credit - line.debit)  // Reverse: credit - debit (opposite of debit - credit)
            : (line.debit - line.credit); // Reverse: debit - credit (opposite of credit - debit)

          await prisma.account.update({
            where: { id: line.accountId },
            data: {
              currentBalance: {
                increment: balanceChange,
              },
            },
          });
        }
      }
    }

    // Delete journal entries (lines will cascade)
    // Use the same comprehensive search criteria with all PO number variations
    const deletedJournalEntries = await prisma.journalEntry.deleteMany({
      where: {
        OR: [
          // Match by reference field
          ...poNumberVariations.map(poVar => ({
            reference: { contains: poVar },
          })),
          // Match by description field
          ...poNumberVariations.map(poVar => ({
            description: { contains: poVar },
          })),
          // Also check journal lines descriptions
          {
            lines: {
              some: {
                OR: poNumberVariations.map(poVar => ({
                  description: { contains: poVar },
                })),
              },
            },
          },
        ],
      },
    });
    
    // Verify deletion
    if (journalEntries.length > 0 && deletedJournalEntries.count === 0) {
    } else if (journalEntries.length !== deletedJournalEntries.count) {
    }

    // Step 3: Find and delete vouchers related to this PO
    // Search vouchers by narration containing PO number
    // Also check voucher entries' descriptions for PO references
    let poNumberForMatch = order.poNumber;
    const poNumberMatch2 = order.poNumber.match(/PO-.*?(\d+)$/);
    if (poNumberMatch2) {
      poNumberForMatch = poNumberMatch2[1];
    } else {
      poNumberForMatch = order.poNumber.replace(/^PO-?/i, '').replace(/^DEMO-?/i, '');
    }

    // Find vouchers by narration
    const vouchersByNarration = await prisma.voucher.findMany({
      where: {
        OR: [
          { narration: { contains: order.poNumber } },
          { narration: { contains: `PO-${order.poNumber}` } },
          { narration: { contains: poNumberForMatch } },
        ],
      },
    });

    // Also find vouchers by checking entries' descriptions
    const voucherEntriesWithPO = await prisma.voucherEntry.findMany({
      where: {
        OR: [
          { description: { contains: order.poNumber } },
          { description: { contains: `PO-${order.poNumber}` } },
        ],
      },
      select: { voucherId: true },
      distinct: ['voucherId'],
    });

    const voucherIdsFromEntries = voucherEntriesWithPO.map(e => e.voucherId);
    const allVoucherIds = [
      ...vouchersByNarration.map(v => v.id),
      ...voucherIdsFromEntries,
    ];
    const uniqueVoucherIds = [...new Set(allVoucherIds)];

    // Delete vouchers (entries will cascade)
    const deletedVouchers = await prisma.voucher.deleteMany({
      where: {
        OR: [
          { narration: { contains: order.poNumber } },
          { narration: { contains: `PO-${order.poNumber}` } },
          { narration: { contains: poNumberForMatch } },
          ...(uniqueVoucherIds.length > 0 ? [{ id: { in: uniqueVoucherIds } }] : []),
        ],
      },
    });

    // Step 4: Check if any sales invoices reference this PO
    // Note: Sales invoices don't have a notes field, so we skip this check
    // Sales invoices are linked through stock movements with reference_type='purchase' and reference_id=PO.id
    const salesInvoicesWithPO: any[] = [];

    if (salesInvoicesWithPO.length > 0) {
      salesInvoicesWithPO.forEach(inv => {
      });
      // Note: We don't delete sales invoices, just log a warning
    }

    // Step 5: Delete the purchase order (items will cascade delete)
    await prisma.purchaseOrder.delete({ where: { id } });

    res.json({ 
      message: 'Purchase order deleted successfully',
      details: {
        stockMovementsDeleted: deletedStockMovements.count,
        journalEntriesDeleted: deletedJournalEntries.count,
        vouchersDeleted: deletedVouchers.count,
        salesInvoicesReferenced: salesInvoicesWithPO.length,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get stores
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const stores = await prisma.store.findMany({
      where,
      include: {
        racks: {
          include: {
            shelves: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(stores.map(s => ({
      id: s.id,
      name: s.name,
      type: s.code, // Using code as type for now
      status: s.status,
      description: s.address || s.manager || '',
      code: s.code,
      address: s.address,
      phone: s.phone,
      manager: s.manager,
      racks: s.racks,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create store
router.post('/stores', async (req: Request, res: Response) => {
  try {
    const { name, type, status, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Generate code from name
    const code = name.toUpperCase().replace(/\s+/g, '-').substring(0, 20);

    const store = await prisma.store.create({
      data: {
        code,
        name,
        address: description || null,
        status: status || 'active',
      },
    });

    res.json({
      id: store.id,
      name: store.name,
      type: store.code,
      status: store.status,
      description: store.address || '',
      code: store.code,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update store
router.put('/stores/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, status, description } = req.body;

    const store = await prisma.store.update({
      where: { id },
      data: {
        name,
        code: type || undefined,
        address: description || null,
        status: status || 'active',
      },
    });

    res.json({
      id: store.id,
      name: store.name,
      type: store.code,
      status: store.status,
      description: store.address || '',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete store
router.delete('/stores/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete associated racks and shelves (cascade)
    await prisma.store.delete({
      where: { id },
    });

    res.json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get racks
router.get('/racks', async (req: Request, res: Response) => {
  try {
    const { store_id, status } = req.query;

    const where: any = {};
    if (store_id) {
      where.storeId = store_id as string;
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    const racks = await prisma.rack.findMany({
      where,
      include: {
        store: true,
        shelves: true,
      },
      orderBy: { codeNo: 'asc' },
    });

    res.json(racks.map(r => ({
      id: r.id,
      codeNo: r.codeNo,
      code_no: r.codeNo,
      storeId: r.storeId,
      store_id: r.storeId,
      store_name: r.store?.name || null,
      description: r.description,
      status: r.status,
      shelves: r.shelves.map(s => ({
        id: s.id,
        shelfNo: s.shelfNo,
        rackId: s.rackId,
        description: s.description,
        status: s.status,
      })),
      shelves_count: r.shelves.length,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create rack
router.post('/racks', async (req: Request, res: Response) => {
  try {
    const { codeNo, storeId, description, status } = req.body;

    if (!codeNo || !storeId) {
      return res.status(400).json({ error: 'Code and store ID are required' });
    }

    const rack = await prisma.rack.create({
      data: {
        codeNo,
        storeId,
        description: description || null,
        status: status || 'Active',
      },
      include: {
        shelves: true,
      },
    });

    res.json({
      id: rack.id,
      codeNo: rack.codeNo,
      storeId: rack.storeId,
      description: rack.description,
      status: rack.status,
      shelves: rack.shelves,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update rack
router.put('/racks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { codeNo, description, status } = req.body;

    const rack = await prisma.rack.update({
      where: { id },
      data: {
        codeNo,
        description: description || null,
        status: status || 'Active',
      },
      include: {
        shelves: true,
      },
    });

    res.json({
      id: rack.id,
      codeNo: rack.codeNo,
      storeId: rack.storeId,
      description: rack.description,
      status: rack.status,
      shelves: rack.shelves,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete rack
router.delete('/racks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.rack.delete({
      where: { id },
    });

    res.json({ message: 'Rack deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get shelves
router.get('/shelves', async (req: Request, res: Response) => {
  try {
    const { rack_id, status } = req.query;

    const where: any = {};
    if (rack_id) {
      where.rackId = rack_id as string;
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    const shelves = await prisma.shelf.findMany({
      where,
      include: {
        rack: {
          include: {
            store: true,
          },
        },
      },
      orderBy: { shelfNo: 'asc' },
    });

    res.json(shelves.map(s => ({
      id: s.id,
      shelfNo: s.shelfNo,
      shelf_no: s.shelfNo,
      rackId: s.rackId,
      rack_id: s.rackId,
      rack_code: s.rack.codeNo,
      store_id: s.rack.storeId,
      store_name: s.rack.store?.name || null,
      description: s.description,
      status: s.status,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create shelf
router.post('/shelves', async (req: Request, res: Response) => {
  try {
    const { shelfNo, rackId, description, status } = req.body;

    if (!shelfNo || !rackId) {
      return res.status(400).json({ error: 'Shelf number and rack ID are required' });
    }

    const shelf = await prisma.shelf.create({
      data: {
        shelfNo,
        rackId,
        description: description || null,
        status: status || 'Active',
      },
    });

    res.json({
      id: shelf.id,
      shelfNo: shelf.shelfNo,
      rackId: shelf.rackId,
      description: shelf.description,
      status: shelf.status,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update shelf
router.put('/shelves/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shelfNo, description, status } = req.body;

    const shelf = await prisma.shelf.update({
      where: { id },
      data: {
        shelfNo,
        description: description || null,
        status: status || 'Active',
      },
    });

    res.json({
      id: shelf.id,
      shelfNo: shelf.shelfNo,
      rackId: shelf.rackId,
      description: shelf.description,
      status: shelf.status,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete shelf
router.delete('/shelves/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.shelf.delete({
      where: { id },
    });

    res.json({ message: 'Shelf deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-dimensional stock report
router.get('/multi-dimensional-report', async (req: Request, res: Response) => {
  try {
    const {
      primary_dimension,
      secondary_dimension,
      tertiary_dimension,
      category_filter,
      brand_filter,
      sort_by,
      sort_direction = 'desc',
    } = req.query;

    if (!primary_dimension) {
      return res.status(400).json({ error: 'primary_dimension is required' });
    }

    // Build where clause for parts
    const where: any = { status: 'active' };

    // Apply category filter
    if (category_filter && category_filter !== 'All Categories') {
      const categoryRecord = await prisma.category.findFirst({
        where: { name: category_filter as string },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    // Apply brand filter
    if (brand_filter && brand_filter !== 'All Brands') {
      const brandRecord = await prisma.brand.findFirst({
        where: { name: brand_filter as string },
      });
      if (brandRecord) {
        where.brandId = brandRecord.id;
      }
    }

    // Get all parts with related data
    const parts = await prisma.part.findMany({
      where,
      include: {
        brand: true,
        category: true,
        stockMovements: {
          include: {
            store: true,
          },
        },
      },
    });

    // Calculate stock for each part
    const partStockMap: Record<string, {
      quantity: number;
      cost: number;
      value: number;
      category: string;
      brand: string;
      store: string;
      location: string;
      uom: string;
    }> = {};

    for (const part of parts) {
      const stockIn = part.stockMovements
        .filter(m => m.type === 'in')
        .reduce((sum, m) => sum + m.quantity, 0);
      const stockOut = part.stockMovements
        .filter(m => m.type === 'out')
        .reduce((sum, m) => sum + m.quantity, 0);
      const quantity = stockIn - stockOut;

      if (quantity > 0) {
        const cost = part.cost || 0;
        const value = cost * quantity;
        const category = part.category?.name || 'Uncategorized';
        const brand = part.brand?.name || 'No Brand';
        
        // Group by store if needed
        const movementsByStore: Record<string, { in: number; out: number }> = {};
        for (const movement of part.stockMovements) {
          const storeKey = movement.store?.name || 'No Store';
          if (!movementsByStore[storeKey]) {
            movementsByStore[storeKey] = { in: 0, out: 0 };
          }
          if (movement.type === 'in') {
            movementsByStore[storeKey].in += movement.quantity;
          } else {
            movementsByStore[storeKey].out += movement.quantity;
          }
        }

        // If grouping by store, create separate entries
        if (primary_dimension === 'Store' || secondary_dimension === 'Store' || tertiary_dimension === 'Store') {
          for (const [storeName, storeStock] of Object.entries(movementsByStore)) {
            const storeQty = storeStock.in - storeStock.out;
            if (storeQty > 0) {
              const key = `${part.id}_${storeName}`;
              partStockMap[key] = {
                quantity: storeQty,
                cost,
                value: cost * storeQty,
                category,
                brand,
                store: storeName,
                location: '-',
                uom: part.uom || 'pcs',
              };
            }
          }
        } else {
          // Single entry per part
          partStockMap[part.id] = {
            quantity,
            cost,
            value,
            category,
            brand,
            store: 'All Stores',
            location: '-',
            uom: part.uom || 'pcs',
          };
        }
      }
    }

    // Group by dimensions
    const dimensionGroups: Record<string, {
      items: Set<string>;
      quantity: number;
      value: number;
      costs: number[];
    }> = {};

    for (const [partKey, stockData] of Object.entries(partStockMap)) {
      const dimensionKeys: string[] = [];

      // Primary dimension
      if (primary_dimension === 'Category') {
        dimensionKeys.push(stockData.category);
      } else if (primary_dimension === 'Brand') {
        dimensionKeys.push(stockData.brand);
      } else if (primary_dimension === 'Store') {
        dimensionKeys.push(stockData.store);
      } else if (primary_dimension === 'Location') {
        dimensionKeys.push(stockData.location);
      } else if (primary_dimension === 'UOM') {
        dimensionKeys.push(stockData.uom);
      }

      // Secondary dimension
      if (secondary_dimension && secondary_dimension !== 'none') {
        if (secondary_dimension === 'Category') {
          dimensionKeys.push(stockData.category);
        } else if (secondary_dimension === 'Brand') {
          dimensionKeys.push(stockData.brand);
        } else if (secondary_dimension === 'Store') {
          dimensionKeys.push(stockData.store);
        } else if (secondary_dimension === 'Location') {
          dimensionKeys.push(stockData.location);
        } else if (secondary_dimension === 'UOM') {
          dimensionKeys.push(stockData.uom);
        }
      }

      // Tertiary dimension
      if (tertiary_dimension && tertiary_dimension !== 'none') {
        if (tertiary_dimension === 'Category') {
          dimensionKeys.push(stockData.category);
        } else if (tertiary_dimension === 'Brand') {
          dimensionKeys.push(stockData.brand);
        } else if (tertiary_dimension === 'Store') {
          dimensionKeys.push(stockData.store);
        } else if (tertiary_dimension === 'Location') {
          dimensionKeys.push(stockData.location);
        } else if (tertiary_dimension === 'UOM') {
          dimensionKeys.push(stockData.uom);
        }
      }

      const groupKey = dimensionKeys.join('|');
      if (!dimensionGroups[groupKey]) {
        dimensionGroups[groupKey] = {
          items: new Set(),
          quantity: 0,
          value: 0,
          costs: [],
        };
      }

      dimensionGroups[groupKey].items.add(partKey);
      dimensionGroups[groupKey].quantity += stockData.quantity;
      dimensionGroups[groupKey].value += stockData.value;
      dimensionGroups[groupKey].costs.push(stockData.cost);
    }

    // Convert to report rows
    const reportRows = Object.entries(dimensionGroups).map(([key, group]) => {
      const dimensionParts = key.split('|');
      const dimension = dimensionParts.join(' - ') || 'All';
      const items = group.items.size;
      const avgCost = group.costs.length > 0
        ? group.costs.reduce((sum, cost) => sum + cost, 0) / group.costs.length
        : 0;

      return {
        id: key,
        dimension,
        items,
        quantity: group.quantity,
        value: group.value,
        avgCost,
      };
    });

    // Calculate total for percentage calculation
    const totalValue = reportRows.reduce((sum, row) => sum + row.value, 0);
    const totalQuantity = reportRows.reduce((sum, row) => sum + row.quantity, 0);
    const totalItems = reportRows.reduce((sum, row) => sum + row.items, 0);

    // Add percentage of total
    const reportRowsWithPercent = reportRows.map(row => ({
      ...row,
      percentOfTotal: totalValue > 0 ? (row.value / totalValue) * 100 : 0,
    }));

    // Sort
    let sortedRows = [...reportRowsWithPercent];
    if (sort_by) {
      sortedRows.sort((a, b) => {
        let comparison = 0;
        switch (sort_by) {
          case 'Value':
            comparison = a.value - b.value;
            break;
          case 'Quantity':
            comparison = a.quantity - b.quantity;
            break;
          case 'Items':
            comparison = a.items - b.items;
            break;
          case 'Avg Cost':
            comparison = a.avgCost - b.avgCost;
            break;
          case 'Name':
            comparison = a.dimension.localeCompare(b.dimension);
            break;
          default:
            comparison = a.value - b.value;
        }
        return sort_direction === 'desc' ? -comparison : comparison;
      });
    }

    res.json({
      data: sortedRows,
      totals: {
        items: totalItems,
        quantity: totalQuantity,
        value: totalValue,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stock Verification Routes

// Get all verification sessions
router.get('/verifications', async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }

    const [verifications, total] = await Promise.all([
      prisma.stockVerification.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.stockVerification.count({ where }),
    ]);

    res.json({
      data: verifications.map(v => ({
        id: v.id,
        name: v.name,
        notes: v.notes,
        status: v.status,
        startDate: v.startDate,
        completedDate: v.completedDate,
        totalItems: v.items.length,
        verifiedItems: v.items.filter(i => i.status === 'Verified').length,
        discrepancies: v.items.filter(i => i.status === 'Discrepancy').length,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get active verification session
router.get('/verifications/active', async (req: Request, res: Response) => {
  try {
    const verification = await prisma.stockVerification.findFirst({
      where: { status: 'Active' },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
            store: true,
            rack: true,
            shelf: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      return res.json(null);
    }

    res.json({
      id: verification.id,
      name: verification.name,
      notes: verification.notes,
      status: verification.status,
      startDate: verification.startDate,
      completedDate: verification.completedDate,
      items: verification.items.map(item => {
        const locationParts = [];
        if (item.store?.name) locationParts.push(item.store.name);
        if (item.rack?.codeNo) locationParts.push(item.rack.codeNo);
        if (item.shelf?.shelfNo) locationParts.push(item.shelf.shelfNo);
        const location = locationParts.length > 0 ? locationParts.join(' / ') : 'No Location';
        
        return {
          id: item.id,
          partNo: item.part.partNo,
          description: item.part.description || '',
          location: location,
          systemQty: item.systemQty,
          physicalQty: item.physicalQty,
          variance: item.variance,
          status: item.status,
          remarks: item.remarks || '',
        };
      }),
      totalItems: verification.items.length,
      verifiedItems: verification.items.filter(i => i.status === 'Verified').length,
      discrepancies: verification.items.filter(i => i.status === 'Discrepancy').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new verification session
router.post('/verifications', async (req: Request, res: Response) => {
  try {
    const { name, notes, store_id, rack_id, shelf_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Get all active parts
    const parts = await prisma.part.findMany({
      where: { status: 'active' },
    });

    // Get stock movements for all parts, filtered by location if provided
    const partIds = parts.map(p => p.id);
    const whereMovement: any = {
      partId: { in: partIds },
    };
    
    if (store_id) {
      whereMovement.storeId = store_id;
    }
    if (rack_id) {
      whereMovement.rackId = rack_id;
    }
    if (shelf_id) {
      whereMovement.shelfId = shelf_id;
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereMovement,
    });

    // Group movements by part
    const stockByPart: Record<string, { in: number; out: number }> = {};
    for (const movement of movements) {
      if (!stockByPart[movement.partId]) {
        stockByPart[movement.partId] = { in: 0, out: 0 };
      }
      if (movement.type === 'in') {
        stockByPart[movement.partId].in += movement.quantity;
      } else {
        stockByPart[movement.partId].out += movement.quantity;
      }
    }

    // Calculate system quantities for each part and create verification items
    const verificationItems = [];
    for (const part of parts) {
      const stock = stockByPart[part.id] || { in: 0, out: 0 };
      const systemQty = stock.in - stock.out;

      // Include all parts if no location filter, or only those with stock at the location if filtered
      if (systemQty > 0 || (!store_id && !rack_id && !shelf_id)) {
        verificationItems.push({
          partId: part.id,
          storeId: store_id || null,
          rackId: rack_id || null,
          shelfId: shelf_id || null,
          systemQty: systemQty,
          physicalQty: null,
          variance: null,
          status: 'Pending',
          remarks: null,
        });
      }
    }

    const verification = await prisma.stockVerification.create({
      data: {
        name,
        notes: notes || null,
        status: 'Active',
        items: {
          create: verificationItems,
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({
      id: verification.id,
      name: verification.name,
      status: verification.status,
      startDate: verification.startDate,
      totalItems: verification.items.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single verification session
router.get('/verifications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const verification = await prisma.stockVerification.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
            store: true,
            rack: true,
            shelf: true,
          },
        },
      },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    res.json({
      id: verification.id,
      name: verification.name,
      notes: verification.notes,
      status: verification.status,
      startDate: verification.startDate,
      completedDate: verification.completedDate,
      items: verification.items.map(item => {
        const locationParts = [];
        if (item.store?.name) locationParts.push(item.store.name);
        if (item.rack?.codeNo) locationParts.push(item.rack.codeNo);
        if (item.shelf?.shelfNo) locationParts.push(item.shelf.shelfNo);
        const location = locationParts.length > 0 ? locationParts.join(' / ') : 'No Location';
        
        return {
          id: item.id,
          partNo: item.part.partNo,
          description: item.part.description || '',
          location: location,
          systemQty: item.systemQty,
          physicalQty: item.physicalQty,
          variance: item.variance,
          status: item.status,
          remarks: item.remarks || '',
        };
      }),
      totalItems: verification.items.length,
      verifiedItems: verification.items.filter(i => i.status === 'Verified').length,
      discrepancies: verification.items.filter(i => i.status === 'Discrepancy').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update verification item
router.put('/verifications/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const { physicalQty, remarks } = req.body;

    // Get the item to calculate variance
    const item = await prisma.stockVerificationItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.verificationId !== id) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const physicalQtyNum = physicalQty !== null && physicalQty !== undefined ? parseInt(physicalQty) : null;
    const variance = physicalQtyNum !== null ? physicalQtyNum - item.systemQty : null;
    const status = physicalQtyNum === null 
      ? 'Pending' 
      : variance === 0 
        ? 'Verified' 
        : 'Discrepancy';

    const updatedItem = await prisma.stockVerificationItem.update({
      where: { id: itemId },
      data: {
        physicalQty: physicalQtyNum,
        variance,
        status,
        remarks: remarks || null,
      },
    });

    res.json({
      id: updatedItem.id,
      physicalQty: updatedItem.physicalQty,
      variance: updatedItem.variance,
      status: updatedItem.status,
      remarks: updatedItem.remarks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete verification session
router.put('/verifications/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const verification = await prisma.stockVerification.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    if (verification.status !== 'Active') {
      return res.status(400).json({ error: 'Verification is not active' });
    }

    const updatedVerification = await prisma.stockVerification.update({
      where: { id },
      data: {
        status: 'Completed',
        completedDate: new Date(),
      },
      include: {
        items: true,
      },
    });

    res.json({
      id: updatedVerification.id,
      status: updatedVerification.status,
      completedDate: updatedVerification.completedDate,
      totalItems: updatedVerification.items.length,
      verifiedItems: updatedVerification.items.filter(i => i.status === 'Verified').length,
      discrepancies: updatedVerification.items.filter(i => i.status === 'Discrepancy').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel verification session
router.put('/verifications/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const verification = await prisma.stockVerification.findUnique({
      where: { id },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    if (verification.status !== 'Active') {
      return res.status(400).json({ error: 'Only active verifications can be cancelled' });
    }

    const updatedVerification = await prisma.stockVerification.update({
      where: { id },
      data: {
        status: 'Cancelled',
      },
    });

    res.json({
      id: updatedVerification.id,
      status: updatedVerification.status,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Direct Purchase Orders Routes

// Get all direct purchase orders
router.get('/direct-purchase-orders', async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, store_id, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }
    if (store_id) {
      where.storeId = store_id as string;
    }
    if (from_date || to_date) {
      where.date = {};
      if (from_date) {
        where.date.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.date.lte = new Date(to_date as string);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.directPurchaseOrder.findMany({
        where,
        include: {
          store: true,
          items: {
            include: {
              part: {
                include: {
                  brand: true,
                  category: true,
                },
              },
              rack: true,
              shelf: true,
            },
          },
          expenses: true,
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.directPurchaseOrder.count({ where }),
    ]);

    res.json({
      data: orders.map(dpo => {
        // Calculate total quantity from items
        const total_quantity = dpo.items.reduce((sum, item) => sum + item.quantity, 0);
        
        return {
          id: dpo.id,
          dpo_no: dpo.dpoNumber,
          date: dpo.date,
          store_id: dpo.storeId,
          store_name: dpo.store?.name || null,
          supplier_id: dpo.supplierId,
          account: dpo.account,
          description: dpo.description,
          status: dpo.status,
          total_amount: dpo.totalAmount,
          items_count: dpo.items.length,
          total_quantity: total_quantity,
          expenses_count: dpo.expenses.length,
          created_at: dpo.createdAt,
          items: dpo.items.map(item => ({
            id: item.id,
            part_id: item.partId,
            partId: item.partId,
            part_no: item.part?.partNo || null,
            partNo: item.part?.partNo || null,
            part_description: item.part?.description || null,
            partDescription: item.part?.description || null,
            description: item.part?.description || null,
            quantity: item.quantity,
            purchase_price: item.purchasePrice,
            purchasePrice: item.purchasePrice,
            sale_price: item.salePrice,
            salePrice: item.salePrice,
            amount: item.amount,
            rack_id: item.rackId,
            rackId: item.rackId,
            shelf_id: item.shelfId,
            shelfId: item.shelfId,
            rack: item.rack ? {
              id: item.rack.id,
              codeNo: item.rack.codeNo,
            } : null,
            shelf: item.shelf ? {
              id: item.shelf.id,
              shelfNo: item.shelf.shelfNo,
            } : null,
            part: item.part ? {
              id: item.part.id,
              partNo: item.part.partNo,
              description: item.part.description,
            } : null,
          })),
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single direct purchase order
router.get('/direct-purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.directPurchaseOrder.findUnique({
      where: { id },
      include: {
        store: true,
        items: {
          include: {
            part: {
              include: {
                brand: true,
                category: true,
              },
            },
            rack: true,
            shelf: true,
          },
        },
        expenses: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Direct purchase order not found' });
    }

    res.json({
      id: order.id,
      dpo_no: order.dpoNumber,
      date: order.date,
      store_id: order.storeId,
      store_name: order.store?.name || null,
      supplier_id: order.supplierId,
      account: order.account,
      description: order.description,
      status: order.status,
      total_amount: order.totalAmount,
      items: order.items.map(item => ({
        id: item.id,
        part_id: item.partId,
        part_no: item.part.partNo,
        part_description: item.part.description,
        brand: item.part.brand?.name || '',
        category: item.part.category?.name || '',
        uom: item.part.uom || 'pcs',
        quantity: item.quantity,
        purchase_price: item.purchasePrice,
        sale_price: item.salePrice,
        amount: item.amount,
        price_a: item.priceA !== null && item.priceA !== undefined ? item.priceA : null,
        price_b: item.priceB !== null && item.priceB !== undefined ? item.priceB : null,
        price_m: item.priceM !== null && item.priceM !== undefined ? item.priceM : null,
        rack_id: item.rackId,
        rack_name: item.rack?.codeNo || null,
        shelf_id: item.shelfId,
        shelf_name: item.shelf?.shelfNo || null,
      })),
      expenses: order.expenses.map(expense => ({
        id: expense.id,
        expense_type: expense.expenseType,
        payable_account: expense.payableAccount,
        description: expense.description,
        amount: expense.amount,
      })),
      created_at: order.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create direct purchase order
router.post('/direct-purchase-orders', async (req: Request, res: Response) => {
  try {
    // Debug: Log raw request info

    let { dpo_number, date, store_id, supplier_id, account, description, status, items, expenses } = req.body || {};

    // Debug logging

    if (!date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'date and items are required' });
    }

    // Validate supplier is required
    if (!supplier_id) {
      return res.status(400).json({ error: 'Supplier is required' });
    }

    // Generate DPO number if not provided or if it already exists
    if (!dpo_number) {
      // Generate new DPO number
      const year = new Date(date).getFullYear();
      const lastDPO = await prisma.directPurchaseOrder.findFirst({
        where: {
          dpoNumber: {
            startsWith: `DPO-${year}-`,
          },
        },
        orderBy: {
          dpoNumber: 'desc',
        },
      });

      let nextNum = 1;
      if (lastDPO) {
        const match = lastDPO.dpoNumber.match(new RegExp(`^DPO-${year}-(\\d+)$`));
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      dpo_number = `DPO-${year}-${String(nextNum).padStart(3, '0')}`;
    } else {
      // Check if DPO number already exists
      const existingDPO = await prisma.directPurchaseOrder.findUnique({
        where: { dpoNumber: dpo_number },
      });

      if (existingDPO) {
        // Generate a new unique number if the provided one exists
        const year = new Date(date).getFullYear();
        const lastDPO = await prisma.directPurchaseOrder.findFirst({
          where: {
            dpoNumber: {
              startsWith: `DPO-${year}-`,
            },
          },
          orderBy: {
            dpoNumber: 'desc',
          },
        });

        let nextNum = 1;
        if (lastDPO) {
          const match = lastDPO.dpoNumber.match(new RegExp(`^DPO-${year}-(\\d+)$`));
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        dpo_number = `DPO-${year}-${String(nextNum).padStart(3, '0')}`;
      }
    }

    // Calculate total amount from items
    const itemsTotal = items.reduce((sum: number, item: any) => {
      return sum + (item.amount || (item.purchase_price * item.quantity));
    }, 0);

    // Calculate total expenses
    const expensesTotal = expenses && Array.isArray(expenses) && expenses.length > 0 
      ? expenses.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0) 
      : 0;

    const totalAmount = itemsTotal + expensesTotal;
    
    // Initialize voucher creation status tracking
    const voucherCreationStatus = {
      jvCreated: false,
      pvCreated: false,
      jvNumber: null as string | null,
      pvNumber: null as string | null,
      errors: [] as string[],
    };
    
    // Debug logging

    const order = await prisma.directPurchaseOrder.create({
      data: {
        dpoNumber: dpo_number,
        date: new Date(date),
        storeId: store_id || null,
        supplierId: supplier_id || null,
        account: account || null,
        description: description || null,
        status: status || 'Completed',
        totalAmount: totalAmount,
        items: {
          create: items.map((item: any) => ({
            partId: item.part_id,
            quantity: item.quantity || 0,
            purchasePrice: item.purchase_price !== undefined && item.purchase_price !== null ? Number(item.purchase_price) : 0,
            salePrice: 0, // sale_price is not used, default to 0
            amount: item.amount || ((item.purchase_price || 0) * (item.quantity || 0)),
            priceA: item.price_a !== undefined && item.price_a !== null ? Number(item.price_a) : null,
            priceB: item.price_b !== undefined && item.price_b !== null ? Number(item.price_b) : null,
            priceM: item.price_m !== undefined && item.price_m !== null ? Number(item.price_m) : null,
            rackId: item.rack_id || null,
            shelfId: item.shelf_id || null,
          })),
        },
        expenses: expenses && expenses.length > 0 ? {
          create: expenses.map((exp: any) => ({
            expenseType: exp.expense_type,
            payableAccount: exp.payable_account,
            description: exp.description || null,
            amount: exp.amount,
          })),
        } : undefined,
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        expenses: true,
      },
    });

    // Update cost prices when DPO is created (regardless of status)
    // This ensures the cost is updated immediately when DPO is created
    // Calculate total expenses
    const totalExpenses = expenses && Array.isArray(expenses) && expenses.length > 0
      ? expenses.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0)
      : 0;
    
    // Update cost prices using inventory formulas
    if (items && items.length > 0) {
      
      try {
        const receiveResult = await processPurchaseReceive(
          items.map((item: any) => ({
            partId: item.part_id,
            quantity: item.quantity || 0,
            purchasePrice: item.purchase_price || 0,
          })),
          totalExpenses,
          'value' // distribute expenses by item value (proportional)
        );
        
      } catch (error: any) {
        // Continue with stock movements even if cost update fails
      }
    }
    
    // Create stock movements only when status is "Completed"
    if (status === 'Completed') {
      for (const item of items) {
        await prisma.stockMovement.create({
          data: {
            partId: item.part_id,
            type: 'in',
            quantity: item.quantity,
            storeId: store_id || null,
            rackId: item.rack_id || null,
            shelfId: item.shelf_id || null,
            referenceType: 'direct_purchase',
            referenceId: order.id,
            notes: `Direct Purchase Order: ${dpo_number}`,
          },
        });
      }
    }

    // Create journal entry to update account balances
    // Check for both "Completed" and "Received" status (Received means the order was received/processed)
    // ALWAYS create vouchers when DPO is created, regardless of status (as long as totalAmount > 0)
    if (totalAmount > 0) {
      try {
        // Find Inventory Account (NOT from account field - that's for bank/cash payment)
        // Always find Inventory Account separately - it's always needed for JV voucher
        let inventoryAccount = null;
        
        // First try subgroup 104 (Inventory)
        inventoryAccount = await prisma.account.findFirst({
          where: {
            subgroup: {
              code: '104',
            },
            status: 'Active',
          },
          include: {
            subgroup: {
              include: {
                mainGroup: true,
              },
            },
          },
        });
        
        // Fallback: Find by name containing "Inventory" (case-insensitive search)
        if (!inventoryAccount) {
          const allAccounts = await prisma.account.findMany({
            where: {
              status: 'Active',
            },
            include: {
              subgroup: {
                include: {
                  mainGroup: true,
                },
              },
            },
          });
          
          // Manual case-insensitive search
          for (const acc of allAccounts) {
            if (acc.name && acc.name.toLowerCase().includes('inventory')) {
              inventoryAccount = acc;
              break;
            }
          }
        }
        
        if (!inventoryAccount) {
        } else {
        }

        // Find the main payable account (for supplier payable - we need a liability account)
        let mainPayableAccount = null;
        
        // Try to find or create supplier account
        let supplierAccountName = 'Supplier';
        if (!mainPayableAccount && supplier_id) {
            const supplier = await prisma.supplier.findUnique({
              where: { id: supplier_id },
            });
            
            if (supplier) {
              supplierAccountName = supplier.companyName || supplier.name || 'Supplier';
              const payablesSubgroup = await prisma.subgroup.findFirst({
                where: { code: '301' },
              });

              if (payablesSubgroup) {
                // Find existing supplier account (should already exist if supplier was created properly)
                mainPayableAccount = await prisma.account.findFirst({
                  where: {
                    subgroupId: payablesSubgroup.id,
                    OR: [
                      { name: supplier.name || '' },
                      { name: supplier.companyName || '' },
                    ],
                  },
                  include: {
                    subgroup: {
                      include: {
                        mainGroup: true,
                      },
                    },
                  },
                });

                // Only create supplier account if it doesn't exist (should rarely happen)
                // This ensures we use the existing account with opening balance
                if (!mainPayableAccount) {
                  const existingAccounts = await prisma.account.findMany({
                    where: { code: { startsWith: '301' } },
                    orderBy: { code: 'desc' },
                  });

                  let accountCode = '301001';
                  if (existingAccounts.length > 0) {
                    const lastCode = existingAccounts[0].code;
                    const match = lastCode.match(/^301(\d+)$/);
                    if (match) {
                      const lastNum = parseInt(match[1], 10);
                      const nextNum = lastNum + 1;
                      accountCode = `301${String(nextNum).padStart(3, '0')}`;
                    }
                  }

                  mainPayableAccount = await prisma.account.create({
                    data: {
                      subgroupId: payablesSubgroup.id,
                      code: accountCode,
                      name: supplier.companyName || supplier.name || account,
                      description: `Supplier Account: ${supplier.companyName || supplier.name}`,
                      openingBalance: supplier.openingBalance || 0, // Use supplier's opening balance
                      currentBalance: supplier.openingBalance || 0, // Initialize with opening balance
                      status: 'Active',
                      canDelete: false,
                    },
                    include: {
                      subgroup: {
                        include: {
                          mainGroup: true,
                        },
                      },
                    },
                  });
                  
                } else {
                }
              }
            }
          }

          // Last fallback: find any account with the name
          if (!mainPayableAccount && account) {
            const accountByName = await prisma.account.findFirst({
              where: {
                name: { contains: account },
                status: 'Active',
              },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });
            // Only use it if it's a liability account
            if (accountByName && accountByName.subgroup.mainGroup.type.toLowerCase() === 'liability') {
              mainPayableAccount = accountByName;
            }
          }

        // Fallback to generic Accounts Payable - try multiple variations
        if (!mainPayableAccount) {
          // Try different account codes and names
          mainPayableAccount = await prisma.account.findFirst({
            where: {
              OR: [
                { code: '301001' },
                { code: '3010001' },
                { name: 'Accounts Payable' },
              ],
              status: 'Active',
            },
            include: {
              subgroup: {
                include: {
                  mainGroup: true,
                },
              },
            },
          });
          
          // If still not found, try to find any account in subgroup 301
          if (!mainPayableAccount) {
            const payablesSubgroup = await prisma.subgroup.findFirst({
              where: { code: '301' },
            });
            
            if (payablesSubgroup) {
              mainPayableAccount = await prisma.account.findFirst({
                where: {
                  subgroupId: payablesSubgroup.id,
                  status: 'Active',
                },
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              });
            }
          }
        }

        if (inventoryAccount && mainPayableAccount) {
          // Generate voucher number first (format: JV4800 - 4 digits, no year prefix)
          const lastVoucher = await prisma.voucher.findFirst({
            where: {
              type: 'journal',
              voucherNumber: {
                startsWith: 'JV',
              },
            },
            orderBy: {
              voucherNumber: 'desc',
            },
          });

          let jvNumber = 1;
          if (lastVoucher) {
            const match = lastVoucher.voucherNumber.match(/^JV(\d+)$/);
            if (match) {
              jvNumber = parseInt(match[1]) + 1;
            } else {
              // Fallback: count all journal vouchers
              const voucherCount = await prisma.voucher.count({
                where: { type: 'journal' },
              });
              jvNumber = voucherCount + 1;
            }
          }
          const voucherNumber = `JV${String(jvNumber).padStart(4, '0')}`;
          
          // Generate unique entryNo - check existing journal entries to avoid conflicts
          let entryNo = voucherNumber;
          let entryNoExists = await prisma.journalEntry.findUnique({
            where: { entryNo: entryNo },
          });
          
          // If entryNo exists, find the next available number
          if (entryNoExists) {
            const lastEntry = await prisma.journalEntry.findFirst({
              where: {
                entryNo: {
                  startsWith: 'JV',
                },
              },
              orderBy: {
                entryNo: 'desc',
              },
            });
            
            if (lastEntry) {
              const match = lastEntry.entryNo.match(/^JV(\d+)$/);
              if (match) {
                const nextNum = parseInt(match[1]) + 1;
                entryNo = `JV${String(nextNum).padStart(4, '0')}`;
              } else {
                // Fallback: use timestamp-based unique number
                entryNo = `JV${Date.now().toString().slice(-6)}`;
              }
            }
          }

          // Build journal lines with proper descriptions matching screenshot format
          const journalLines: Array<{ accountId: string; description: string; debit: number; credit: number; lineOrder: number }> = [];
          
          // Entry 1: Debit Inventory Account (for items total) - with detailed item description
          if (itemsTotal > 0) {
            // Build detailed description with item information matching screenshot format
            // Format: "DPO: 15 Inventory Added, partNo/brand/description/, Qty 22, Rate 15000, Cost: 1000"
            // Use order.items which already includes part information
            const itemDetails = order.items.map((orderItem: any) => {
              const part = orderItem.part;
              const partNo = part?.partNo || 'N/A';
              const description = part?.description || 'Item';
              const brand = part?.brand?.name || '';
              const qty = orderItem.quantity;
              const rate = orderItem.purchasePrice;
              const cost = orderItem.amount;
              
              return `${partNo}${brand ? '/' + brand : ''}/${description}/, Qty ${qty}, Rate ${rate}, Cost: ${cost}`;
            }).join(', ');
            
            journalLines.push({
              accountId: inventoryAccount.id,
              description: `DPO: ${dpo_number} Inventory Added, ${itemDetails}`,
              debit: itemsTotal,
              credit: 0,
              lineOrder: 0,
            });
          }

          // Lines for expenses: Debit Inventory (add expenses to inventory cost), Credit Expense Payable Accounts
          if (expenses && expenses.length > 0) {
            for (let i = 0; i < expenses.length; i++) {
              const exp = expenses[i];
              if (exp.amount > 0 && exp.payable_account) {
                // Find expense payable account
                const expensePayableAccount = await prisma.account.findFirst({
                  where: {
                    name: exp.payable_account,
                    status: 'Active',
                  },
                  include: {
                    subgroup: {
                      include: {
                        mainGroup: true,
                      },
                    },
                  },
                });

                if (expensePayableAccount) {
                  // Add expense to inventory cost - Debit Inventory, Credit Expense Payable
                  journalLines.push({
                    accountId: inventoryAccount.id,
                    description: `DPO: ${dpo_number} - ${exp.expense_type || 'Expense'}: ${exp.description || ''}`,
                    debit: exp.amount,
                    credit: 0,
                    lineOrder: journalLines.length,
                  });

                  journalLines.push({
                    accountId: expensePayableAccount.id,
                    description: `DPO: ${dpo_number} - ${exp.expense_type || 'Expense'} Payable`,
                    debit: 0,
                    credit: exp.amount,
                    lineOrder: journalLines.length,
                  });
                }
              }
            }
          }

          // Entry 2: Credit Supplier Payable Account (Main entry - supplier liability)
          // Format: "DPO: 15 Abdullah Rehman Liability Created"
          if (itemsTotal > 0) {
            journalLines.push({
              accountId: mainPayableAccount.id,
              description: `DPO: ${dpo_number} ${supplierAccountName} Liability Created`,
              debit: 0,
              credit: itemsTotal,
              lineOrder: journalLines.length,
            });
          }

          // Calculate totals
          const totalDebit = journalLines.reduce((sum, line) => sum + line.debit, 0);
          const totalCredit = journalLines.reduce((sum, line) => sum + line.credit, 0);

          // Create journal entry
          if (journalLines.length > 0 && totalDebit === totalCredit) {
            // Double-check entryNo is unique before creating
            let finalEntryNo = entryNo;
            let attempts = 0;
            while (attempts < 10) {
              const exists = await prisma.journalEntry.findUnique({
                where: { entryNo: finalEntryNo },
              });
              if (!exists) {
                break; // Found unique number
              }
              // Generate new number
              const match = finalEntryNo.match(/^JV(\d+)$/);
              if (match) {
                const nextNum = parseInt(match[1]) + 1;
                finalEntryNo = `JV${String(nextNum).padStart(4, '0')}`;
              } else {
                finalEntryNo = `JV${String(Date.now()).slice(-6)}`;
              }
              attempts++;
            }
            
            const journalEntry = await prisma.journalEntry.create({
              data: {
                entryNo: finalEntryNo,
                entryDate: new Date(date),
                reference: `DPO-${dpo_number}`,
                description: `Direct Purchase Order ${dpo_number}${description ? `: ${description}` : ''}`,
                totalDebit,
                totalCredit,
                status: 'posted',
                createdBy: 'System',
                postedBy: 'System',
                postedAt: new Date(),
                lines: {
                  create: journalLines,
                },
              },
              include: {
                lines: {
                  include: {
                    account: {
                      include: {
                        subgroup: {
                          include: {
                            mainGroup: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            });

            // Update account balances
            for (const line of journalEntry.lines) {
              const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
              // Assets and Expenses: increase with debit, decrease with credit
              // Liabilities, Equity, Revenue: increase with credit, decrease with debit
              const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
                ? (line.debit - line.credit)
                : (line.credit - line.debit);

              await prisma.account.update({
                where: { id: line.accountId },
                data: {
                  currentBalance: {
                    increment: balanceChange,
                  },
                },
              });
            }

            // Create Voucher automatically when DPO is created
            try {
              
              // Use supplier name already captured (or 'Supplier' if no supplier)
              const supplierName = supplierAccountName;

              // Get account details for voucher entries from journal lines
              const voucherEntries = [];
              for (const line of journalLines) {
                const account = await prisma.account.findUnique({
                  where: { id: line.accountId },
                  select: { code: true, name: true },
                });

                voucherEntries.push({
                  accountId: line.accountId,
                  accountName: account ? `${account.code}-${account.name}` : 'Account',
                  description: line.description || `Direct Purchase Order ${dpo_number}`,
                  debit: line.debit,
                  credit: line.credit,
                  sortOrder: line.lineOrder,
                });
              }

              // Create voucher with supplier name in narration (exactly as shown in screenshot - just supplier name)
              const voucher = await prisma.voucher.create({
                data: {
                  voucherNumber, // e.g., JV4800
                  type: 'journal',
                  date: new Date(date),
                  narration: supplierName, // Just supplier name: "Abdullah Rehman" (not "Abdullah Rehman - DPO 15")
                  totalDebit: totalDebit,
                  totalCredit: totalCredit,
                  status: 'posted', // Auto-approve the voucher
                  createdBy: 'System',
                  approvedBy: 'System',
                  approvedAt: new Date(),
                  entries: {
                    create: voucherEntries,
                  },
                },
              });

              voucherCreationStatus.jvCreated = true;
              voucherCreationStatus.jvNumber = voucherNumber;
              
              // If account (bank/cash) is selected, automatically create PV voucher for payment
              // This means user is paying the supplier immediately
              // NOTE: PV voucher should only include items total (NOT expenses)
              if (account && itemsTotal > 0 && mainPayableAccount) {
                  
                  // Get the cash/bank account that was selected
                  const cashBankAccount = await prisma.account.findUnique({
                    where: { id: account },
                    include: {
                      subgroup: {
                        include: {
                          mainGroup: true,
                        },
                      },
                    },
                  });

                  if (!cashBankAccount) {
                    voucherCreationStatus.errors.push(`Cash/Bank account ${account} not found`);
                  } else {
                    // Verify it's a Cash (101) or Bank (102) account
                    const subgroupCode = cashBankAccount.subgroup?.code || '';
                    const isCashOrBank = subgroupCode === '101' || subgroupCode === '102';
                    
                    if (!isCashOrBank) {
                      const accountType = cashBankAccount.subgroup?.mainGroup?.type?.toLowerCase() || '';
                      if (accountType !== 'asset') {
                        voucherCreationStatus.errors.push(`Account ${cashBankAccount.name} is not a Cash/Bank account`);
                      } else {
                        // Allow if it's an asset account even if not 101/102
                      }
                    }
                    
                    // Only proceed if we haven't encountered an error
                    if (cashBankAccount && (!isCashOrBank ? cashBankAccount.subgroup?.mainGroup?.type?.toLowerCase() === 'asset' : true)) {
                      // Generate PV number (format: PV####)
                      const lastPV = await prisma.voucher.findFirst({
                        where: {
                          type: 'payment',
                          voucherNumber: {
                            startsWith: 'PV',
                          },
                        },
                        orderBy: {
                          voucherNumber: 'desc',
                        },
                      });

                      let pvNumber = 1;
                      if (lastPV) {
                        const match = lastPV.voucherNumber.match(/^PV(\d+)$/);
                        if (match) {
                          pvNumber = parseInt(match[1]) + 1;
                        } else {
                          const voucherCount = await prisma.voucher.count({
                            where: { type: 'payment' },
                          });
                          pvNumber = voucherCount + 1;
                        }
                      }
                      const pvVoucherNumber = `PV${String(pvNumber).padStart(4, '0')}`;

                    // Create Payment Voucher (using itemsTotal only, NOT expenses)
                    // Debit Supplier Payable (decreases liability) and Credit Cash/Bank (decreases asset)
                    const paymentVoucher = await prisma.voucher.create({
                      data: {
                        voucherNumber: pvVoucherNumber,
                        type: 'payment',
                        date: new Date(date),
                        narration: supplierName,
                        cashBankAccount: cashBankAccount.name,
                        totalDebit: itemsTotal, // Only items total, no expenses
                        totalCredit: itemsTotal, // Only items total, no expenses
                        status: 'posted',
                        createdBy: 'System',
                        approvedBy: 'System',
                        approvedAt: new Date(),
                        entries: {
                          create: [
                            {
                              accountId: mainPayableAccount.id,
                              accountName: `${mainPayableAccount.code}-${mainPayableAccount.name}`,
                              description: `Payment for DPO ${dpo_number}`,
                              debit: itemsTotal, // Only items total
                              credit: 0,
                              sortOrder: 0,
                            },
                            {
                              accountId: cashBankAccount.id,
                              accountName: `${cashBankAccount.code}-${cashBankAccount.name}`,
                              description: `Payment made for DPO ${dpo_number}`,
                              debit: 0,
                              credit: itemsTotal, // Only items total
                              sortOrder: 1,
                            },
                          ],
                        },
                      },
                    });

                    // Update account balances for PV voucher (using itemsTotal only)
                    // Debit Supplier Payable (decreases liability)
                    await prisma.account.update({
                      where: { id: mainPayableAccount.id },
                      data: {
                        currentBalance: {
                          decrement: itemsTotal, // Only items total
                        },
                      },
                    });

                    // Credit Cash/Bank (decreases asset)
                    await prisma.account.update({
                      where: { id: cashBankAccount.id },
                      data: {
                        currentBalance: {
                          decrement: itemsTotal, // Only items total
                        },
                      },
                    });

                    voucherCreationStatus.pvCreated = true;
                    voucherCreationStatus.pvNumber = pvVoucherNumber;
                  }
              } // end if account selected
              } else if (!account) {
              }
            } catch (voucherError: any) {
              voucherCreationStatus.errors.push(`JV creation failed: ${voucherError.message}`);
              // Don't fail the DPO creation if voucher creation fails
            }

          } else {
            voucherCreationStatus.errors.push(`Journal entry validation failed: Debits ${totalDebit} ≠ Credits ${totalCredit}`);
          }
        } else {
          
          // Try to help diagnose the issue
          if (!inventoryAccount) {
            voucherCreationStatus.errors.push('Inventory Account (subgroup 104) not found');
          }
          if (!mainPayableAccount) {
            voucherCreationStatus.errors.push('Supplier Payable Account not found');
            if (supplier_id) {
              const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
            }
          }
        }
      } catch (journalError: any) {
        voucherCreationStatus.errors.push(`Journal entry creation failed: ${journalError.message}`);
        // Don't fail the DPO creation if journal entry creation fails
      }
    }

    res.status(201).json({
      id: order.id,
      dpo_no: order.dpoNumber,
      date: order.date,
      status: order.status,
      total_amount: order.totalAmount,
      items_count: order.items.length,
      vouchers: voucherCreationStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update direct purchase order
router.put('/direct-purchase-orders/:id', async (req: Request, res: Response) => {
  // 🔍 ENTRY MARKER
  const entryMarker = `ENTRY:DPO_RECEIVE:${req.params.id}`;
  
  // Track updated parts for response
  const updatedParts: Array<{partNo: string, oldCost: number, newCost: number, partIdUpdated: string}> = [];
  
  // Declare receiveResult in outer scope for final cost update
  let receiveResult: any = null;
  
  try {
    const { id } = req.params;
    const { dpo_number, date, store_id, supplier_id, account, description, status, items, expenses } = req.body;

    // Check for transaction wrapper
    const hasTransaction = typeof (prisma as any).$transaction === 'function';
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const maskedDbUrl = dbUrl.includes('file:') 
      ? `file:${dbUrl.split('/').pop()}` 
      : dbUrl.replace(/:[^:@]+@/, ':****@');

    // 🔍 LOG: Database connection info
    
    // Get actual database file path for verification
    const actualDbPath = dbUrl.includes('file:') ? dbUrl.replace('file:', '') : 'unknown';
    const fs = require('fs');
    const dbFileExists = fs.existsSync(actualDbPath);
    const dbFileStats = dbFileExists ? fs.statSync(actualDbPath) : null;
    
    if (dbFileStats) {
    }

    const existingOrder = await prisma.directPurchaseOrder.findUnique({ 
      where: { id },
      include: { items: true }
    });
    if (!existingOrder) {
      return res.status(404).json({ error: 'Direct purchase order not found' });
    }

    // Validate supplier is required
    // Use supplier_id from request if provided, otherwise use existing supplier_id
    const finalSupplierId = supplier_id !== undefined ? supplier_id : existingOrder.supplierId;
    if (!finalSupplierId) {
      return res.status(400).json({ error: 'Supplier is required' });
    }

    // Delete existing stock movements if items are being updated OR if status is changing to Received/Completed
    // This ensures we can recreate movements with correct data
    if ((items && items.length > 0) || 
        (status && (status === 'Received' || status === 'Completed') && 
         existingOrder.status !== 'Received' && existingOrder.status !== 'Completed')) {
    await prisma.stockMovement.deleteMany({
      where: {
        referenceType: 'direct_purchase',
        referenceId: id,
      },
    });
    }

    // Calculate totals
    // If items are provided, calculate from items. Otherwise, calculate from existing items
    let itemsTotal: number;
    if (items && items.length > 0) {
      itemsTotal = items.reduce((sum: number, item: any) => {
        const itemAmount = item.amount !== undefined && item.amount !== null 
          ? Number(item.amount) 
          : (item.purchase_price !== undefined && item.purchase_price !== null && item.quantity)
            ? Number(item.purchase_price) * Number(item.quantity)
            : 0;
        return sum + (isNaN(itemAmount) ? 0 : itemAmount);
      }, 0);
    } else {
      // Calculate from existing items (not from totalAmount which includes expenses)
      const existingItems = await prisma.directPurchaseOrderItem.findMany({
        where: { directPurchaseOrderId: id }
      });
      itemsTotal = existingItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    // Calculate expenses total
    let expensesTotal = 0;
    if (expenses && Array.isArray(expenses) && expenses.length > 0) {
      expensesTotal = expenses.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
    } else if (expenses === undefined) {
      // If expenses not provided in update, calculate from existing expenses
      const existingExpenses = await prisma.directPurchaseOrderExpense.findMany({
        where: { directPurchaseOrderId: id }
      });
      expensesTotal = existingExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    }
    
    // Ensure totals are valid numbers (not NaN)
    const validItemsTotal = isNaN(itemsTotal) ? 0 : itemsTotal;
    const validExpensesTotal = isNaN(expensesTotal) ? 0 : expensesTotal;
    const totalAmount = validItemsTotal + validExpensesTotal;
    
    // Debug logging

    const order = await prisma.directPurchaseOrder.update({
      where: { id },
      data: {
        ...(dpo_number && { dpoNumber: dpo_number }),
        ...(date && { date: new Date(date) }),
        ...(store_id !== undefined && { 
          store: store_id ? { connect: { id: store_id } } : { disconnect: true }
        }),
        supplierId: finalSupplierId, // Always set supplier (required field)
        ...(account !== undefined && { account: account || null }),
        ...(description !== undefined && { description: description || null }),
        ...(status && { status }),
        totalAmount: totalAmount, // Always update totalAmount with recalculated value
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => {
              const purchasePrice = item.purchase_price !== undefined && item.purchase_price !== null 
                ? Number(item.purchase_price) 
                : 0; // Default to 0 instead of null (required field)
              const quantity = Number(item.quantity) || 0;
              const itemAmount = item.amount !== undefined && item.amount !== null
                ? Number(item.amount)
                : (!isNaN(purchasePrice))
                  ? purchasePrice * quantity
                  : 0;
              
              return {
                partId: item.part_id,
                quantity: quantity,
                purchasePrice: purchasePrice,
                salePrice: 0, // sale_price is not used, default to 0
                amount: itemAmount,
                priceA: item.price_a !== undefined && item.price_a !== null ? Number(item.price_a) : null,
                priceB: item.price_b !== undefined && item.price_b !== null ? Number(item.price_b) : null,
                priceM: item.price_m !== undefined && item.price_m !== null ? Number(item.price_m) : null,
                rackId: item.rack_id || null,
                shelfId: item.shelf_id || null,
              };
            }),
          },
        }),
        ...(expenses && {
          expenses: {
            deleteMany: {},
            create: expenses.map((exp: any) => ({
              expenseType: exp.expense_type,
              payableAccount: exp.payable_account,
              description: exp.description || null,
              amount: exp.amount,
            })),
          },
        }),
      },
      include: {
        items: true,
        expenses: true,
      },
    });

    // Update cost prices and create stock movements when status changes to "Received" or "Completed"
    // This happens when stock is received from store panel, NOT when DPO is created
    if ((status === 'Received' || status === 'Completed') && 
        existingOrder.status !== 'Received' && existingOrder.status !== 'Completed') {
      
      // Use items from request or fetch from order (order.items will have updated items after order update)
      const itemsToProcess = items || order.items;
      
      // Get expenses from request, or fetch from order if not provided
      let expensesToProcess = expenses;
      if (!expensesToProcess || (Array.isArray(expensesToProcess) && expensesToProcess.length === 0)) {
        // Fetch expenses from the order if not provided in the update request
        const orderWithExpenses = await prisma.directPurchaseOrder.findUnique({
          where: { id: order.id },
          include: { expenses: true },
        });
        expensesToProcess = orderWithExpenses?.expenses || [];
      }
      
      // Calculate total expenses
      const totalExpenses = Array.isArray(expensesToProcess) 
        ? expensesToProcess.reduce((sum: number, exp: any) => {
            return sum + (Number(exp.amount) || 0);
          }, 0)
        : 0;
      
      // Update cost prices using inventory formulas (only when stock is received)
      if (itemsToProcess && itemsToProcess.length > 0) {
        
        try {
          // Validate all items have valid partId before processing
          const validatedItems: Array<{partId: string, quantity: number, purchasePrice: number, partNo?: string}> = [];
          
          for (const item of itemsToProcess) {
            const partId = item.part_id || item.partId;
            if (!partId) {
              continue;
            }
            
            // Verify partId exists in database
            const part = await prisma.part.findUnique({
              where: { id: partId },
              select: { id: true, partNo: true },
            });
            
            if (!part) {
              
              // Fallback: Try to find canonical part by partNo if available
              const partNoFromItem = item.part_no || item.partNo;
              if (partNoFromItem) {
                const canonicalPartId = await getCanonicalPartId(prisma, partNoFromItem);
                if (canonicalPartId) {
                  const canonicalPart = await prisma.part.findUnique({
                    where: { id: canonicalPartId },
                    select: { id: true, partNo: true },
                  });
                  if (canonicalPart) {
                    validatedItems.push({
                      partId: canonicalPartId,
                      quantity: item.quantity || 0,
                      purchasePrice: item.purchase_price || item.purchasePrice || 0,
                      partNo: canonicalPart.partNo,
                    });
                    continue;
                  }
                }
              }
              
              continue;
            }
            
            validatedItems.push({
              partId,
              quantity: item.quantity || 0,
              purchasePrice: item.purchase_price || item.purchasePrice || 0,
              partNo: part.partNo,
            });
            
          }
          
          if (validatedItems.length === 0) {
            throw new Error('No valid items with partId found in DPO items');
          }
          
          
          receiveResult = await processPurchaseReceive(
            validatedItems.map(item => ({
              partId: item.partId,
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
            })),
            totalExpenses,
            'value' // distribute expenses by item value (proportional)
          );
          

          // ⭐ COST UPDATE WILL HAPPEN AT THE END (after all operations complete)
          // Store receiveResult for later cost update
        } catch (error: any) {
          // Continue with stock movements even if cost update fails
        }
      }
      
      // Check if stock movements already exist (should be 0 if we deleted them above)
      const existingMovements = await prisma.stockMovement.findMany({
        where: {
          referenceType: 'direct_purchase',
          referenceId: order.id,
        },
      });

      // Only create if movements don't exist
      if (existingMovements.length === 0) {
        
        if (itemsToProcess && itemsToProcess.length > 0) {
          for (const item of itemsToProcess) {
            const partId = item.part_id || item.partId;
            const quantity = item.quantity;
            const finalStoreId = store_id || order.storeId || null;
            
            if (!partId) {
              continue;
            }
            
          await prisma.stockMovement.create({
            data: {
                partId: partId,
              type: 'in',
                quantity: quantity,
                storeId: finalStoreId,
                rackId: item.rack_id || item.rackId || null,
                shelfId: item.shelf_id || item.shelfId || null,
              referenceType: 'direct_purchase',
              referenceId: order.id,
                notes: `Direct Purchase Order: ${order.dpoNumber} - ${status}`,
            },
          });
          }
          
          // Clear reserved stock when DPO is received
          // Delete stockReservation records for all parts in this DPO
          try {
            const partIds = itemsToProcess
              .map((item: any) => item.part_id || item.partId)
              .filter((id: string) => id !== undefined);
            
            if (partIds.length > 0) {
              const deletedReservations = await prisma.stockReservation.deleteMany({
                where: {
                  partId: {
                    in: partIds,
                  },
                  status: 'reserved',
                },
              });
              if (deletedReservations.count > 0) {
              }
            }
          } catch (reservationError: any) {
            // Don't fail the DPO update if reservation clearing fails
          }
        } else {
        }
      } else {
      }
      
      // 🔍 FINAL VERIFICATION: Check that cost updates persisted after all operations
      if (itemsToProcess && itemsToProcess.length > 0 && receiveResult) {
        // Re-fetch DB info for verification
        const verifyDbUrl = process.env.DATABASE_URL || 'not set';
        const verifyMaskedDbUrl = verifyDbUrl.includes('file:') 
          ? `file:${verifyDbUrl.split('/').pop()}` 
          : verifyDbUrl.replace(/:[^:@]+@/, ':****@');
        const verifyDbPath = verifyDbUrl.includes('file:') ? verifyDbUrl.replace('file:', '') : 'unknown';
        const verifyDbFileExists = fs.existsSync(verifyDbPath);
        
        
        for (const resultItem of receiveResult.items) {
          try {
            // Query by ID first
            const finalPartById = await prisma.part.findUnique({
              where: { id: resultItem.partId },
              select: { partNo: true, cost: true, costSource: true, costSourceRef: true, costUpdatedAt: true },
            });
            
            if (finalPartById) {
              const costMatches = Math.abs((finalPartById.cost || 0) - resultItem.landedCost) < 0.01;
              
              // Also query by partNo to see which part API would return
              const partsByPartNo = await prisma.part.findMany({
                where: { partNo: finalPartById.partNo },
                select: { id: true, partNo: true, cost: true, costSource: true, costUpdatedAt: true },
                orderBy: [
                  { costUpdatedAt: 'desc' },
                  { updatedAt: 'desc' },
                ],
              });
              
              if (partsByPartNo.length > 0) {
                const apiWillReturn = partsByPartNo[0];
                if (apiWillReturn.id !== resultItem.partId) {
                }
                if (Math.abs((apiWillReturn.cost || 0) - resultItem.landedCost) > 0.01) {
                }
              }
            } else {
            }
          } catch (err: any) {
          }
        }
      }
    }

    // Create journal entry and voucher when status changes to Received/Completed
    // BUT only if vouchers don't already exist (prevent duplicates)
    if ((status === 'Received' || status === 'Completed') && 
        existingOrder.status !== 'Received' && existingOrder.status !== 'Completed' &&
        totalAmount > 0) {
      
      // Check if voucher already exists for this DPO (prevent duplicates)
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: {
          reference: `DPO-${existingOrder.dpoNumber}`,
        },
      });

      if (existingJournalEntry) {
      } else {
        try {
        // Find Inventory Account
        let inventoryAccount = null;
        if (account) {
          try {
            const accountById = await prisma.account.findUnique({
              where: { id: account },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });
            
            if (accountById && accountById.subgroup.code === '104') {
              inventoryAccount = accountById;
            }
          } catch (e) {
            // Continue
          }
        }
        
        if (!inventoryAccount) {
          inventoryAccount = await prisma.account.findFirst({
            where: {
              subgroup: {
                code: '104',
              },
              status: 'Active',
            },
            include: {
              subgroup: {
                include: {
                  mainGroup: true,
                },
              },
            },
          });
        }

        // Find the main payable account
        let mainPayableAccount = null;
        const finalAccount = account || order.account;
        // Use the validated finalSupplierId from top-level scope
        
        if (finalAccount) {
          try {
            mainPayableAccount = await prisma.account.findUnique({
              where: { id: finalAccount },
              include: {
                subgroup: {
                  include: {
                    mainGroup: true,
                  },
                },
              },
            });
            if (mainPayableAccount && mainPayableAccount.subgroup.mainGroup.type.toLowerCase() !== 'liability') {
              mainPayableAccount = null;
            }
          } catch (e) {
            // Continue
          }
        }

        // Get supplier name for narration (needed for both journal entry and voucher)
        let supplierAccountName = 'Supplier';
        if (finalSupplierId) {
          try {
            const supplier = await prisma.supplier.findUnique({
              where: { id: finalSupplierId },
              select: { companyName: true, name: true },
            });
            if (supplier) {
              supplierAccountName = supplier.companyName || supplier.name || 'Supplier';
            }
          } catch (e) {
          }
        }

        if (!mainPayableAccount && finalSupplierId) {
          const supplier = await prisma.supplier.findUnique({
            where: { id: finalSupplierId },
          });
          
          if (supplier) {
            const payablesSubgroup = await prisma.subgroup.findFirst({
              where: { code: '301' },
            });

            if (payablesSubgroup) {
              mainPayableAccount = await prisma.account.findFirst({
                where: {
                  subgroupId: payablesSubgroup.id,
                  OR: [
                    { name: supplier.name || '' },
                    { name: supplier.companyName || '' },
                  ],
                },
                include: {
                  subgroup: {
                    include: {
                      mainGroup: true,
                    },
                  },
                },
              });
            }
          }
        }

        if (!mainPayableAccount) {
          mainPayableAccount = await prisma.account.findFirst({
            where: {
              OR: [
                { code: '301001' },
                { name: 'Accounts Payable' },
              ],
              status: 'Active',
            },
            include: {
              subgroup: {
                include: {
                  mainGroup: true,
                },
              },
            },
          });
        }

        if (inventoryAccount && mainPayableAccount) {
          // Generate voucher number first (format: JV4800 - 4 digits, no year prefix)
          const lastVoucher = await prisma.voucher.findFirst({
            where: {
              type: 'journal',
              voucherNumber: {
                startsWith: 'JV',
              },
            },
            orderBy: {
              voucherNumber: 'desc',
            },
          });

          let jvNumber = 1;
          if (lastVoucher) {
            const match = lastVoucher.voucherNumber.match(/^JV(\d+)$/);
            if (match) {
              jvNumber = parseInt(match[1]) + 1;
            } else {
              // Fallback: count all journal vouchers
              const voucherCount = await prisma.voucher.count({
                where: { type: 'journal' },
              });
              jvNumber = voucherCount + 1;
            }
          }
          const voucherNumber = `JV${String(jvNumber).padStart(4, '0')}`;
          const entryNo = voucherNumber; // Use same number for journal entry

          // Build journal lines with proper descriptions
          const journalLines: Array<{ accountId: string; description: string; debit: number; credit: number; lineOrder: number }> = [];
          
          // Entry 1: Debit Inventory Account - with detailed item description
          if (itemsTotal > 0) {
            // Fetch updated order with items to get part details
            const updatedOrder = await prisma.directPurchaseOrder.findUnique({
              where: { id: order.id },
              include: {
                items: {
                  include: {
                    part: {
                      include: {
                        brand: true,
                      },
                    },
                  },
                },
              },
            });

            const itemDetails = updatedOrder?.items.map((orderItem: any) => {
              const part = orderItem.part;
              const partNo = part?.partNo || 'N/A';
              const description = part?.description || 'Item';
              const brand = part?.brand?.name || '';
              const qty = orderItem.quantity;
              const rate = orderItem.purchasePrice;
              const cost = orderItem.amount;
              
              return `${partNo}${brand ? '/' + brand : ''}/${description}/, Qty ${qty}, Rate ${rate}, Cost: ${cost}`;
            }).join(', ') || `DPO: ${order.dpoNumber} Inventory purchased`;
            
            journalLines.push({
              accountId: inventoryAccount.id,
              description: `DPO: ${order.dpoNumber} Inventory Added, ${itemDetails}`,
              debit: itemsTotal,
              credit: 0,
              lineOrder: 0,
            });
          }

          // Lines for expenses
          const finalExpenses = expenses || order.expenses || [];
          if (finalExpenses.length > 0) {
            for (let i = 0; i < finalExpenses.length; i++) {
              const exp = finalExpenses[i];
              const expAmount = exp.amount || 0;
              if (expAmount > 0 && exp.payable_account) {
                const expensePayableAccount = await prisma.account.findFirst({
                  where: {
                    name: exp.payable_account,
                    status: 'Active',
                  },
                  include: {
                    subgroup: {
                      include: {
                        mainGroup: true,
                      },
                    },
                  },
                });

                if (expensePayableAccount) {
                  journalLines.push({
                    accountId: inventoryAccount.id,
                    description: `DPO: ${order.dpoNumber} - ${exp.expense_type || exp.expenseType || 'Expense'}`,
                    debit: expAmount,
                    credit: 0,
                    lineOrder: journalLines.length,
                  });

                  journalLines.push({
                    accountId: expensePayableAccount.id,
                    description: `DPO: ${order.dpoNumber} - ${exp.expense_type || exp.expenseType || 'Expense'} Payable`,
                    debit: 0,
                    credit: expAmount,
                    lineOrder: journalLines.length,
                  });
                }
              }
            }
          }

          // Entry 2: Credit Supplier Payable Account (Main entry - supplier liability)
          if (itemsTotal > 0) {
            journalLines.push({
              accountId: mainPayableAccount.id,
              description: `DPO: ${order.dpoNumber} ${supplierAccountName} Liability Created`,
              debit: 0,
              credit: itemsTotal,
              lineOrder: journalLines.length,
            });
          }

          // Calculate totals
          const totalDebit = journalLines.reduce((sum, line) => sum + line.debit, 0);
          const totalCredit = journalLines.reduce((sum, line) => sum + line.credit, 0);

          // Create journal entry
          if (journalLines.length > 0 && totalDebit === totalCredit) {
            const journalEntry = await prisma.journalEntry.create({
              data: {
                entryNo,
                entryDate: new Date(date || order.date),
                reference: `DPO-${order.dpoNumber}`,
                description: `Direct Purchase Order ${order.dpoNumber}${description || order.description ? `: ${description || order.description}` : ''}`,
                totalDebit,
                totalCredit,
                status: 'posted',
                createdBy: 'System',
                postedBy: 'System',
                postedAt: new Date(),
                lines: {
                  create: journalLines,
                },
              },
              include: {
                lines: {
                  include: {
                    account: {
                      include: {
                        subgroup: {
                          include: {
                            mainGroup: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            });

            // Update account balances
            for (const line of journalEntry.lines) {
              const accountType = line.account.subgroup.mainGroup.type.toLowerCase();
              const balanceChange = (accountType === 'asset' || accountType === 'expense' || accountType === 'cost')
                ? (line.debit - line.credit)
                : (line.credit - line.debit);

              await prisma.account.update({
                where: { id: line.accountId },
                data: {
                  currentBalance: {
                    increment: balanceChange,
                  },
                },
              });
            }

            // Create Voucher
            try {

              const voucherEntries = [];
              for (const line of journalLines) {
                const account = await prisma.account.findUnique({
                  where: { id: line.accountId },
                  select: { code: true, name: true },
                });

                voucherEntries.push({
                  accountId: line.accountId,
                  accountName: account ? `${account.code}-${account.name}` : 'Account',
                  description: line.description || `Direct Purchase Order ${order.dpoNumber}`,
                  debit: line.debit,
                  credit: line.credit,
                  sortOrder: line.lineOrder,
                });
              }

              // Create voucher with supplier name in narration (exactly as shown in screenshot - just supplier name)
              const voucher = await prisma.voucher.create({
                data: {
                  voucherNumber,
                  type: 'journal',
                  date: new Date(date || order.date),
                  narration: supplierAccountName, // Just supplier name: "Abdullah Rehman" (not "Abdullah Rehman - DPO 15")
                  totalDebit: totalDebit,
                  totalCredit: totalCredit,
                  status: 'posted',
                  createdBy: 'System',
                  approvedBy: 'System',
                  approvedAt: new Date(),
                  entries: {
                    create: voucherEntries,
                  },
                },
              });

              
              // If account (bank/cash) is selected, automatically create PV voucher for payment
              // This means user is paying the supplier immediately
              // NOTE: PV voucher should only include items total (NOT expenses)
              const paymentAccount = account || order.account;
              if (paymentAccount && itemsTotal > 0 && finalSupplierId && mainPayableAccount) {
                try {
                  
                  // Get the cash/bank account that was selected
                  const cashBankAccount = await prisma.account.findUnique({
                    where: { id: paymentAccount },
                    include: {
                      subgroup: {
                        include: {
                          mainGroup: true,
                        },
                      },
                    },
                  });

                  if (!cashBankAccount) {
                  } else {
                    // Verify it's a Cash (101) or Bank (102) account
                    const subgroupCode = cashBankAccount.subgroup?.code || '';
                    const isCashOrBank = subgroupCode === '101' || subgroupCode === '102';
                    
                    if (!isCashOrBank) {
                      const accountType = cashBankAccount.subgroup?.mainGroup?.type?.toLowerCase() || '';
                      if (accountType !== 'asset') {
                      } else {
                        // Allow if it's an asset account even if not 101/102
                      }
                    }
                    
                    // Only create PV if it's actually a cash/bank account, not inventory
                    if (isCashOrBank || cashBankAccount.subgroup?.mainGroup?.type?.toLowerCase() === 'asset') {
                      // Generate PV number (format: PV####)
                      const lastPV = await prisma.voucher.findFirst({
                        where: {
                          type: 'payment',
                          voucherNumber: {
                            startsWith: 'PV',
                          },
                        },
                        orderBy: {
                          voucherNumber: 'desc',
                        },
                      });

                      let pvNumber = 1;
                      if (lastPV) {
                        const match = lastPV.voucherNumber.match(/^PV(\d+)$/);
                        if (match) {
                          pvNumber = parseInt(match[1]) + 1;
                        } else {
                          const voucherCount = await prisma.voucher.count({
                            where: { type: 'payment' },
                          });
                          pvNumber = voucherCount + 1;
                        }
                      }
                      const pvVoucherNumber = `PV${String(pvNumber).padStart(4, '0')}`;

                      // Create Payment Voucher (using itemsTotal only, NOT expenses)
                      // Debit Supplier Payable (decreases liability) and Credit Cash/Bank (decreases asset)
                      const paymentVoucher = await prisma.voucher.create({
                        data: {
                          voucherNumber: pvVoucherNumber,
                          type: 'payment',
                          date: new Date(date || order.date),
                          narration: supplierAccountName,
                          cashBankAccount: cashBankAccount.name,
                          totalDebit: itemsTotal, // Only items total, no expenses
                          totalCredit: itemsTotal, // Only items total, no expenses
                          status: 'posted',
                          createdBy: 'System',
                          approvedBy: 'System',
                          approvedAt: new Date(),
                          entries: {
                            create: [
                              {
                                accountId: mainPayableAccount.id,
                                accountName: `${mainPayableAccount.code}-${mainPayableAccount.name}`,
                                description: `Payment for DPO ${order.dpoNumber}`,
                                debit: itemsTotal, // Only items total
                                credit: 0,
                                sortOrder: 0,
                              },
                              {
                                accountId: cashBankAccount.id,
                                accountName: `${cashBankAccount.code}-${cashBankAccount.name}`,
                                description: `Payment made for DPO ${order.dpoNumber}`,
                                debit: 0,
                                credit: itemsTotal, // Only items total
                                sortOrder: 1,
                              },
                            ],
                          },
                        },
                      });

                      // Update account balances for PV voucher (using itemsTotal only)
                      // Debit Supplier Payable (decreases liability)
                      await prisma.account.update({
                        where: { id: mainPayableAccount.id },
                        data: {
                          currentBalance: {
                            decrement: itemsTotal, // Only items total
                          },
                        },
                      });

                      // Credit Cash/Bank (decreases asset)
                      await prisma.account.update({
                        where: { id: cashBankAccount.id },
                        data: {
                          currentBalance: {
                            decrement: itemsTotal, // Only items total
                          },
                        },
                      });

                    }
                  }
                } catch (pvError: any) {
                  // Don't fail DPO update if PV creation fails
                }
              } else if (!paymentAccount) {
              }
            } catch (voucherError: any) {
              // Don't fail the update if voucher creation fails
            }
          }
        }
        } catch (journalError: any) {
          // Don't fail the update if journal entry/voucher creation fails
        }
      }
    }

    // Update existing stock movements with rack/shelf when items are updated
    // This handles the case where locations are assigned after the DPO is already received
    if (items && items.length > 0 && (existingOrder.status === 'Received' || existingOrder.status === 'Completed')) {
      
      // Get current stock movements for this DPO
      const currentMovements = await prisma.stockMovement.findMany({
        where: {
          referenceType: 'direct_purchase',
          referenceId: order.id,
          type: 'in',
        },
      });
      
      if (currentMovements.length > 0) {
        // Update each movement with the new rack/shelf from the corresponding item
        for (const item of items) {
          const partId = item.part_id || item.partId;
          const rackId = item.rack_id || item.rackId || null;
          const shelfId = item.shelf_id || item.shelfId || null;
          
          if (partId && (rackId || shelfId)) {
            // Find matching movement(s) for this part
            const matchingMovements = currentMovements.filter(m => m.partId === partId);
            
            for (const movement of matchingMovements) {
              // Only update if location has changed
              if (movement.rackId !== rackId || movement.shelfId !== shelfId) {
                await prisma.stockMovement.update({
                  where: { id: movement.id },
                  data: {
                    rackId: rackId,
                    shelfId: shelfId,
                  },
                });
              }
            }
          }
        }
      }
    }

    // ⭐ FINAL STEP: UPDATE PART MASTER COST TO LANDED COST (AFTER ALL OPERATIONS)
    // This ensures Part.cost matches the "Cost Price (includes distributed expenses)" shown in Purchase History
    // This MUST happen at the very end to prevent any later code from overwriting it
    if (receiveResult && receiveResult.items && receiveResult.items.length > 0) {
      
      for (const resultItem of receiveResult.items) {
        try {
          // Verify partId exists (from DPO item foreign key, not lookup by partNo)
          if (!resultItem.partId) {
            continue;
          }

          // Get part info before update for logging
          const partBefore = await prisma.part.findUnique({
            where: { id: resultItem.partId },
            select: { partNo: true, cost: true, costSource: true, costSourceRef: true },
          });

          if (!partBefore) {
            continue;
          }

          const oldCost = partBefore.cost || 0;
          const partNo = partBefore.partNo || 'unknown';
          
          
          // Update to landed cost
          
          const updateStartTime = Date.now();
          const updatedPart = await prisma.part.update({
            where: { id: resultItem.partId },
            data: {
              cost: resultItem.landedCost, // Use landed cost, not weighted average
              costSource: 'DPO_RECEIVED',
              costSourceRef: order.dpoNumber,
              costUpdatedAt: new Date(),
            },
            select: { partNo: true, cost: true, costSource: true, costSourceRef: true, costUpdatedAt: true },
          });
          const updateEndTime = Date.now();
          
          
          // Track for response
          updatedParts.push({
            partNo: updatedPart.partNo,
            oldCost: oldCost,
            newCost: updatedPart.cost || 0,
            partIdUpdated: resultItem.partId,
          });
          
          // 🔍 HARD VERIFICATION 1: Read back by partId
          const verifyPartById = await prisma.part.findUnique({
            where: { id: resultItem.partId },
            select: { 
              partNo: true, 
              cost: true, 
              costSource: true, 
              costSourceRef: true,
              costUpdatedAt: true,
            },
          });
          
          
          const costMatchesById = verifyPartById && Math.abs((verifyPartById.cost || 0) - resultItem.landedCost) < 0.01;
          if (costMatchesById) {
          } else {
          }
          
          // 🔍 HARD VERIFICATION 2: Read back by partNo with API ordering (same as /api/parts)
          const partsByPartNo = await prisma.part.findMany({
            where: { partNo: partNo },
            select: { 
              id: true,
              partNo: true, 
              cost: true, 
              costSource: true, 
              costSourceRef: true,
              costUpdatedAt: true,
              updatedAt: true,
            },
            orderBy: [
              { costUpdatedAt: 'desc' }, // Same ordering as /api/parts
              { updatedAt: 'desc' },
              { createdAt: 'desc' },
            ],
          });
          
          if (partsByPartNo.length > 0) {
            const apiWillReturn = partsByPartNo[0];
            
            if (apiWillReturn.id !== resultItem.partId) {
            }
            
            const costMatchesApi = Math.abs((apiWillReturn.cost || 0) - resultItem.landedCost) < 0.01;
            if (costMatchesApi) {
            } else {
            }
          } else {
          }
          
        } catch (partUpdateError: any) {
          // Don't fail the entire request if cost update fails
        }
      }
    }

    // 🔍 EXIT MARKER
    const exitMarker = `EXIT:DPO_RECEIVE:${id}`;

    // Build response with debugging info (only in dev)
    const response: any = {
      id: order.id,
      dpo_no: order.dpoNumber,
      date: order.date,
      status: order.status,
      total_amount: order.totalAmount,
      items_count: order.items.length,
    };

    // Add debugging info in development
    if (process.env.NODE_ENV !== 'production') {
      response.updatedParts = updatedParts;
    }

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete direct purchase order
// Create Payment Voucher for supplier payment
router.post('/direct-purchase-orders/:dpoId/payment', async (req: Request, res: Response) => {
  try {
    const { dpoId } = req.params;
    const { amount, cashBankAccountId, paymentDate, description } = req.body;

    // Get DPO
    const dpo = await prisma.directPurchaseOrder.findUnique({
      where: { id: dpoId },
    });

    if (!dpo || !dpo.supplierId) {
      return res.status(400).json({ error: 'Direct Purchase Order not found or has no supplier' });
    }

    // Fetch supplier separately
    const supplier = await prisma.supplier.findUnique({
      where: { id: dpo.supplierId },
    });

    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount is required and must be greater than 0' });
    }

    // Get supplier account (should already exist)
    const payablesSubgroup = await prisma.subgroup.findFirst({
      where: { code: '301' },
    });

    if (!payablesSubgroup) {
      return res.status(400).json({ error: 'Supplier Payables subgroup not found' });
    }

    const supplierAccount = await prisma.account.findFirst({
      where: {
        subgroupId: payablesSubgroup.id,
        OR: [
          { name: supplier.companyName || '' },
          { name: supplier.name || '' },
        ],
      },
    });

    if (!supplierAccount) {
      return res.status(400).json({ error: 'Supplier account not found. Please ensure supplier account exists.' });
    }

    // Get cash/bank account (current asset)
    const cashBankAccount = await prisma.account.findUnique({
      where: { id: cashBankAccountId },
      include: {
        subgroup: {
          include: {
            mainGroup: true,
          },
        },
      },
    });

    if (!cashBankAccount) {
      return res.status(400).json({ error: 'Cash/Bank account not found' });
    }

    // Verify it's a Cash (101) or Bank (102) account
    const subgroupCode = cashBankAccount.subgroup?.code || '';
    const isCashOrBank = subgroupCode === '101' || subgroupCode === '102';
    
    if (!isCashOrBank) {
      // If not cash/bank by subgroup code, check mainGroup type as fallback
      const accountType = cashBankAccount.subgroup?.mainGroup?.type?.toLowerCase() || '';
      if (accountType !== 'asset') {
        return res.status(400).json({ error: 'Selected account must be a Cash (subgroup 101) or Bank (subgroup 102) account' });
      }
    }

    // Generate PV number (format: PV3116 - 4 digits)
    const lastPV = await prisma.voucher.findFirst({
      where: {
        type: 'payment',
        voucherNumber: {
          startsWith: 'PV',
        },
      },
      orderBy: {
        voucherNumber: 'desc',
      },
    });

    let pvNumber = 1;
    if (lastPV) {
      const match = lastPV.voucherNumber.match(/^PV(\d+)$/);
      if (match) {
        pvNumber = parseInt(match[1]) + 1;
      } else {
        // Fallback: count all payment vouchers
        const voucherCount = await prisma.voucher.count({
          where: { type: 'payment' },
        });
        pvNumber = voucherCount + 1;
      }
    }
    const voucherNumber = `PV${String(pvNumber).padStart(4, '0')}`;

    // Create Payment Voucher
    const paymentVoucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        type: 'payment',
        date: paymentDate ? new Date(paymentDate) : new Date(),
        narration: supplier.companyName || supplier.name || 'Supplier Payment',
        cashBankAccount: cashBankAccount.name,
        totalDebit: amount,
        totalCredit: amount,
        status: 'posted',
        createdBy: 'System',
        approvedBy: 'System',
        approvedAt: new Date(),
        entries: {
          create: [
            {
              accountId: supplierAccount.id,
              accountName: `${supplierAccount.code}-${supplierAccount.name}`,
              description: description || `Payment for DPO ${dpo.dpoNumber}`,
              debit: amount,
              credit: 0,
              sortOrder: 0,
            },
            {
              accountId: cashBankAccount.id,
              accountName: `${cashBankAccount.code}-${cashBankAccount.name}`,
              description: description || `Payment made`,
              debit: 0,
              credit: amount,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    // Update account balances
    // Debit Supplier (decreases liability)
    await prisma.account.update({
      where: { id: supplierAccount.id },
      data: {
        currentBalance: {
          decrement: amount, // Liability decreases with debit
        },
      },
    });

    // Credit Cash/Bank (decreases asset)
    await prisma.account.update({
      where: { id: cashBankAccount.id },
      data: {
        currentBalance: {
          decrement: amount, // Asset decreases with credit
        },
      },
    });

    res.status(201).json({
      data: {
        id: paymentVoucher.id,
        voucherNumber: paymentVoucher.voucherNumber,
        amount,
        supplier: supplierAccount.name,
        cashBankAccount: cashBankAccount.name,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/direct-purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.directPurchaseOrder.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Direct purchase order not found' });
    }

    // Delete associated stock movements
    await prisma.stockMovement.deleteMany({
      where: {
        referenceType: 'direct_purchase',
        referenceId: id,
      },
    });

    // Delete order (items and expenses will be deleted via cascade)
    await prisma.directPurchaseOrder.delete({ where: { id } });

    res.json({ message: 'Direct purchase order deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reserve stock for a part (general reservation, not tied to invoice)
// Note: Reserved stock is tracked separately and does not affect stock in/out calculations
router.post('/stock/reserve', async (req: Request, res: Response) => {
  try {
    const { partId, quantity } = req.body;

    if (!partId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'partId and quantity (greater than 0) are required' });
    }

    // Check if part exists
    const part = await prisma.part.findUnique({
      where: { id: partId },
    });

    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    // Get current stock (excluding reservations) - for informational purposes only
    // Note: We allow reservations regardless of current stock since reserved stock
    // doesn't affect stock in/out calculations and can be used for future planning
    const movements = await prisma.stockMovement.findMany({
      where: { 
        partId,
        OR: [
          { referenceType: null },
          { referenceType: { not: 'stock_reservation' } }
        ]
      },
    });

    const stockIn = movements
      .filter(m => m.type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);
    const stockOut = movements
      .filter(m => m.type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);
    const currentStock = stockIn - stockOut;

    // Get existing general reservations (stock_reservation type) - for informational purposes
    const existingReservations = await prisma.stockMovement.findMany({
      where: {
        partId,
        referenceType: 'stock_reservation',
      },
    });
    const totalReserved = existingReservations.reduce((sum, r) => sum + r.quantity, 0);
    
    // Allow reservations regardless of current stock
    // Reserved stock is tracked separately and doesn't affect stock calculations

    // Create a stock reservation entry
    // Using StockMovement with special referenceType to track reservations separately
    // This won't affect normal stock in/out calculations when filtered properly
    
    const reservation = await prisma.stockMovement.create({
      data: {
        partId: partId,
        type: 'out', // Type is 'out' but marked as reservation
        quantity: parseInt(quantity),
        referenceType: 'stock_reservation',
        referenceId: `reserve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notes: `Stock reserved - ${quantity} units (does not affect stock calculations)`,
      },
      include: {
        part: {
          include: {
            brand: true,
          },
        },
      },
    });

    
    // Verify it was saved by immediately querying it back
    const verifyReservation = await prisma.stockMovement.findUnique({
      where: { id: reservation.id },
    });
    
    if (verifyReservation) {
    } else {
    }

    res.status(201).json({
      id: reservation.id,
      partId: reservation.partId,
      partNo: reservation.part.partNo,
      quantity: reservation.quantity,
      reservedAt: reservation.createdAt,
      message: `${quantity} units reserved successfully`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

