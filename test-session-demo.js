/**
 * Session-Aware Workflow Demo
 * Demonstrates the trace-level LLM-as-a-judge system with session aggregation
 */

import { runCustomerIdentificationWorkflow } from './src/mastra/workflows/sanden/customer-identification-workflow.ts';

async function demoSessionWorkflow() {
  console.log('🚀 Session-Aware Workflow Demo');
  console.log('=' .repeat(50));

  // Test case 1: Customer lookup
  const testPrompt = "cust001 の修理履歴を見せてください";
  console.log(`\n📋 Testing prompt: "${testPrompt}"`);

  try {
    const result = await runCustomerIdentificationWorkflow(testPrompt, {
      testCaseId: 'demo_test_001',
      evaluationMode: true
    });

    console.log('\n✅ Workflow Result:');
    console.log(`   Response: ${result.response?.substring(0, 100)}${result.response?.length > 100 ? '...' : ''}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Evaluation Complete: ${result.evaluationComplete}`);
    console.log(`   Raw result keys: ${Object.keys(result).join(', ')}`);

    if (result.evaluationComplete && result.aggregationResult) {
      const agg = result.aggregationResult;
      if (agg.success) {
        console.log('\n🎯 Session Aggregation Results:');
        console.log(`   Overall Score: ${agg.sessionAggregation?.weightedSessionScore?.toFixed(2)}/5.0`);
        console.log(`   Trace Count: ${agg.sessionAggregation?.traceCount}`);
        console.log(`   Tool Sequence Variability: ${(agg.sessionAggregation?.dispersionMetrics?.toolSequenceVariability * 100)?.toFixed(1)}%`);
        console.log(`   Output Validity Variability: ${(agg.sessionAggregation?.dispersionMetrics?.outputValidityVariability * 100)?.toFixed(1)}%`);
        console.log(`   Reproducibility Hash: ${agg.sessionAggregation?.reproducibilityHash?.substring(0, 16)}...`);
      }
    }

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
demoSessionWorkflow().then(() => {
  console.log('\n✅ Session-aware workflow demo complete!');
}).catch(error => {
  console.error('❌ Demo failed:', error);
});
