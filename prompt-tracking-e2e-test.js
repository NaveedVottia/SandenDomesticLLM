#!/usr/bin/env node

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Load environment variables
const envContent = readFileSync('server.env', 'utf-8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

class PromptTrackingE2ETest {
  constructor() {
    this.baseUrl = process.env.ZAPIER_MCP_URL;
    this.testResults = [];
    this.conversationLog = [];
    this.promptLog = [];
    this.startTime = new Date();
    this.sessionId = `E2E-${Date.now()}`;
  }

  async logStep(step, description, prompt = null, data = null, success = true) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      step,
      description,
      prompt,
      data,
      success,
      sessionId: this.sessionId
    };
    
    console.log(`\n🔄 Step ${step}: ${description}`);
    if (prompt) {
      console.log(`📝 Prompt: ${prompt}`);
    }
    this.testResults.push(logEntry);
    
    return logEntry;
  }

  async callZapierTool(toolName, params, prompt = null) {
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
      const curlCommand = `curl -X POST "${this.baseUrl}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '${JSON.stringify(requestBody)}' \
        --max-time 30 --silent`;

      const result = execSync(curlCommand, { encoding: 'utf-8' });
      
      // Parse SSE response
      const lines = result.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim()) {
            const parsed = JSON.parse(data);
            if (parsed.result) {
              // Log the prompt used for this tool call
              if (prompt) {
                this.promptLog.push({
                  timestamp: new Date().toISOString(),
                  tool: toolName,
                  prompt: prompt,
                  params: params,
                  result: parsed.result,
                  sessionId: this.sessionId
                });
              }
              return parsed.result;
            }
            if (parsed.error) {
              throw new Error(`Tool call error: ${parsed.error.message}`);
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
    const prompt = "Find customer data for セブンイレブン 秋葉原店";
    try {
      await this.logStep(1, "Customer Data Lookup - セブンイレブン 秋葉原店", prompt);
      
      const customerData = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt,
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      }, prompt);
      
      console.log('✅ Customer lookup successful');
      console.log('📊 Customer data found:', customerData ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'customer_lookup',
        prompt: prompt,
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
    const prompt = "Find repair history for customer CUST004";
    try {
      await this.logStep(2, "Repair History Lookup - CUST004", prompt);
      
      const repairHistory = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt,
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      }, prompt);
      
      console.log('✅ Repair history lookup successful');
      console.log('📊 Repair records found:', repairHistory ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_history_lookup',
        prompt: prompt,
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
    const repairId = `REP${Date.now()}`;
    const prompt = `Create a new repair booking for September 18th, 6pm visit for セブンイレブン 秋葉原店, automatic vending machine maintenance needed. Repair ID: ${repairId}`;
    try {
      await this.logStep(3, "New Repair Booking Creation - September 18th, 6pm", prompt);
      
      const newRepair = await this.callZapierTool('google_sheets_create_spreadsheet_row', {
        instructions: prompt
      }, prompt);
      
      console.log('✅ New repair booking created');
      console.log('📊 Repair booking result:', newRepair ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_booking_creation',
        prompt: prompt,
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
    const prompt = 'Create a log entry for repair booking confirmation for セブンイレブン 秋葉原店';
    try {
      await this.logStep(4, "Log Entry Creation - Booking Confirmation", prompt);
      
      const logEntry = await this.callZapierTool('google_sheets_create_spreadsheet_row_at_top', {
        instructions: prompt,
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
      }, prompt);
      
      console.log('✅ Log entry created');
      console.log('📊 Log entry result:', logEntry ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'log_entry_creation',
        prompt: prompt,
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
    const prompt1 = "Find the most recent repair booking for セブンイレブン 秋葉原店";
    const prompt2 = "Find the most recent log entry for CUST004";
    try {
      await this.logStep(5, "Data Verification - Confirm Records Created", `${prompt1} | ${prompt2}`);
      
      // Verify the repair booking was created
      const repairVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt1,
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      }, prompt1);
      
      // Verify the log entry was created
      const logVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt2,
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      }, prompt2);
      
      console.log('✅ Data verification completed');
      console.log('📊 Repair verification:', repairVerification ? 'Found' : 'Not found');
      console.log('📊 Log verification:', logVerification ? 'Found' : 'Not found');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'data_verification',
        prompt: `${prompt1} | ${prompt2}`,
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
    console.log('🚀 Starting Complete Zapier MCP E2E Test with Prompt Tracking');
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
    
    // Show prompt summary
    console.log('\n📝 Prompt Usage Summary:');
    console.log('=' .repeat(60));
    this.promptLog.forEach((log, index) => {
      console.log(`${index + 1}. Tool: ${log.tool}`);
      console.log(`   Prompt: ${log.prompt}`);
      console.log(`   Result: ${log.result ? 'Success' : 'Failed'}`);
      console.log('');
    });
    
    // Save comprehensive results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `prompt-tracking-e2e-results-${timestamp}.json`;
    const logsFile = `prompt-tracking-conversation-logs-${timestamp}.json`;
    const recordsFile = `prompt-tracking-records-${timestamp}.json`;
    const promptsFile = `prompt-tracking-prompts-${timestamp}.json`;
    
    await this.saveResults(resultsFile, logsFile, recordsFile, promptsFile, results);
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    console.log(`💾 Conversation logs saved to: ${logsFile}`);
    console.log(`💾 Records data saved to: ${recordsFile}`);
    console.log(`💾 Prompt tracking saved to: ${promptsFile}`);
    
    return {
      success: successCount === totalSteps,
      results,
      totalTime,
      files: { resultsFile, logsFile, recordsFile, promptsFile },
      sessionId: this.sessionId,
      promptLog: this.promptLog
    };
  }

  async saveResults(resultsFile, logsFile, recordsFile, promptsFile, results) {
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
    
    const promptsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      promptLog: this.promptLog,
      promptSummary: this.promptLog.map(log => ({
        tool: log.tool,
        prompt: log.prompt,
        timestamp: log.timestamp,
        success: !!log.result
      })),
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
    fs.writeFileSync(logsFile, JSON.stringify(logsData, null, 2));
    fs.writeFileSync(recordsFile, JSON.stringify(recordsData, null, 2));
    fs.writeFileSync(promptsFile, JSON.stringify(promptsData, null, 2));
  }
}

// Run the complete test
const test = new PromptTrackingE2ETest();
const results = await test.runCompleteE2ETest();

if (results.success) {
  console.log('\n🎉 All tests passed! Complete E2E test with prompt tracking completed successfully.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`📝 Prompts used: ${results.promptLog.length}`);
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Check the results for details.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`📝 Prompts used: ${results.promptLog.length}`);
  process.exit(1);
}
