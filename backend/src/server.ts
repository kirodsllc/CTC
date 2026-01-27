import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports that might use DATABASE_URL
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, override: true });

// Set timezone to Pakistan (Asia/Karachi)
process.env.TZ = 'Asia/Karachi';
import partsRoutes from './routes/parts';
import dropdownsRoutes from './routes/dropdowns';
import inventoryRoutes from './routes/inventory';
import expensesRoutes from './routes/expenses';
import accountingRoutes from './routes/accounting';
import financialRoutes from './routes/financial';
import customersRoutes from './routes/customers';
import suppliersRoutes from './routes/suppliers';
import reportsRoutes from './routes/reports';
import usersRoutes from './routes/users';
import rolesRoutes from './routes/roles';
import activityLogsRoutes from './routes/activity-logs';
import approvalFlowsRoutes from './routes/approval-flows';
import backupsRoutes from './routes/backups';
import companyProfileRoutes from './routes/company-profile';
import whatsappSettingsRoutes from './routes/whatsapp-settings';
import longcatSettingsRoutes from './routes/longcat-settings';
import kitsRoutes from './routes/kits';
import vouchersRoutes from './routes/vouchers';
import salesRoutes from './routes/sales';
import dpoReturnsRoutes from './routes/dpo-returns';
import salesReturnsRoutes from './routes/sales-returns';
import advancedSearchRoutes from './routes/advanced-search';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware - CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check explicit allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // For development, allow all localhost origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // In production, allow requests from same origin (when served through Nginx)
    // This allows the frontend served from the same domain to access the API
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      // Get server origin from environment or default
      const serverOrigin = process.env.SERVER_ORIGIN || 'http://103.60.12.157';
      const serverHost = new URL(serverOrigin).hostname;

      // Extract hostname from origin
      try {
        const originUrl = new URL(origin);
        const originHost = originUrl.hostname;

        // Allow if hostname matches (regardless of protocol http/https)
        if (originHost === serverHost || originHost.includes(serverHost) || serverHost.includes(originHost)) {
          return callback(null, true);
        }

        // Also allow if origin contains the server IP
        if (origin.includes('103.60.12.157') || origin.includes(serverHost)) {
          return callback(null, true);
        }
      } catch (e) {
        // If URL parsing fails, try string matching
        if (origin.includes(serverHost) || origin.includes('103.60.12.157')) {
          return callback(null, true);
        }
      }

      // Log CORS rejection for debugging
      return callback(new Error('Not allowed by CORS'));
    }

    // In development, be more permissive
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
}));
// Middleware to normalize API routes (handle with/without trailing slash without redirecting)
app.use((req, res, next) => {
  // Only apply to API routes
  if (req.path.startsWith('/api')) {
    // Normalize path by removing trailing slash (except for root /api)
    if (req.path !== '/api' && req.path.endsWith('/') && req.path.length > 4) {
      req.url = req.path.slice(0, -1) + (req.url.includes('?') ? req.url.substring(req.path.length) : '');
    }
  }
  next();
});

// Increase body parser limit to handle image uploads (base64 encoded images can be large)
// Base64 encoding increases size by ~33%, so 100mb allows for larger images even after compression
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Inventory ERP Backend API is running' });
});

// Health check (API-prefixed alias for deployment/tests)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Inventory ERP Backend API is running' });
});

