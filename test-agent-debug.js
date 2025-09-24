import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), 'server.env') });

import { runCustomerIdentificationWorkflow } from './src/mastra/workflows/sanden/customer-identification-workflow.ts';

async function debugAgent() {
  console.log('🔧 AGENT DEBUG TEST');
  console.log('='.repeat(50));

  // Test the most critical case - CUST detection
  const testInput = "cust001 の修理履歴を見せてください";

  console.log(`📝 Testing input: "${testInput}"`);
  console.log('Expected behavior per prompt:');
  console.log('1. Detect "CUST" pattern');
  console.log('2. Interrupt other processing');
  console.log('3. Execute lookupCustomerFromDatabase immediately');
  console.log('4. Use tool results, not generic responses');
  console.log('');

  try {
    const result = await runCustomerIdentificationWorkflow(testInput, {
      testCaseId: "debug_cust_detection",
      evaluationMode: false // Disable evaluation for debugging
    });

    console.log('🤖 AGENT RESPONSE:');
    console.log('='.repeat(30));
    console.log(result.response);
    console.log('='.repeat(30));

    console.log('\n🔍 RESPONSE ANALYSIS:');

    // Check for prompt compliance
    const hasToolCall = result.response.includes('lookupCustomerFromDatabase') ||
                       result.response.includes('修理履歴') ||
                       result.response.includes('顧客情報');

    const hasCustProcessing = result.response.includes('CUST') ||
                             result.response.includes('cust001') ||
                             result.response.includes('顧客ID');

    const isGenericGreeting = result.response.includes('こんにちは') &&
                             result.response.includes('サポート') &&
                             !result.response.includes('cust001');

    console.log('✅ Tool usage detected:', hasToolCall ? 'YES' : '❌ NO');
    console.log('✅ CUST processing detected:', hasCustProcessing ? 'YES' : '❌ NO');
    console.log('❌ Generic greeting fallback:', isGenericGreeting ? 'YES (BAD)' : 'NO');

    if (isGenericGreeting && !hasCustProcessing) {
      console.log('\n🚨 CRITICAL ISSUE: Agent is ignoring CUST detection rule!');
      console.log('The prompt requires: "「CUST」で始まる文字列を検知した場合は他処理を中断し、顧客ID検索を最優先とする。"');
      console.log('But agent responded with generic greeting instead of processing CUST input.');
    }

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
}

debugAgent();
