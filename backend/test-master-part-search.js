const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMasterPartSearch() {
  console.log('🔍 TESTING MASTER PART SEARCH\n');
  console.log('='  .repeat(80));
  
  // 1. Find all MasterPart entries with masterPartNo "Pakistan"
  console.log('\n1️⃣  MasterPart entries with masterPartNo = "Pakistan":');
  console.log('-'.repeat(80));
  
  const masterParts = await prisma.masterPart.findMany({
    where: {
      masterPartNo: { contains: 'Pakistan' }
    },
    include: {
      parts: {
        select: {
          id: true,
          partNo: true,
          description: true,
        }
      }
    }
  });
  
  console.log(`Found ${masterParts.length} MasterPart entries containing "Pakistan"\n`);
  masterParts.forEach((mp, i) => {
    console.log(`[${i + 1}]`, {
      id: mp.id,
      masterPartNo: `"${mp.masterPartNo}"`,
      length: mp.masterPartNo?.length || 0,
      partsCount: mp.parts.length,
      partNos: mp.parts.map(p => p.partNo).join(', ')
    });
  });
  
  // 2. Search for parts like the API does
  console.log('\n\n2️⃣  Parts matching search="Pakistan" (API simulation):');
  console.log('-'.repeat(80));
  
  const searchResults = await prisma.part.findMany({
    where: {
      OR: [
        { partNo: { contains: 'Pakistan' } },
        { description: { contains: 'Pakistan' } },
        { masterPart: { masterPartNo: { contains: 'Pakistan' } } },
      ]
    },
    include: {
      masterPart: true,
      brand: true,
    },
    take: 50
  });
  
  console.log(`Found ${searchResults.length} parts matching "Pakistan"\n`);
  searchResults.forEach((part, i) => {
    console.log(`[${i + 1}]`, {
      id: part.id,
      partNo: part.partNo,
      masterPartNo: `"${part.masterPart?.masterPartNo || 'NULL'}"`,
      description: part.description?.substring(0, 30) || 'NULL',
      brand: part.brand?.name || 'NULL',
    });
  });
  
  // 3. Group by masterPart masterPartNo
  console.log('\n\n3️⃣  Unique master part numbers from search results:');
  console.log('-'.repeat(80));
  
  const masterPartNos = [...new Set(searchResults
    .filter(p => p.masterPart?.masterPartNo)
    .map(p => p.masterPart.masterPartNo.trim())
  )];
  
  console.log(`Unique master part numbers: ${masterPartNos.length}\n`);
  masterPartNos.forEach((mpn, i) => {
    const count = searchResults.filter(p => p.masterPart?.masterPartNo?.trim() === mpn).length;
    console.log(`[${i + 1}] "${mpn}" (${count} parts)`);
  });
  
  // 4. Check for whitespace issues in MasterPart table
  console.log('\n\n4️⃣  Checking MasterPart table for whitespace/duplicate issues:');
  console.log('-'.repeat(80));
  
  const allMasterPartsWithPakistan = await prisma.masterPart.findMany({
    where: {
      OR: [
        { masterPartNo: { contains: 'Pakistan' } },
        { masterPartNo: { contains: 'pakistan' } },
        { masterPartNo: { contains: 'PAKISTAN' } },
      ]
    },
    include: {
      _count: {
        select: { parts: true }
      }
    }
  });
  
  console.log(`\nFound ${allMasterPartsWithPakistan.length} MasterPart entries containing "pakistan":\n`);
  allMasterPartsWithPakistan.forEach((mp, i) => {
    console.log(`[${i + 1}]`, {
      id: mp.id,
      masterPartNo: `"${mp.masterPartNo}"`,
      length: mp.masterPartNo.length,
      trimmed: `"${mp.masterPartNo.trim()}"`,
      partsCount: mp._count.parts,
      hasLeadingSpace: mp.masterPartNo !== mp.masterPartNo.trimStart(),
      hasTrailingSpace: mp.masterPartNo !== mp.masterPartNo.trimEnd(),
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ TEST COMPLETE\n');
}

testMasterPartSearch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
