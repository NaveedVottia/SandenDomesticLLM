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

class LangfuseE2ETraceTest {
  constructor() {
    this.baseUrl = process.env.ZAPIER_MCP_URL;
    this.langfuseHost = process.env.LANGFUSE_HOST;
    this.langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    this.langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY;
    
    this.testResults = [];
    this.conversationLog = [];
    this.agentLog = [];
    this.toolLog = [];
    this.promptLog = [];
    this.startTime = new Date();
    this.sessionId = `E2E-${Date.now()}`;
    this.traceId = `trace-${this.sessionId}`;
    
    // Define the agents and tools from the codebase
    this.agents = {
      'Domestic-orchestrator': {
        name: 'Domestic-orchestrator',
        description: 'サンデン・リテールシステム修理受付AI , ワークフローオーケストレーター',
        tools: [
          'delegateTo', 'forceDelegation', 'escalateToHuman', 'validateContext',
          'updateWorkflowState', 'logCustomerData', 'lookupCustomerFromDatabase',
          'updateCustomer', 'getCustomerHistory', 'createProductTool', 'updateProductTool',
          'searchProductsTool', 'checkWarrantyStatusTool', 'createRepairTool',
          'updateRepairTool', 'getRepairStatusTool', 'schedulingTools', 'validateSession',
          'getSystemInfo', 'getHelp', 'zapierAiQuery'
        ],
        prompt: 'Domestic-orchestrator'
      },
      'Domestic-repair-history-ticket': {
        name: 'Domestic-repair-history-ticket',
        description: 'サンデン・リテールシステム修理受付AI , 問題分析エージェント',
        tools: ['repairTools', 'customerTools', 'commonTools', 'memoryTools'],
        prompt: 'Domestic-repair-history-ticket'
      },
      'Domestic-repair-agent': {
        name: 'Domestic-repair-agent',
        description: 'サンデン・リテールシステム修理受付AI , 製品選択エージェント',
        tools: ['productTools', 'customerTools', 'commonTools', 'memoryTools', 'delegateTo'],
        prompt: 'Domestic-repair-agent'
      }
    };
  }

  async logToLangfuse(step, description, agent = null, tool = null, prompt = null, data = null, success = true) {
    const timestamp = new Date().toISOString();
    const observationId = `obs-${step}-${Date.now()}`;
    
    // Create Langfuse trace data
    const traceData = {
      id: this.traceId,
      name: `E2E Test - ${description}`,
      input: {
        step: step,
        description: description,
        agent: agent,
        tool: tool,
        prompt: prompt,
        sessionId: this.sessionId
      },
      output: {
        success: success,
        data: data,
        timestamp: timestamp
      },
      metadata: {
        sessionId: this.sessionId,
        step: step,
        agent: agent,
        tool: tool,
        prompt: prompt,
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
      }
    };

    // Log to Langfuse via SDK
    try {
      const { langfuse } = await import('./dist/integrations/langfuse.js');
      
      // Log tool execution if tool is specified
      if (tool) {
        await langfuse.logToolExecution(this.traceId, tool, traceData.input, traceData.output, traceData.metadata);
      } else {
        // Log as a general trace step
        await langfuse.logPrompt(`Step ${step}: ${description}`, traceData.input, traceData.output, traceData.metadata);
      }
      
      console.log(`📊 Langfuse trace logged: ${observationId}`);
    } catch (error) {
      console.log(`⚠️ Langfuse logging failed: ${error.message}`);
    }

    return { timestamp, observationId, traceData };
  }

