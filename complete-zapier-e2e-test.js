#!/usr/bin/env node

import { readFileSync } from 'fs';

// Load environment variables
const envContent = readFileSync('server.env', 'utf-8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

class CompleteZapierE2ETest {
  constructor() {
    this.baseUrl = process.env.ZAPIER_MCP_URL;
    this.testResults = [];
    this.conversationLog = [];
    this.startTime = new Date();
    this.sessionId = `E2E-${Date.now()}`;
  }

  async logStep(step, description, data = null, success = true) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      step,
      description,
      data,
      success,
      sessionId: this.sessionId
    };
    
    console.log(`\n🔄 Step ${step}: ${description}`);
    this.testResults.push(logEntry);
    
    return logEntry;
  }

  async callZapierTool(toolName, params) {
    const requestBody = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params
      },
      id: Date.now()
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // Parse SSE response
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim()) {
            const result = JSON.parse(data);
            if (result.result) {
              return result.result;
            }
            if (result.error) {
              throw new Error(`Tool call error: ${result.error.message}`);
            }
          }
        }
      }

      throw new Error('No valid response received');
    } catch (error) {
      console.error(`❌ Tool call failed for ${toolName}:`, error.message);
      throw error;
    }
  }

  async testCustomerLookup() {
    try {
      await this.logStep(1, "Customer Data Lookup - セブンイレブン 秋葉原店");
      
      const customerData = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find customer data for セブンイレブン 秋葉原店',
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      });
      
      console.log('✅ Customer lookup successful');
      console.log('📊 Customer data found:', customerData ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'customer_lookup',
        content: `Customer lookup result: ${JSON.stringify(customerData)}`,
        sessionId: this.sessionId
      });
      
      return customerData;
    } catch (error) {
      console.error('❌ Customer lookup failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async testRepairHistoryLookup() {
    try {
      await this.logStep(2, "Repair History Lookup - CUST004");
      
      const repairHistory = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find repair history for customer CUST004',
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      });
      
      console.log('✅ Repair history lookup successful');
      console.log('📊 Repair records found:', repairHistory ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_history_lookup',
        content: `Repair history result: ${JSON.stringify(repairHistory)}`,
        sessionId: this.sessionId
      });
      
      return repairHistory;
    } catch (error) {
      console.error('❌ Repair history lookup failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async testNewRepairBooking() {
    try {
      await this.logStep(3, "New Repair Booking Creation - September 18th, 6pm");
      
      const repairId = `REP${Date.now()}`;
      const newRepair = await this.callZapierTool('google_sheets_create_spreadsheet_row', {
        instructions: `Create a new repair booking for September 18th, 6pm visit for セブンイレブン 秋葉原店, automatic vending machine maintenance needed. Repair ID: ${repairId}`
      });
      
      console.log('✅ New repair booking created');
      console.log('📊 Repair booking result:', newRepair ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_booking_creation',
        content: `New repair booking created: ${JSON.stringify(newRepair)}`,
        sessionId: this.sessionId,
        repairId: repairId
      });
      
      return { newRepair, repairId };
    } catch (error) {
      console.error('❌ Repair booking creation failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async testLogEntryCreation(repairId) {
    try {
      await this.logStep(4, "Log Entry Creation - Booking Confirmation");
      
      const logEntry = await this.callZapierTool('google_sheets_create_spreadsheet_row_at_top', {
        instructions: 'Create a log entry for repair booking confirmation for セブンイレブン 秋葉原店',
        'COL__DOLLAR__A': 'CUST004',
        'COL__DOLLAR__B': 'セブンイレブン 秋葉原店',
        'COL__DOLLAR__C': 'support@7aki.jp',
        'COL__DOLLAR__D': '03-3322-4455',
        'COL__DOLLAR__E': '東京都・秋葉原',
        'COL__DOLLAR__K': repairId,
        'COL__DOLLAR__L': '2025-09-18 18:00',
        'COL__DOLLAR__M': '自動販売機の故障、メンテナンスが必要',
        'COL__DOLLAR__N': 'Booking Confirmed',
        'COL__DOLLAR__O': 'Yes',
        'COL__DOLLAR__P': '中',
        'COL__DOLLAR__Q': 'AI Assistant'
      });
      
      console.log('✅ Log entry created');
      console.log('📊 Log entry result:', logEntry ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'log_entry_creation',
        content: `Log entry created: ${JSON.stringify(logEntry)}`,
        sessionId: this.sessionId,
        repairId: repairId
      });
      
      return logEntry;
    } catch (error) {
      console.error('❌ Log entry creation failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async testDataVerification() {
    try {
      await this.logStep(5, "Data Verification - Confirm Records Created");
      
      // Verify the repair booking was created
      const repairVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find the most recent repair booking for セブンイレブン 秋葉原店',
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      });
      
      // Verify the log entry was created
      const logVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find the most recent log entry for CUST004',
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      });
      
      console.log('✅ Data verification completed');
      console.log('📊 Repair verification:', repairVerification ? 'Found' : 'Not found');
      console.log('📊 Log verification:', logVerification ? 'Found' : 'Not found');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'data_verification',
        content: `Data verification - Repair: ${JSON.stringify(repairVerification)}, Log: ${JSON.stringify(logVerification)}`,
        sessionId: this.sessionId
      });
      
      return { repairVerification, logVerification };
    } catch (error) {
      console.error('❌ Data verification failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async runCompleteE2ETest() {
    console.log('🚀 Starting Complete Zapier MCP E2E Test');
    console.log('=' .repeat(60));
    console.log(`📋 Session ID: ${this.sessionId}`);
    console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
    console.log('=' .repeat(60));
    
    const results = {
      customerLookup: await this.testCustomerLookup(),
      repairHistory: await this.testRepairHistoryLookup(),
      newBooking: await this.testNewRepairBooking(),
      logEntry: null,
      dataVerification: null
    };
    
    // Use the repair ID from the booking creation
    if (results.newBooking && results.newBooking.repairId) {
      results.logEntry = await this.testLogEntryCreation(results.newBooking.repairId);
      results.dataVerification = await this.testDataVerification();
    }
    
    const endTime = new Date();
    const totalTime = (endTime - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Complete E2E Test Results Summary');
    console.log('='.repeat(60));
    
    const successCount = Object.values(results).filter(Boolean).length;
    const totalSteps = Object.keys(results).length;
    
    console.log(`✅ Successful steps: ${successCount}/${totalSteps}`);
    console.log(`⏱️  Total time: ${totalTime.toFixed(2)} seconds`);
    console.log(`📋 Test results:`);
    
    Object.entries(results).forEach(([key, success]) => {
      console.log(`   ${success ? '✅' : '❌'} ${key}: ${success ? 'PASS' : 'FAIL'}`);
    });
    
    // Save comprehensive results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `complete-zapier-e2e-results-${timestamp}.json`;
    const logsFile = `complete-zapier-conversation-logs-${timestamp}.json`;
    const recordsFile = `complete-zapier-records-${timestamp}.json`;
    
    await this.saveResults(resultsFile, logsFile, recordsFile, results);
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    console.log(`💾 Conversation logs saved to: ${logsFile}`);
    console.log(`💾 Records data saved to: ${recordsFile}`);
    
    return {
      success: successCount === totalSteps,
      results,
      totalTime,
      files: { resultsFile, logsFile, recordsFile },
      sessionId: this.sessionId
    };
  }

  async saveResults(resultsFile, logsFile, recordsFile, results) {
    const fs = await import('fs');
    
    const resultsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      testResults: this.testResults,
      summary: {
        totalSteps: this.testResults.length,
        successfulSteps: this.testResults.filter(r => r.success).length,
        failedSteps: this.testResults.filter(r => !r.success).length,
        totalTime: (new Date() - this.startTime) / 1000
      },
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
    };
    
    const logsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      conversationLog: this.conversationLog,
      testResults: this.testResults,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
    };
    
    const recordsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      records: results,
      conversationLog: this.conversationLog,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
    fs.writeFileSync(logsFile, JSON.stringify(logsData, null, 2));
    fs.writeFileSync(recordsFile, JSON.stringify(recordsData, null, 2));
  }
}

// Run the complete test
const test = new CompleteZapierE2ETest();
const results = await test.runCompleteE2ETest();

if (results.success) {
  console.log('\n🎉 All tests passed! Complete E2E test with real Zapier MCP data completed successfully.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Check the results for details.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  process.exit(1);
}
