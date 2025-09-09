#!/usr/bin/env node

import { config } from 'dotenv';
import { createMemoryIds, storeCustomerData, getCustomerData } from './dist/mastra/shared-memory.js';
import { hybridGetRepairsByCustomerIdTool } from './dist/mastra/tools/sanden/repair-tools.js';

// Load environment variables
config({ path: './server.env' });

async function testCustomerIdPersistence() {
  console.log('🧪 Testing Customer ID Persistence...\n');

  try {
    // Step 1: Simulate customer login (cust009)
    console.log('📝 Step 1: Simulating customer login with cust009...');
    const customerData = {
      customerId: 'cust009',
      storeName: 'Test Store',
      email: 'test@example.com',
      phone: '123-456-7890',
      location: 'Tokyo'
    };

    const sessionId = `session-${customerData.customerId}`;
    const memIds = createMemoryIds(sessionId, customerData.customerId);
    
    const storeResult = await storeCustomerData(memIds, customerData);
    console.log(`✅ Customer data stored: ${storeResult}`);

    // Step 2: Verify customer data can be retrieved
    console.log('\n📝 Step 2: Verifying customer data retrieval...');
    const retrievedData = await getCustomerData(memIds);
    console.log(`✅ Retrieved customer data:`, JSON.stringify(retrievedData, null, 2));

    // Step 3: Test repair history lookup without explicit customer ID
    console.log('\n📝 Step 3: Testing repair history lookup without explicit customer ID...');
    const repairResult = await hybridGetRepairsByCustomerIdTool.execute({
      context: {
        sessionId: sessionId
        // Note: No explicit customerId provided - should be retrieved from memory
      }
    });

    console.log(`✅ Repair history result:`, JSON.stringify(repairResult, null, 2));

    // Step 4: Verify the customer ID used in the lookup
    if (repairResult.success && repairResult.data) {
      console.log(`\n✅ SUCCESS: Repair history retrieved for customer ID: ${repairResult.data[0]?.customerId || 'Unknown'}`);
      if (repairResult.data[0]?.customerId === 'cust009') {
        console.log('🎉 Customer ID persistence is working correctly!');
      } else {
        console.log(`❌ ERROR: Expected cust009, but got ${repairResult.data[0]?.customerId}`);
      }
    } else {
      console.log(`❌ ERROR: Repair history lookup failed: ${repairResult.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCustomerIdPersistence().catch(console.error);
