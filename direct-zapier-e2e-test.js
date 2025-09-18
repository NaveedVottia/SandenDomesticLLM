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

class DirectZapierMCPClient {
  constructor() {
    this.baseUrl = process.env.ZAPIER_MCP_URL;
    this.tools = null;
  }

  async callTool(toolName, params) {
    if (!this.tools) {
      await this.loadTools();
    }

    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

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

  async loadTools() {
    const requestBody = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1
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
            if (result.result && result.result.tools) {
              this.tools = result.result.tools;
              console.log(`✅ Loaded ${this.tools.length} Zapier MCP tools`);
              return;
            }
          }
        }
      }

      throw new Error('No tools found in response');
    } catch (error) {
      console.error('❌ Failed to load tools:', error.message);
      throw error;
    }
  }

  async getAvailableTools() {
    if (!this.tools) {
      await this.loadTools();
    }
    return this.tools.map(t => t.name);
  }
}

class RealZapierE2ETest {
  constructor() {
    this.zapierClient = new DirectZapierMCPClient();
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
      await this.logStep(1, "Testing Direct Zapier MCP Connection");
      
      const tools = await this.zapierClient.getAvailableTools();
      console.log('✅ Zapier MCP connected successfully');
      console.log(`✅ Available tools: ${tools.length}`);
      console.log('📋 Sample tools:', tools.slice(0, 5).join(', '), tools.length > 5 ? '...' : '');
      
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
      const customerData = await this.zapierClient.callTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find customer data for セブンイレブン 秋葉原店',
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      });
      
      console.log('✅ Customer lookup successful');
      console.log('📊 Customer data found:', customerData ? 'Yes' : 'No');
      if (customerData) {
        console.log('📋 Customer details:', JSON.stringify(customerData, null, 2));
      }
      
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
      const repairHistory = await this.zapierClient.callTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: 'Find repair history for customer CUST004',
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      });
      
      console.log('✅ Repair history lookup successful');
      console.log('📊 Repair records found:', repairHistory ? 'Yes' : 'No');
      if (repairHistory) {
        console.log('📋 Repair history:', JSON.stringify(repairHistory, null, 2));
      }
      
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
      const newRepair = await this.zapierClient.callTool('google_sheets_create_spreadsheet_row', {
        instructions: 'Create a new repair booking for September 18th, 6pm visit for セブンイレブン 秋葉原店'
      });
      
      console.log('✅ New repair booking created');
      console.log('📊 Repair booking result:', newRepair ? 'Success' : 'Failed');
      if (newRepair) {
        console.log('📋 New repair details:', JSON.stringify(newRepair, null, 2));
      }
      
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
      const logEntry = await this.zapierClient.callTool('google_sheets_create_spreadsheet_row_at_top', {
        instructions: 'Create a log entry for repair booking confirmation',
        'COL__DOLLAR__A': 'CUST004',
        'COL__DOLLAR__B': 'セブンイレブン 秋葉原店',
        'COL__DOLLAR__C': 'support@7aki.jp',
        'COL__DOLLAR__D': '03-3322-4455',
        'COL__DOLLAR__E': '東京都・秋葉原',
        'COL__DOLLAR__K': `REP${Date.now()}`,
        'COL__DOLLAR__L': '2025-09-18 18:00',
        'COL__DOLLAR__M': '自動販売機の故障、メンテナンスが必要',
        'COL__DOLLAR__N': 'Booking Confirmed',
        'COL__DOLLAR__O': 'Yes',
        'COL__DOLLAR__P': '中',
        'COL__DOLLAR__Q': 'AI Assistant'
      });
      
      console.log('✅ Log entry created');
      console.log('📊 Log entry result:', logEntry ? 'Success' : 'Failed');
      if (logEntry) {
        console.log('📋 Log entry details:', JSON.stringify(logEntry, null, 2));
      }
      
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
    console.log('🚀 Starting Real Zapier MCP E2E Test (Direct HTTP)');
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
    const resultsFile = `direct-zapier-e2e-results-${timestamp}.json`;
    const logsFile = `direct-zapier-conversation-logs-${timestamp}.json`;
    
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
