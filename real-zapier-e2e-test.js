#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
const envContent = readFileSync('server.env', 'utf-8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

// Import Zapier MCP client
const { zapierMcp } = await import('./dist/integrations/zapier-mcp.js');

class RealZapierE2ETest {
  constructor() {
    this.testResults = [];
    this.conversationLog = [];
    this.startTime = new Date();
  }

  async logStep(step, description, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      step,
      description,
      data,
      success: true
    };
    
    console.log(`\n🔄 Step ${step}: ${description}`);
    this.testResults.push(logEntry);
    
    return logEntry;
  }

  async testZapierConnection() {
    try {
      await this.logStep(1, "Testing Zapier MCP Connection");
      
      await zapierMcp.ensureConnected();
      console.log('✅ Zapier MCP connected successfully');
      
      const tools = Object.keys(zapierMcp.toolset || {});
      console.log(`✅ Available tools: ${tools.length}`);
      console.log('📋 Tools:', tools.slice(0, 5).join(', '), tools.length > 5 ? '...' : '');
      
      return true;
    } catch (error) {
      console.error('❌ Zapier MCP connection failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return false;
    }
  }

  async testCustomerLookup() {
    try {
      await this.logStep(2, "Testing Customer Data Lookup");
      
      // Look up customer data for セブンイレブン 秋葉原店
      const customerData = await zapierMcp.callTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find customer data for セブンイレブン 秋葉原店',
        worksheet: 'Customers',
        search_criteria: {
          '会社名': 'セブンイレブン 秋葉原店'
        }
      });
      
      console.log('✅ Customer lookup successful');
      console.log('📊 Customer data:', customerData ? 'Found' : 'Not found');
      
      this.conversationLog.push({
        role: 'system',
        content: `Customer lookup result: ${JSON.stringify(customerData)}`
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
      await this.logStep(3, "Testing Repair History Lookup");
      
      // Look up repair history for CUST004 (セブンイレブン 秋葉原店)
      const repairHistory = await zapierMcp.callTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find repair history for customer CUST004',
        worksheet: 'repairs',
        search_criteria: {
          '顧客ID': 'CUST004'
        }
      });
      
      console.log('✅ Repair history lookup successful');
      console.log('📊 Repair records found:', repairHistory ? 'Yes' : 'No');
      
      this.conversationLog.push({
        role: 'system',
        content: `Repair history result: ${JSON.stringify(repairHistory)}`
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
      await this.logStep(4, "Testing New Repair Booking Creation");
      
      // Create a new repair booking
      const newRepair = await zapierMcp.callTool('google_sheets_create_spreadsheet_row', {
        instructions: 'Create a new repair booking for September 18th, 6pm visit',
        worksheet: 'repairs',
        row_data: {
          '修理ID': `REP${Date.now()}`,
          '日時': '2025-09-18 18:00',
          '製品ID': 'PROD004',
          '顧客ID': 'CUST004',
          '問題内容': '自動販売機の故障、メンテナンスが必要',
          'ステータス': '未対応',
          '訪問要否': 'Yes',
          '優先度': '中',
          '対応者': 'AI'
        }
      });
      
      console.log('✅ New repair booking created');
      console.log('📊 Repair ID:', newRepair?.修理ID || 'Unknown');
      
      this.conversationLog.push({
        role: 'system',
        content: `New repair booking created: ${JSON.stringify(newRepair)}`
      });
      
      return newRepair;
    } catch (error) {
      console.error('❌ Repair booking creation failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async testLogEntryCreation() {
    try {
      await this.logStep(5, "Testing Log Entry Creation");
      
      // Create a log entry for the repair booking
      const logEntry = await zapierMcp.callTool('google_sheets_create_spreadsheet_row', {
        instructions: 'Create a log entry for the repair booking confirmation',
        worksheet: 'Logs',
        row_data: {
          'Timestamp': new Date().toISOString(),
          'Repair ID': `REP${Date.now()}`,
          'Status': 'Booking Confirmed',
          'Customer ID': 'CUST004',
          'Product ID': 'PROD004',
          '担当者 (Handler)': 'AI Assistant',
          'Issue': '自動販売機の故障、メンテナンスが必要',
          'Source': 'E2E Test',
          'Raw': JSON.stringify({
            customer: 'セブンイレブン 秋葉原店',
            email: 'support@7aki.jp',
            phone: '03-3322-4455',
            booking_date: '2025-09-18 18:00',
            issue: '自動販売機の故障、メンテナンスが必要'
          })
        }
      });
      
      console.log('✅ Log entry created');
      console.log('📊 Log entry ID:', logEntry?.Timestamp || 'Unknown');
      
      this.conversationLog.push({
        role: 'system',
        content: `Log entry created: ${JSON.stringify(logEntry)}`
      });
      
      return logEntry;
    } catch (error) {
      console.error('❌ Log entry creation failed:', error.message);
      this.testResults[this.testResults.length - 1].success = false;
      this.testResults[this.testResults.length - 1].error = error.message;
      return null;
    }
  }

  async runFullE2ETest() {
    console.log('🚀 Starting Real Zapier MCP E2E Test');
    console.log('=' .repeat(60));
    
    const results = {
      zapierConnection: await this.testZapierConnection(),
      customerLookup: await this.testCustomerLookup(),
      repairHistory: await this.testRepairHistoryLookup(),
      newBooking: await this.testNewRepairBooking(),
      logEntry: await this.testLogEntryCreation()
    };
    
    const endTime = new Date();
    const totalTime = (endTime - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 E2E Test Results Summary');
    console.log('='.repeat(60));
    
    const successCount = Object.values(results).filter(Boolean).length;
    const totalSteps = Object.keys(results).length;
    
    console.log(`✅ Successful steps: ${successCount}/${totalSteps}`);
    console.log(`⏱️  Total time: ${totalTime.toFixed(2)} seconds`);
    console.log(`📋 Test results:`);
    
    Object.entries(results).forEach(([key, success]) => {
      console.log(`   ${success ? '✅' : '❌'} ${key}: ${success ? 'PASS' : 'FAIL'}`);
    });
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `real-zapier-e2e-results-${timestamp}.json`;
    const logsFile = `real-zapier-conversation-logs-${timestamp}.json`;
    
    await this.saveResults(resultsFile, logsFile);
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    console.log(`💾 Conversation logs saved to: ${logsFile}`);
    
    return {
      success: successCount === totalSteps,
      results,
      totalTime,
      files: { resultsFile, logsFile }
    };
  }

  async saveResults(resultsFile, logsFile) {
    const fs = await import('fs');
    
    const resultsData = {
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      summary: {
        totalSteps: this.testResults.length,
        successfulSteps: this.testResults.filter(r => r.success).length,
        failedSteps: this.testResults.filter(r => !r.success).length,
        totalTime: (new Date() - this.startTime) / 1000
      }
    };
    
    const logsData = {
      timestamp: new Date().toISOString(),
      conversationLog: this.conversationLog,
      testResults: this.testResults
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
    fs.writeFileSync(logsFile, JSON.stringify(logsData, null, 2));
  }
}

// Run the test
const test = new RealZapierE2ETest();
const results = await test.runFullE2ETest();

if (results.success) {
  console.log('\n🎉 All tests passed! Zapier MCP integration is working correctly.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Check the results for details.');
  process.exit(1);
}
