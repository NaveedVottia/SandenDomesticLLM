#!/usr/bin/env node

import { config } from 'dotenv';
import { createMemoryIds, storeCustomerData } from './dist/mastra/shared-memory.js';
import { hybridGetProductsByCustomerIdTool } from './dist/mastra/tools/sanden/product-tools.js';
import { createSchedulingEntry } from './dist/mastra/tools/sanden/scheduling-tools.js';

// Load environment variables
config({ path: './server.env' });

async function testSchedulingAgentDatabasePost() {
  console.log('🧪 Testing Scheduling Agent Database POST with Fallback...\n');

  try {
    // Step 1: Simulate customer login (cust010)
    console.log('📝 Step 1: Simulating customer login with cust010...');
    const customerData = {
      customerId: 'cust010',
      storeName: 'Test Store 010',
      email: 'test010@example.com',
      phone: '123-456-7890',
      location: 'Tokyo'
    };

    const sessionId = `session-${customerData.customerId}`;
    const memIds = createMemoryIds(sessionId, customerData.customerId);
    
    const storeResult = await storeCustomerData(memIds, customerData);
    console.log(`✅ Customer data stored: ${storeResult}`);

    // Step 2: Test product lookup with fallback
    console.log('\n📝 Step 2: Testing product lookup with fallback...');
    const productResult = await hybridGetProductsByCustomerIdTool.execute({
      context: {
        // No explicit customerId - should use fallback
        sessionId: sessionId
      }
    });

    console.log(`✅ Product lookup result:`, JSON.stringify(productResult, null, 2));

    // Step 3: Test scheduling entry creation
    console.log('\n📝 Step 3: Testing scheduling entry creation...');
    const appointmentData = {
      customerId: 'cust010',
      companyName: 'Test Store 010',
      email: 'test010@example.com',
      phone: '123-456-7890',
      location: 'Tokyo',
      productId: 'PROD010',
      productCategory: 'Vending Machine',
      model: 'VM-2024',
      serialNumber: 'SN010001',
      warrantyStatus: '有効',
      repairId: 'REP010002',
      scheduledDateTime: '2025-09-10 15:00',
      issueDescription: 'テスト修理予約（フォールバックテスト）',
      status: '予約済み',
      visitRequired: '要',
      priority: '中',
      technician: '田中',
      notes: 'フォールバック機能のテスト用予約です'
    };

    const schedulingResult = await createSchedulingEntry.execute({
      context: appointmentData
    });

    console.log(`✅ Scheduling result:`, JSON.stringify(schedulingResult, null, 2));

    if (schedulingResult.success) {
      console.log('🎉 Scheduling agent database POST is working correctly!');
      console.log(`📊 Created entry for customer: ${appointmentData.customerId}`);
      console.log(`📊 Repair ID: ${appointmentData.repairId}`);
      console.log(`📊 Scheduled Date: ${appointmentData.scheduledDateTime}`);
      console.log(`📊 Product lookup worked: ${productResult.success ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ ERROR: Scheduling failed: ${schedulingResult.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSchedulingAgentDatabasePost().catch(console.error);
