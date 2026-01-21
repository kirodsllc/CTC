import express, { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

// Get all master part numbers
router.get('/master-parts', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    const where = search
      ? { masterPartNo: { contains: search as string } }
      : {};

    // Fetch ALL master parts without any limit
    const masterParts = await prisma.masterPart.findMany({
      where,
      select: { masterPartNo: true },
      orderBy: { masterPartNo: 'asc' },
      // Explicitly no limit - get all records
    });

    console.log(`Fetched ${masterParts.length} master parts`);
    res.json(masterParts.map((mp) => mp.masterPartNo));
  } catch (error: any) {
    console.error('Error fetching master parts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all brands
router.get('/brands', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    const where: any = { status: 'active' };
    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll filter in memory if needed
      where.name = { contains: search as string };
    }

    const brands = await prisma.brand.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 50,
    });

    res.json(brands);
  } catch (error: any) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    const where: any = { status: 'active' };
    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll filter in memory if needed
      where.name = { contains: search as string };
    }

    const categories = await prisma.category.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subcategories by category
router.get('/subcategories', async (req: Request, res: Response) => {
  try {
    const { category_id, search } = req.query;
    
    const where: any = { status: 'active' };
    if (category_id) {
      where.categoryId = category_id as string;
    }
    if (search) {
      // SQLite doesn't support case-insensitive mode
      where.name = { contains: search as string };
    }

    const subcategories = await prisma.subcategory.findMany({
      where,
      select: { id: true, name: true, categoryId: true },
      orderBy: { name: 'asc' },
    });

    res.json(subcategories);
  } catch (error: any) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get applications by subcategory
router.get('/applications', async (req: Request, res: Response) => {
  try {
    const { subcategory_id, search } = req.query;
    
    const where: any = { status: 'active' };
    if (subcategory_id) {
      where.subcategoryId = subcategory_id as string;
    }
    if (search) {
      // SQLite doesn't support case-insensitive mode
      where.name = { contains: search as string };
    }

    const applications = await prisma.application.findMany({
      where,
      select: { id: true, name: true, subcategoryId: true },
      orderBy: { name: 'asc' },
    });

    res.json(applications);
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all applications (with status filter for attributes page)
router.get('/applications/all', async (req: Request, res: Response) => {
  try {
    const { search, status, subcategory_id } = req.query;
    
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }
    if (subcategory_id && subcategory_id !== 'all') {
      where.subcategoryId = subcategory_id as string;
    }
    if (search) {
      where.name = { contains: search as string };
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        subcategory: {
          select: { name: true, category: { select: { name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      applications.map((app) => ({
        id: app.id,
        name: app.name,
        subcategoryId: app.subcategoryId,
        subcategoryName: app.subcategory.name,
        categoryName: app.subcategory.category.name,
        status: app.status === 'active' ? 'Active' : 'Inactive',
        createdAt: app.createdAt,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching all applications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create application
router.post('/applications', async (req: Request, res: Response) => {
  try {
    const { name, subcategory_id, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Application name is required' });
    }
    if (!subcategory_id) {
      return res.status(400).json({ error: 'Subcategory is required' });
    }

    const application = await prisma.application.create({
      data: {
        name: name.trim(),
        subcategoryId: subcategory_id,
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        subcategory: {
          select: { name: true, category: { select: { name: true } } },
        },
      },
    });

    res.status(201).json({
      id: application.id,
      name: application.name,
      subcategoryId: application.subcategoryId,
      subcategoryName: application.subcategory.name,
      categoryName: application.subcategory.category.name,
      status: application.status === 'active' ? 'Active' : 'Inactive',
      createdAt: application.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Application with this name already exists in this subcategory' });
    }
    console.error('Error creating application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update application
router.put('/applications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subcategory_id, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Application name is required' });
    }
    if (!subcategory_id) {
      return res.status(400).json({ error: 'Subcategory is required' });
    }

    const application = await prisma.application.update({
      where: { id },
      data: {
        name: name.trim(),
        subcategoryId: subcategory_id,
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        subcategory: {
          select: { name: true, category: { select: { name: true } } },
        },
      },
    });

    res.json({
      id: application.id,
      name: application.name,
      subcategoryId: application.subcategoryId,
      subcategoryName: application.subcategory.name,
      categoryName: application.subcategory.category.name,
      status: application.status === 'active' ? 'Active' : 'Inactive',
      createdAt: application.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Application with this name already exists in this subcategory' });
    }
    console.error('Error updating application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete application
router.delete('/applications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if application has parts
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        _count: {
          select: { parts: true },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application._count.parts > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete application with associated parts. Please remove or reassign the parts first.' 
      });
    }

    await prisma.application.delete({
      where: { id },
    });

    res.json({ message: 'Application deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parts by master part number (for part number dropdown)
router.get('/parts', async (req: Request, res: Response) => {
  try {
    const { master_part_no, search } = req.query;
    
    const where: any = { status: 'active' };
    
    if (master_part_no) {
      where.masterPart = {
        masterPartNo: master_part_no as string,
      };
    }

    if (search) {
      where.OR = [
        { partNo: { contains: search as string } },
        { description: { contains: search as string } },
        { brand: { name: { contains: search as string } } },
      ];
    }

    const parts = await prisma.part.findMany({
      where,
      select: {
        id: true,
        partNo: true,
        description: true,
        brand: { select: { name: true } },
        masterPart: { select: { masterPartNo: true } },
      },
      orderBy: { partNo: 'asc' },
      take: 50,
    });

    res.json(
      parts.map((p) => ({
        id: p.id,
        part_no: p.partNo,
        description: p.description,
        brand_name: p.brand?.name || null,
        master_part_no: p.masterPart?.masterPartNo || null,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching parts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== CATEGORIES CRUD ==========

// Get all categories (with status filter for attributes page)
router.get('/categories/all', async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }
    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll filter in memory if needed
      where.name = { contains: search as string };
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { subcategories: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        status: cat.status === 'active' ? 'Active' : 'Inactive',
        subcategoryCount: cat._count.subcategories,
        createdAt: cat.createdAt,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching all categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        _count: {
          select: { subcategories: true },
        },
      },
    });

    res.status(201).json({
      id: category.id,
      name: category.name,
      status: category.status === 'active' ? 'Active' : 'Inactive',
      subcategoryCount: category._count.subcategories,
      createdAt: category.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        _count: {
          select: { subcategories: true },
        },
      },
    });

    res.json({
      id: category.id,
      name: category.name,
      status: category.status === 'active' ? 'Active' : 'Inactive',
      subcategoryCount: category._count.subcategories,
      createdAt: category.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Category not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has subcategories
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subcategories: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category._count.subcategories > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with subcategories. Please delete all subcategories first.' 
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SUBCATEGORIES CRUD ==========

// Get all subcategories (with status filter for attributes page)
router.get('/subcategories/all', async (req: Request, res: Response) => {
  try {
    const { search, status, category_id } = req.query;
    
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }
    if (category_id && category_id !== 'all') {
      where.categoryId = category_id as string;
    }
    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll filter in memory if needed
      where.name = { contains: search as string };
    }

    const subcategories = await prisma.subcategory.findMany({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        categoryName: sub.category.name,
        status: sub.status === 'active' ? 'Active' : 'Inactive',
        createdAt: sub.createdAt,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching all subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subcategory
router.post('/subcategories', async (req: Request, res: Response) => {
  try {
    const { name, category_id, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subcategory name is required' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name: name.trim(),
        categoryId: category_id,
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      categoryName: subcategory.category.name,
      status: subcategory.status === 'active' ? 'Active' : 'Inactive',
      createdAt: subcategory.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Subcategory with this name already exists in this category' });
    }
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subcategory
router.put('/subcategories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category_id, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subcategory name is required' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        name: name.trim(),
        categoryId: category_id,
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    res.json({
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      categoryName: subcategory.category.name,
      status: subcategory.status === 'active' ? 'Active' : 'Inactive',
      createdAt: subcategory.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Subcategory with this name already exists in this category' });
    }
    console.error('Error updating subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete subcategory
router.delete('/subcategories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if subcategory has parts
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { parts: true },
        },
      },
    });

    if (!subcategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    if (subcategory._count.parts > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete subcategory with associated parts. Please remove or reassign the parts first.' 
      });
    }

    await prisma.subcategory.delete({
      where: { id },
    });

    res.json({ message: 'Subcategory deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== BRANDS CRUD ==========

// Get all brands (with status filter for attributes page)
router.get('/brands/all', async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as string;
    }
    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll filter in memory if needed
      where.name = { contains: search as string };
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(
      brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        status: brand.status === 'active' ? 'Active' : 'Inactive',
        createdAt: brand.createdAt,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching all brands:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create brand
router.post('/brands', async (req: Request, res: Response) => {
  try {
    const { name, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
    });

    res.status(201).json({
      id: brand.id,
      name: brand.name,
      status: brand.status === 'active' ? 'Active' : 'Inactive',
      createdAt: brand.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Brand with this name already exists' });
    }
    console.error('Error creating brand:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update brand
router.put('/brands/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: name.trim(),
        status: status === 'Inactive' ? 'inactive' : 'active',
      },
    });

    res.json({
      id: brand.id,
      name: brand.name,
      status: brand.status === 'active' ? 'Active' : 'Inactive',
      createdAt: brand.createdAt,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Brand not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Brand with this name already exists' });
    }
    console.error('Error updating brand:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete brand
router.delete('/brands/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if brand has parts
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { parts: true },
        },
      },
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    if (brand._count.parts > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete brand with associated parts. Please remove or reassign the parts first.' 
      });
    }

    await prisma.brand.delete({
      where: { id },
    });

    res.json({ message: 'Brand deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
