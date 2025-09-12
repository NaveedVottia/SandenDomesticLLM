#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import { setTimeout } from 'timers/promises';

// Configuration
const SERVER_URL = 'http://localhost:3000';
const MODELS_TO_TEST = ['nova_micro', 'nova_pro', 'claude_sonnet'];
const TEST_RESULTS = [];

// Test data from database.txt
const TEST_CUSTOMER = {
  company: 'セブンイレブン 秋葉原店',
  email: 'support@7aki.jp',
  phone: '03-3322-4455',
  customerId: 'CUST004',
  productId: 'PROD004'
};

// Expected repair data for CUST004/PROD004
const EXPECTED_REPAIRS = [
  { id: 'REP102', date: '2025-08-03', issue: 'コインが詰まる', status: '未対応' },
  { id: 'REP104', date: '2025-08-05', issue: 'コインが詰まる', status: '解決済み' },
  { id: 'REP108', date: '2025-08-09', issue: '画面が表示されない', status: '対応中' },
  { id: 'REP116', date: '2025-08-17', issue: '水漏れがある', status: '解決済み' },
  { id: 'REP118', date: '2025-08-19', issue: '冷却が機能しない', status: '未対応' }
];

class E2ETester {
  constructor(modelName) {
    this.modelName = modelName;
    this.conversation = [];
    this.startTime = Date.now();
    this.results = {
      model: modelName,
      startTime: new Date().toISOString(),
      steps: [],
      errors: [],
      totalTime: 0
    };
  }

  async logStep(step, message, data = null) {
    const timestamp = new Date().toISOString();
    const stepData = {
      step,
      message,
      timestamp,
      data
    };
    this.results.steps.push(stepData);
    console.log(`[${this.modelName}] ${step}: ${message}`);
  }

