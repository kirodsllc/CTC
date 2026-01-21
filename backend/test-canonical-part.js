#!/usr/bin/env node

/**
 * Test script for canonical part selection
 * Tests:
 * 1. Debug endpoint shows duplicates and canonical part
 * 2. Parts API returns canonical part for exact partNo search
 * 3. Price-management API returns canonical part
 * 4. Canonical part selection logic
 */

const http = require('http');

const BASE_URL = 'http://localhost:3002';
const TEST_PART_NO = '6C0570';

// Helper function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    console.log(`\n📡 Requesting: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: e.message });
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Test functions
async function testDebugEndpoint() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 1: Debug Endpoint - /api/debug/part-cost/:partNo');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const result = await makeRequest(`/api/debug/part-cost/${TEST_PART_NO}`);
    
    if (result.status !== 200) {
      console.error(`❌ FAILED: Status ${result.status}`);
      console.error(`   Response:`, result.data);
      return false;
    }
    
    const { allParts, canonicalPartId, pricingApiWillReturn } = result.data;
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Found ${allParts.length} parts with partNo=${TEST_PART_NO}`);
    console.log(`🎯 Canonical Part ID: ${canonicalPartId}`);
    
    console.log('\n📋 All Parts:');
    allParts.forEach((part, idx) => {
      console.log(`   ${idx + 1}. ID: ${part.id.substring(0, 8)}...`);
      console.log(`      Cost: ${part.cost ?? 'NULL'}`);
      console.log(`      Cost Source: ${part.costSource ?? 'NULL'}`);
      console.log(`      Cost Updated At: ${part.costUpdatedAt ?? 'NULL'}`);
      console.log(`      Is Canonical: ${part.isCanonical ? '✅ YES' : '❌ NO'}`);
    });
    
    console.log('\n🎯 Pricing API Will Return:');
    console.log(`   ID: ${pricingApiWillReturn.id.substring(0, 8)}...`);
    console.log(`   Cost: ${pricingApiWillReturn.cost ?? 'NULL'}`);
    console.log(`   Cost Source: ${pricingApiWillReturn.costSource ?? 'NULL'}`);
    
    // Verify canonical part is marked correctly
    const canonicalPart = allParts.find(p => p.id === canonicalPartId);
    if (!canonicalPart) {
      console.error(`❌ FAILED: Canonical part ID not found in allParts`);
      return false;
    }
    
    if (!canonicalPart.isCanonical) {
      console.error(`❌ FAILED: Canonical part is not marked as canonical`);
      return false;
    }
    
    if (pricingApiWillReturn.id !== canonicalPartId) {
      console.error(`❌ FAILED: Pricing API will return different part than canonical`);
      return false;
    }
    
    console.log(`\n✅ PASSED: Debug endpoint works correctly`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    return false;
  }
}

async function testPartsAPI() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Parts API - /api/parts?search=:partNo');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const result = await makeRequest(`/api/parts?search=${TEST_PART_NO}&limit=1`);
    
    if (result.status !== 200) {
      console.error(`❌ FAILED: Status ${result.status}`);
      console.error(`   Response:`, result.data);
      return false;
    }
    
    const { data } = result.data;
    
    if (!data || data.length === 0) {
      console.error(`❌ FAILED: No parts returned`);
      return false;
    }
    
    const part = data[0];
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Returned ${data.length} part(s)`);
    console.log(`\n📋 Part Returned:`);
    console.log(`   ID: ${part.id.substring(0, 8)}...`);
    console.log(`   Part No: ${part.part_no}`);
    console.log(`   Cost: ${part.cost ?? 'NULL'}`);
    
    // Verify it's the canonical part
    const debugResult = await makeRequest(`/api/debug/part-cost/${TEST_PART_NO}`);
    if (debugResult.status === 200) {
      const { canonicalPartId } = debugResult.data;
      if (part.id !== canonicalPartId) {
        console.error(`❌ FAILED: Parts API returned non-canonical part`);
        console.error(`   Expected ID: ${canonicalPartId.substring(0, 8)}...`);
        console.error(`   Got ID: ${part.id.substring(0, 8)}...`);
        return false;
      }
      console.log(`\n✅ PASSED: Parts API returns canonical part`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    return false;
  }
}

async function testPriceManagementAPI() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Price Management API - /api/parts/price-management?search=:partNo');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const result = await makeRequest(`/api/parts/price-management?search=${TEST_PART_NO}`);
    
    if (result.status !== 200) {
      console.error(`❌ FAILED: Status ${result.status}`);
      console.error(`   Response:`, result.data);
      return false;
    }
    
    const { data } = result.data;
    
    if (!data || data.length === 0) {
      console.error(`❌ FAILED: No parts returned`);
      return false;
    }
    
    const part = data[0];
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Returned ${data.length} part(s)`);
    console.log(`\n📋 Part Returned:`);
    console.log(`   ID: ${part.id.substring(0, 8)}...`);
    console.log(`   Part No: ${part.partNo}`);
    console.log(`   Cost: ${part.cost ?? 'NULL'}`);
    
    // Verify it's the canonical part
    const debugResult = await makeRequest(`/api/debug/part-cost/${TEST_PART_NO}`);
    if (debugResult.status === 200) {
      const { canonicalPartId } = debugResult.data;
      if (part.id !== canonicalPartId) {
        console.error(`❌ FAILED: Price Management API returned non-canonical part`);
        console.error(`   Expected ID: ${canonicalPartId.substring(0, 8)}...`);
        console.error(`   Got ID: ${part.id.substring(0, 8)}...`);
        return false;
      }
      console.log(`\n✅ PASSED: Price Management API returns canonical part`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    return false;
  }
}

async function testVersionEndpoint() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 4: Version Endpoint - /api/debug/version');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const result = await makeRequest(`/api/debug/version`);
    
    if (result.status !== 200) {
      console.error(`❌ FAILED: Status ${result.status}`);
      console.error(`   Response:`, result.data);
      return false;
    }
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📋 Version Info:`);
    console.log(`   Version: ${result.data.version}`);
    console.log(`   Build Time: ${result.data.buildTime}`);
    console.log(`   Node Version: ${result.data.nodeVersion}`);
    console.log(`   Timestamp: ${result.data.timestamp}`);
    
    console.log(`\n✅ PASSED: Version endpoint works`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 CANONICAL PART SELECTION - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Testing partNo: ${TEST_PART_NO}`);
  console.log(`Base URL: ${BASE_URL}`);
  
  const results = {
    debug: false,
    parts: false,
    priceManagement: false,
    version: false,
  };
  
  try {
    results.version = await testVersionEndpoint();
    results.debug = await testDebugEndpoint();
    results.parts = await testPartsAPI();
    results.priceManagement = await testPriceManagementAPI();
  } catch (error) {
    console.error(`\n❌ FATAL ERROR:`, error);
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Version Endpoint:        ${results.version ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Debug Endpoint:          ${results.debug ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Parts API:               ${results.parts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Price Management API:    ${results.priceManagement ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
