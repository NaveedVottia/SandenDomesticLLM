/**
 * Test the session-aware workflow with session end scenario
 */

import { runCustomerIdentificationWorkflow } from './src/mastra/workflows/sanden/customer-identification-workflow.ts';

async function testWorkflowSessionEnd() {
  console.log('🧪 Testing session-aware workflow with session end (contact form)...');

  try {
    const result = await runCustomerIdentificationWorkflow('3', {
      testCaseId: 'session_end_test_001',
      evaluationMode: true
    });

    console.log('📊 Workflow Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Evaluation Complete: ${result.evaluationComplete}`);
    console.log(`   Response Length: ${result.response?.length || 0} chars`);
    console.log(`   Has Aggregation Result: ${!!result.aggregationResult}`);

    if (result.aggregationResult) {
      const agg = result.aggregationResult;
      console.log('\n🎯 Aggregation Details:');
      console.log(`   Aggregation Success: ${agg.success}`);
      if (agg.success) {
        console.log(`   Weighted Session Score: ${agg.sessionAggregation?.weightedSessionScore?.toFixed(2)}/5.0`);
        console.log(`   Trace Count: ${agg.sessionAggregation?.traceCount}`);
        console.log(`   Tool Sequence Variability: ${(agg.sessionAggregation?.dispersionMetrics?.toolSequenceVariability * 100)?.toFixed(1)}%`);
      }
    }

    console.log('\n📝 Response Preview:');
    console.log(result.response?.substring(0, 200) + (result.response?.length > 200 ? '...' : ''));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test with continuing session
async function testWorkflowContinue() {
  console.log('\n🧪 Testing session-aware workflow with session continue (repair request)...');

  try {
    const result = await runCustomerIdentificationWorkflow('cust001 の修理履歴を見せてください', {
      testCaseId: 'session_continue_test_001',
      evaluationMode: true
    });

    console.log('📊 Workflow Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Evaluation Complete: ${result.evaluationComplete}`);
    console.log(`   Has Aggregation Result: ${!!result.aggregationResult}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run both tests
async function runTests() {
  await testWorkflowSessionEnd();
  await testWorkflowContinue();
  console.log('\n✅ Workflow testing complete!');
}

runTests().catch(console.error);