// Version endpoint for deployment verification
app.get('/api/debug/version', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const packagePath = path.join(__dirname, '../package.json');
    let version = 'unknown';
    let buildTime = 'unknown';

    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      version = packageJson.version || 'unknown';
    }

    // Try to get git commit hash
    try {
      const { execSync } = require('child_process');
      const gitHash = execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' }).trim();
      version = `${version}-${gitHash.substring(0, 7)}`;
    } catch (e) {
      // Git not available, use build time
      buildTime = new Date().toISOString();
    }

    res.json({
      version,
      buildTime: buildTime !== 'unknown' ? buildTime : new Date().toISOString(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.json({
      version: 'unknown',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint to show database info
app.get('/api/debug/db-info', async (req, res) => {
  try {
    const fs = require('fs');
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const dbPath = dbUrl.replace('file:', '');
    const fileExists = fs.existsSync(dbPath);

    // Get voucher counts
    const prisma = (await import('./config/database')).default;
    const voucherCount = await prisma.voucher.count();
    const lastVouchers = await prisma.voucher.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { voucherNumber: true, type: true, date: true },
    });

    res.json({
      cwd: process.cwd(),
      DATABASE_URL: dbUrl,
      sqliteFilePath: dbPath,
      fileExists,
      counts: {
        vouchers: voucherCount,
      },
      lastVouchers: lastVouchers.map(v => ({
        voucherNumber: v.voucherNumber,
        type: v.type,
        date: v.date,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check part cost
app.get('/api/debug/part-cost/:partNo', async (req, res) => {
  try {
    const { partNo } = req.params;
    const prisma = (await import('./config/database')).default;
    const { getCanonicalPartId } = await import('./services/partCanonical');

    // Get DATABASE_URL (masked)
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const maskedDbUrl = dbUrl.includes('file:')
      ? `file:${dbUrl.split('/').pop()}`
      : dbUrl.replace(/:[^:@]+@/, ':****@');

    // Get ALL parts with this partNo
    const allParts = await prisma.part.findMany({
      where: { partNo },
      select: {
        id: true,
        partNo: true,
        cost: true,
        costSource: true,
        costSourceRef: true,
        costUpdatedAt: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: [
        { costUpdatedAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (!allParts || allParts.length === 0) {
      return res.status(404).json({
        error: `Part ${partNo} not found`,
        databaseUrlMasked: maskedDbUrl,
        allParts: [],
        canonicalPartId: null,
        pricingApiWillReturn: null,
      });
    }

    // Get canonical part ID using service
    const canonicalPartId = await getCanonicalPartId(prisma, partNo);

    // The exact row that Pricing API would return (canonical part)
    const pricingApiWillReturn = allParts.find(p => p.id === canonicalPartId) || allParts[0];

    res.json({
      requestedPartNo: partNo,
      databaseUrlMasked: maskedDbUrl,
      allParts: allParts.map(part => ({
        id: part.id,
        partNo: part.partNo,
        cost: part.cost,
        costSource: part.costSource,
        costSourceRef: part.costSourceRef,
        costUpdatedAt: part.costUpdatedAt,
        updatedAt: part.updatedAt,
        createdAt: part.createdAt,
        isCanonical: part.id === canonicalPartId,
      })),
      canonicalPartId,
      pricingApiWillReturn: {
        id: pricingApiWillReturn.id,
        partNo: pricingApiWillReturn.partNo,
        cost: pricingApiWillReturn.cost,
        costSource: pricingApiWillReturn.costSource,
        costSourceRef: pricingApiWillReturn.costSourceRef,
        costUpdatedAt: pricingApiWillReturn.costUpdatedAt,
        updatedAt: pricingApiWillReturn.updatedAt,
        createdAt: pricingApiWillReturn.createdAt,
        note: 'This is the exact row that /api/parts and /api/parts/price-management will return (canonical part)',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Routes
app.use('/api/parts', partsRoutes);
app.use('/api/dropdowns', dropdownsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/approval-flows', approvalFlowsRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/whatsapp-settings', whatsappSettingsRoutes);
app.use('/api/longcat-settings', longcatSettingsRoutes);
app.use('/api/kits', kitsRoutes);
app.use('/api/vouchers', vouchersRoutes);
// Legacy/compat alias (some clients call this path directly)
app.use('/api/getVouchers', vouchersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dpo-returns', dpoReturnsRoutes);
app.use('/api/sales-returns', salesReturnsRoutes);
app.use('/api/advanced-search', advancedSearchRoutes);

// Trigger restart

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Balance Sheet endpoint: http://localhost:${PORT}/api/accounting/balance-sheet`);
});