  async logStep(step, description, agent = null, tool = null, prompt = null, data = null, success = true) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      step,
      description,
      agent,
      tool,
      prompt,
      data,
      success,
      sessionId: this.sessionId
    };
    
    console.log(`\n🔄 Step ${step}: ${description}`);
    if (agent) {
      console.log(`🤖 Agent: ${agent}`);
    }
    if (tool) {
      console.log(`🔧 Tool: ${tool}`);
    }
    if (prompt) {
      console.log(`📝 Prompt: ${prompt}`);
    }
    
    this.testResults.push(logEntry);
    
    // Log to Langfuse
    await this.logToLangfuse(step, description, agent, tool, prompt, data, success);
    
    // Log agent usage
    if (agent) {
      this.agentLog.push({
        timestamp,
        agent,
        step,
        success,
        sessionId: this.sessionId
      });
    }
    
    // Log tool usage
    if (tool) {
      this.toolLog.push({
        timestamp,
        tool,
        agent,
        step,
        success,
        sessionId: this.sessionId
      });
    }
    
    return logEntry;
  }

  async callZapierTool(toolName, params, agent = null, prompt = null) {
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
              // Log the tool usage
              this.toolLog.push({
                timestamp: new Date().toISOString(),
                tool: toolName,
                agent: agent,
                prompt: prompt,
                params: params,
                result: parsed.result,
                success: true,
                sessionId: this.sessionId
              });
              
              // Log the prompt used for this tool call
              if (prompt) {
                this.promptLog.push({
                  timestamp: new Date().toISOString(),
                  tool: toolName,
                  agent: agent,
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
      
      // Log failed tool usage
      this.toolLog.push({
        timestamp: new Date().toISOString(),
        tool: toolName,
        agent: agent,
        prompt: prompt,
        params: params,
        error: error.message,
        success: false,
        sessionId: this.sessionId
      });
      
      throw error;
    }
  }

  async testCustomerLookup() {
    const agent = 'Domestic-orchestrator';
    const tool = 'lookupCustomerFromDatabase';
    const prompt = "Find customer data for セブンイレブン 秋葉原店";
    
    try {
      await this.logStep(1, "Customer Data Lookup - セブンイレブン 秋葉原店", agent, tool, prompt);
      
      const customerData = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt,
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      }, agent, prompt);
      
      console.log('✅ Customer lookup successful');
      console.log('📊 Customer data found:', customerData ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'customer_lookup',
        agent: agent,
        tool: tool,
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
    const agent = 'Domestic-repair-history-ticket';
    const tool = 'getCustomerHistory';
    const prompt = "Find repair history for customer CUST004";
    
    try {
      await this.logStep(2, "Repair History Lookup - CUST004", agent, tool, prompt);
      
      const repairHistory = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt,
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      }, agent, prompt);
      
      console.log('✅ Repair history lookup successful');
      console.log('📊 Repair records found:', repairHistory ? 'Yes' : 'No');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_history_lookup',
        agent: agent,
        tool: tool,
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
    const agent = 'Domestic-repair-agent';
    const tool = 'createRepairTool';
    const repairId = `REP${Date.now()}`;
    const prompt = `Create a new repair booking for September 18th, 6pm visit for セブンイレブン 秋葉原店, automatic vending machine maintenance needed. Repair ID: ${repairId}`;
    
    try {
      await this.logStep(3, "New Repair Booking Creation - September 18th, 6pm", agent, tool, prompt);
      
      const newRepair = await this.callZapierTool('google_sheets_create_spreadsheet_row', {
        instructions: prompt
      }, agent, prompt);
      
      console.log('✅ New repair booking created');
      console.log('📊 Repair booking result:', newRepair ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'repair_booking_creation',
        agent: agent,
        tool: tool,
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
    const agent = 'Domestic-orchestrator';
    const tool = 'logCustomerData';
    const prompt = 'Create a log entry for repair booking confirmation for セブンイレブン 秋葉原店';
    
    try {
      await this.logStep(4, "Log Entry Creation - Booking Confirmation", agent, tool, prompt);
      
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
      }, agent, prompt);
      
      console.log('✅ Log entry created');
      console.log('📊 Log entry result:', logEntry ? 'Success' : 'Failed');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'log_entry_creation',
        agent: agent,
        tool: tool,
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
    const agent = 'Domestic-orchestrator';
    const tool = 'validateContext';
    const prompt1 = "Find the most recent repair booking for セブンイレブン 秋葉原店";
    const prompt2 = "Find the most recent log entry for CUST004";
    
    try {
      await this.logStep(5, "Data Verification - Confirm Records Created", agent, tool, `${prompt1} | ${prompt2}`);
      
      // Verify the repair booking was created
      const repairVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt1,
        lookup_key: '会社名',
        lookup_value: 'セブンイレブン 秋葉原店'
      }, agent, prompt1);
      
      // Verify the log entry was created
      const logVerification = await this.callZapierTool('google_sheets_lookup_spreadsheet_rows_advanced', {
        instructions: prompt2,
        lookup_key: '顧客ID',
        lookup_value: 'CUST004'
      }, agent, prompt2);
      
      console.log('✅ Data verification completed');
      console.log('📊 Repair verification:', repairVerification ? 'Found' : 'Not found');
      console.log('📊 Log verification:', logVerification ? 'Found' : 'Not found');
      
      this.conversationLog.push({
        timestamp: new Date().toISOString(),
        role: 'system',
        action: 'data_verification',
        agent: agent,
        tool: tool,
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

  async createMainTrace() {
    // Create the main trace in Langfuse
    try {
      const { langfuse } = await import('./dist/integrations/langfuse.js');
      
      // Start the main trace
      const mainTraceId = await langfuse.startTrace('E2E Test - Complete Conversation Flow', {
        sessionId: this.sessionId,
        testType: 'Complete E2E Test',
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
        agents: Object.keys(this.agents),
        startTime: this.startTime.toISOString()
      });
      
      // Update the trace ID to use the one from Langfuse
      this.traceId = mainTraceId;
      
      console.log(`📊 Main Langfuse trace created: ${this.traceId}`);
    } catch (error) {
      console.log(`⚠️ Main trace creation failed: ${error.message}`);
    }
  }

  calculateSuccessRates() {
    // Calculate agent success rates
    const agentStats = {};
    Object.keys(this.agents).forEach(agentName => {
      const agentLogs = this.agentLog.filter(log => log.agent === agentName);
      const successful = agentLogs.filter(log => log.success).length;
      const total = agentLogs.length;
      agentStats[agentName] = {
        total,
        successful,
        failed: total - successful,
        successRate: total > 0 ? (successful / total * 100).toFixed(2) : '0.00'
      };
    });

    // Calculate tool success rates
    const toolStats = {};
    this.toolLog.forEach(log => {
      if (!toolStats[log.tool]) {
        toolStats[log.tool] = { total: 0, successful: 0, failed: 0 };
      }
      toolStats[log.tool].total++;
      if (log.success) {
        toolStats[log.tool].successful++;
      } else {
        toolStats[log.tool].failed++;
      }
    });

    // Calculate success rates for tools
    Object.keys(toolStats).forEach(toolName => {
      const stats = toolStats[toolName];
      stats.successRate = (stats.successful / stats.total * 100).toFixed(2);
    });

    return { agentStats, toolStats };
  }

  async runCompleteE2ETest() {
    console.log('🚀 Starting Complete Langfuse E2E Trace Test');
    console.log('=' .repeat(60));
    console.log(`📋 Session ID: ${this.sessionId}`);
    console.log(`🔍 Trace ID: ${this.traceId}`);
    console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
    console.log(`📊 Langfuse: ${this.langfuseHost}`);
    console.log('=' .repeat(60));
    
    // Create main trace
    await this.createMainTrace();
    
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
    
    // Calculate success rates
    const { agentStats, toolStats } = this.calculateSuccessRates();
    
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
    
    // Show agent success rates
    console.log('\n🤖 Agent Success Rates:');
    console.log('=' .repeat(60));
    Object.entries(agentStats).forEach(([agentName, stats]) => {
      console.log(`${agentName}:`);
      console.log(`  Total: ${stats.total}`);
      console.log(`  Successful: ${stats.successful}`);
      console.log(`  Failed: ${stats.failed}`);
      console.log(`  Success Rate: ${stats.successRate}%`);
      console.log('');
    });
    
    // Show tool success rates
    console.log('🔧 Tool Success Rates:');
    console.log('=' .repeat(60));
    Object.entries(toolStats).forEach(([toolName, stats]) => {
      console.log(`${toolName}:`);
      console.log(`  Total: ${stats.total}`);
      console.log(`  Successful: ${stats.successful}`);
      console.log(`  Failed: ${stats.failed}`);
      console.log(`  Success Rate: ${stats.successRate}%`);
      console.log('');
    });
    
    // Show prompt usage summary
    console.log('📝 Prompt Usage Summary:');
    console.log('=' .repeat(60));
    this.promptLog.forEach((log, index) => {
      console.log(`${index + 1}. Agent: ${log.agent}`);
      console.log(`   Tool: ${log.tool}`);
      console.log(`   Prompt: ${log.prompt}`);
      console.log(`   Result: ${log.result ? 'Success' : 'Failed'}`);
      console.log('');
    });
    
    // Save comprehensive results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `langfuse-e2e-trace-results-${timestamp}.json`;
    const logsFile = `langfuse-e2e-trace-conversation-logs-${timestamp}.json`;
    const recordsFile = `langfuse-e2e-trace-records-${timestamp}.json`;
    const agentsFile = `langfuse-e2e-trace-agents-${timestamp}.json`;
    const toolsFile = `langfuse-e2e-trace-tools-${timestamp}.json`;
    const promptsFile = `langfuse-e2e-trace-prompts-${timestamp}.json`;
    
    await this.saveResults(resultsFile, logsFile, recordsFile, agentsFile, toolsFile, promptsFile, results, agentStats, toolStats);
    
    // End the main trace
    try {
      const { langfuse } = await import('./dist/integrations/langfuse.js');
      await langfuse.endTrace(this.traceId, {
        finalResult: successCount === totalSteps ? 'success' : 'partial_success',
        totalSteps: totalSteps,
        successfulSteps: successCount,
        failedSteps: totalSteps - successCount,
        totalTime: totalTime,
        agentStats: agentStats,
        toolStats: toolStats,
        conversationLog: this.conversationLog
      });
      console.log(`📊 Main trace ended: ${this.traceId}`);
    } catch (error) {
      console.log(`⚠️ Trace ending failed: ${error.message}`);
    }
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    console.log(`💾 Conversation logs saved to: ${logsFile}`);
    console.log(`💾 Records data saved to: ${recordsFile}`);
    console.log(`💾 Agent tracking saved to: ${agentsFile}`);
    console.log(`💾 Tool tracking saved to: ${toolsFile}`);
    console.log(`💾 Prompt tracking saved to: ${promptsFile}`);
    
    console.log(`\n📊 Langfuse Trace: ${this.traceId}`);
    console.log(`🌐 View in Langfuse: ${this.langfuseHost}/traces/${this.traceId}`);
    
    return {
      success: successCount === totalSteps,
      results,
      totalTime,
      files: { resultsFile, logsFile, recordsFile, agentsFile, toolsFile, promptsFile },
      sessionId: this.sessionId,
      traceId: this.traceId,
      agentStats,
      toolStats,
      promptLog: this.promptLog
    };
  }

  async saveResults(resultsFile, logsFile, recordsFile, agentsFile, toolsFile, promptsFile, results, agentStats, toolStats) {
    const fs = await import('fs');
    
    const resultsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      testResults: this.testResults,
      summary: {
        totalSteps: this.testResults.length,
        successfulSteps: this.testResults.filter(r => r.success).length,
        failedSteps: this.testResults.filter(r => !r.success).length,
        totalTime: (new Date() - this.startTime) / 1000
      },
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    const logsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      conversationLog: this.conversationLog,
      testResults: this.testResults,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    const recordsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      records: results,
      conversationLog: this.conversationLog,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    const agentsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      agentLog: this.agentLog,
      agentStats: agentStats,
      agents: this.agents,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    const toolsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      toolLog: this.toolLog,
      toolStats: toolStats,
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    const promptsData = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      traceId: this.traceId,
      promptLog: this.promptLog,
      promptSummary: this.promptLog.map(log => ({
        agent: log.agent,
        tool: log.tool,
        prompt: log.prompt,
        timestamp: log.timestamp,
        success: !!log.result
      })),
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
      langfuseUrl: `${this.langfuseHost}/traces/${this.traceId}`
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
    fs.writeFileSync(logsFile, JSON.stringify(logsData, null, 2));
    fs.writeFileSync(recordsFile, JSON.stringify(recordsData, null, 2));
    fs.writeFileSync(agentsFile, JSON.stringify(agentsData, null, 2));
    fs.writeFileSync(toolsFile, JSON.stringify(toolsData, null, 2));
    fs.writeFileSync(promptsFile, JSON.stringify(promptsData, null, 2));
  }
}

// Run the complete test
const test = new LangfuseE2ETraceTest();
const results = await test.runCompleteE2ETest();

if (results.success) {
  console.log('\n🎉 All tests passed! Complete E2E test with Langfuse tracing completed successfully.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🔍 Trace ID: ${results.traceId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`📊 Langfuse Trace: ${results.langfuseHost}/traces/${results.traceId}`);
  console.log(`🤖 Agents tracked: ${Object.keys(results.agentStats).length}`);
  console.log(`🔧 Tools tracked: ${Object.keys(results.toolStats).length}`);
  console.log(`📝 Prompts used: ${results.promptLog.length}`);
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Check the results for details.');
  console.log(`📋 Session ID: ${results.sessionId}`);
  console.log(`🔍 Trace ID: ${results.traceId}`);
  console.log(`🌐 UI: https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`📊 Langfuse Trace: ${results.langfuseHost}/traces/${results.traceId}`);
  console.log(`🤖 Agents tracked: ${Object.keys(results.agentStats).length}`);
  console.log(`🔧 Tools tracked: ${Object.keys(results.toolStats).length}`);
  console.log(`📝 Prompts used: ${results.promptLog.length}`);
  process.exit(1);
}