  async sendMessage(message, role = 'user') {
    try {
      const response = await fetch(`${SERVER_URL}/api/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...this.conversation, { role, content: message }],
          model: this.modelName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read streaming response for Node.js
      let fullResponse = '';
      const chunks = [];
      
      for await (const chunk of response.body) {
        chunks.push(chunk);
      }
      
      const fullText = Buffer.concat(chunks).toString('utf-8');
      const lines = fullText.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('0:"')) {
          const content = line.slice(3, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          fullResponse += content;
        }
      }

      this.conversation.push({ role, content: message });
      this.conversation.push({ role: 'assistant', content: fullResponse });
      
      return fullResponse;
    } catch (error) {
      this.results.errors.push({ step: 'sendMessage', error: error.message });
      throw error;
    }
  }

  async waitForZapierResponse(stepName, maxWaitTime = 30000) {
    await this.logStep(stepName, 'Waiting for Zapier response...');
    await setTimeout(5000); // Wait 5 seconds for Zapier processing
  }

  async verifyDatabaseData(response, expectedData) {
    const found = expectedData.filter(item => 
      response.includes(item.id) || 
      response.includes(item.issue) || 
      response.includes(item.status)
    );
    
    return {
      expected: expectedData.length,
      found: found.length,
      missing: expectedData.length - found.length,
      foundItems: found
    };
  }

  async runE2ETest() {
    try {
      // Step 1: Initial greeting
      await this.logStep('greeting', 'Sending initial greeting');
      const greeting = await this.sendMessage('こんにちは、修理のご相談をしたいのですが。');
      await this.logStep('greeting', 'Received greeting response', { response: greeting });

      // Step 2: Customer login details
      await this.logStep('login', 'Providing customer details');
      const loginMessage = `会社名: ${TEST_CUSTOMER.company}\nメールアドレス: ${TEST_CUSTOMER.email}\n電話番号: ${TEST_CUSTOMER.phone}`;
      const loginResponse = await this.sendMessage(loginMessage);
      await this.logStep('login', 'Received login response', { response: loginResponse });

      // Step 3: Request repair history
      await this.logStep('repair_history', 'Requesting repair history');
      const repairRequest = '修理履歴を確認したいのですが、過去の修理記録を教えてください。';
      const repairResponse = await this.sendMessage(repairRequest);
      await this.logStep('repair_history', 'Received repair history', { response: repairResponse });

      // Step 4: Wait for Zapier and verify data
      await this.waitForZapierResponse('zapier_wait');
      
      // Step 5: Verify repair data accuracy
      await this.logStep('data_verification', 'Verifying repair data accuracy');
      const verification = await this.verifyDatabaseData(repairResponse, EXPECTED_REPAIRS);
      await this.logStep('data_verification', 'Data verification complete', verification);

      // Step 6: Request booking
      await this.logStep('booking_request', 'Requesting booking');
      const bookingMessage = '9月18日の午後6時に訪問修理をお願いします。自販機が故障していてメンテナンスが必要です。';
      const bookingResponse = await this.sendMessage(bookingMessage);
      await this.logStep('booking_request', 'Received booking response', { response: bookingResponse });

      // Step 7: Wait for Zapier booking processing
      await this.waitForZapierResponse('booking_zapier_wait');

      // Step 8: Confirm booking
      await this.logStep('booking_confirm', 'Confirming booking');
      const confirmMessage = '予約を確定してください。';
      const confirmResponse = await this.sendMessage(confirmMessage);
      await this.logStep('booking_confirm', 'Received confirmation', { response: confirmResponse });

      // Step 9: Verify LOGS sheet entry
      await this.logStep('logs_verification', 'Verifying LOGS sheet entry');
      const logsCheck = await this.sendMessage('ログシートに記録が追加されたか確認してください。');
      await this.logStep('logs_verification', 'Logs verification complete', { response: logsCheck });

      this.results.totalTime = Date.now() - this.startTime;
      this.results.endTime = new Date().toISOString();
      this.results.success = true;

    } catch (error) {
      this.results.errors.push({ step: 'e2e_test', error: error.message });
      this.results.success = false;
      this.results.totalTime = Date.now() - this.startTime;
      this.results.endTime = new Date().toISOString();
      await this.logStep('error', 'E2E test failed', { error: error.message });
    }

    return this.results;
  }
}

async function runAllTests() {
  console.log('🚀 Starting E2E Model Comparison Tests');
  console.log(`📋 Testing models: ${MODELS_TO_TEST.join(', ')}`);
  console.log(`🏢 Test customer: ${TEST_CUSTOMER.company}`);
  console.log('=' * 60);

  for (const modelName of MODELS_TO_TEST) {
    console.log(`\n🔄 Testing model: ${modelName}`);
    console.log('-' * 40);
    
    const tester = new E2ETester(modelName);
    const results = await tester.runE2ETest();
    TEST_RESULTS.push(results);
    
    console.log(`✅ Completed ${modelName} test in ${results.totalTime}ms`);
    
    // Wait between tests to avoid rate limiting
    if (MODELS_TO_TEST.indexOf(modelName) < MODELS_TO_TEST.length - 1) {
      console.log('⏳ Waiting 10 seconds before next test...');
      await setTimeout(10000);
    }
  }

  // Generate summary report
  console.log('\n📊 E2E Test Summary Report');
  console.log('=' * 60);
  
  for (const result of TEST_RESULTS) {
    console.log(`\n🤖 Model: ${result.model}`);
    console.log(`⏱️  Total Time: ${result.totalTime}ms`);
    console.log(`✅ Success: ${result.success ? 'Yes' : 'No'}`);
    console.log(`📝 Steps: ${result.steps.length}`);
    console.log(`❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('   Errors:');
      result.errors.forEach(error => {
        console.log(`   - ${error.step}: ${error.error}`);
      });
    }
  }

  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `e2e-test-results-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(TEST_RESULTS, null, 2));
  console.log(`\n💾 Detailed results saved to: ${filename}`);
  
  return TEST_RESULTS;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { E2ETester, runAllTests };
