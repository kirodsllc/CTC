import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from backend directory specifically (override any existing env vars)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

// Ensure DATABASE_URL is set and resolve to absolute path
const backendRoot = path.resolve(__dirname, '../..');

// Database isolation layer: Ensure Dev-Koncepts uses its own dedicated database
// This prevents conflicts with other databases (e.g., nextapp)
// CRITICAL: Dev-Koncepts MUST use its own database, regardless of .env settings
const DEV_KONCEPTS_DB_NAME = 'dev-koncepts.db';
const devKonceptsDbPath = path.resolve(backendRoot, `prisma/${DEV_KONCEPTS_DB_NAME}`);

// Verify we're in Dev-Koncepts project (safety check)
const projectRoot = path.resolve(backendRoot, '../..');
if (!backendRoot.includes('Dev-Koncepts')) {
  console.warn(`⚠️  WARNING: Backend root doesn't contain 'Dev-Koncepts': ${backendRoot}`);
}

// STRONG ENFORCEMENT: Always use dev-koncepts.db for Dev-Koncepts project
// This overrides ANY .env file settings to prevent database conflicts
const originalDbUrl = process.env.DATABASE_URL || '';

// ALWAYS use dev-koncepts.db - no exceptions, no matter what .env says
const enforcedDbUrl = `file:${devKonceptsDbPath}`;

// If .env had a different database, log a warning but always override
if (originalDbUrl && !originalDbUrl.includes(DEV_KONCEPTS_DB_NAME)) {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`⚠️  DATABASE ISOLATION ENFORCEMENT`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`   Original DATABASE_URL from .env: ${originalDbUrl}`);
  console.log(`   OVERRIDDEN to Dev-Koncepts database: ${enforcedDbUrl}`);
  console.log(`   Reason: Dev-Koncepts MUST use its own isolated database`);
  console.log(`   This prevents conflicts with nextapp database`);
  console.log(`═══════════════════════════════════════════════════════════`);
}

// CRITICAL: ALWAYS enforce the Dev-Koncepts database regardless of .env
// This is the key layer that prevents database conflicts
process.env.DATABASE_URL = enforcedDbUrl;

// Ensure prisma directory exists for Dev-Koncepts database
const prismaDir = path.resolve(backendRoot, 'prisma');
if (!fs.existsSync(prismaDir)) {
  fs.mkdirSync(prismaDir, { recursive: true });
  console.log(`✅ Created prisma directory: ${prismaDir}`);
}

// Ensure Dev-Koncepts database file exists (Prisma will initialize it if needed)
const finalDbPath = process.env.DATABASE_URL?.replace('file:', '') || devKonceptsDbPath;
if (!fs.existsSync(finalDbPath)) {
  // Touch the file - Prisma migrations will create the schema
  fs.writeFileSync(finalDbPath, '');
  console.log(`✅ Created Dev-Koncepts database file: ${finalDbPath}`);
}

// Log database info at startup (once)
if (!process.env.DB_INFO_LOGGED) {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || 'unknown';
  const fileExists = fs.existsSync(dbPath);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DEV-KONCEPTS DATABASE CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Project: Dev-Koncepts (isolated database)`);
  console.log(`  Database: ${DEV_KONCEPTS_DB_NAME}`);
  console.log(`  process.cwd(): ${process.cwd()}`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`  SQLite file: ${dbPath}`);
  console.log(`  File exists: ${fileExists ? 'YES' : 'NO'}`);
  console.log('═══════════════════════════════════════════════════════════');
  process.env.DB_INFO_LOGGED = '1';
}

// Validate DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl.startsWith('file:')) {
  throw new Error(`DATABASE_URL must start with 'file:' protocol. Current value: ${databaseUrl}`);
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
