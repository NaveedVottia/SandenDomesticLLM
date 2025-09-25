#!/usr/bin/env node

import { config } from 'dotenv';
import { createMemoryIds, storeCustomerData } from './dist/mastra/shared-memory.js';
import { createSchedulingEntry } from './dist/mastra/tools/sanden/scheduling-tools.js';

// Load environment variables
config({ path: './server.env' });

async function testSchedulingAgentDatabasePost() {
  console.log('🧪 Testing Scheduling Agent Database POST...\n');

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

    // Step 2: Test scheduling entry creation
    console.log('\n📝 Step 2: Testing scheduling entry creation...');
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
      repairId: 'REP010001',
      scheduledDateTime: '2025-09-10 14:00',
      issueDescription: 'テスト修理予約',
      status: '予約済み',
      visitRequired: '要',
      priority: '中',
      technician: '田中',
      notes: 'テスト用の修理予約です'
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
    } else {
      console.log(`❌ ERROR: Scheduling failed: ${schedulingResult.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSchedulingAgentDatabasePost().catch(console.error);
