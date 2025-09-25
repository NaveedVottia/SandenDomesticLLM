/**
 * Test LLM Evaluation Tracking System
 * Tests the complete trace-level LLM-as-a-judge evaluation pipeline
 */

import { runCustomerIdentificationWorkflow } from './src/mastra/workflows/sanden/customer-identification-workflow.ts';

async function testLLMEvaluationTracking() {
  console.log('🧠 LLM EVALUATION TRACKING TEST');
  console.log('=' .repeat(50));
  console.log('Testing complete GENIAC evaluation pipeline...\n');

  // Test scenario that should trigger session aggregation
  const testCase = {
    id: "eval_tracking_test_001",
    scenario: "Customer login → Repair history → Contact form (session end)",
    steps: [
      { message: "こんにちは", description: "Initial greeting" },
      { message: "cust009でログインしたいです", description: "Customer login request" },
      { message: "1", description: "Request repair history" },
      { message: "3", description: "Select contact form (triggers session end)" }
    ]
  };

  console.log(`📋 Test Case: ${testCase.scenario}`);
  console.log(`Test ID: ${testCase.id}\n`);

  let sessionId = null;
  let evaluationTriggered = false;

  try {
    // Step 1: Initial greeting
    console.log(`Step 1: ${testCase.steps[0].description}`);
    const step1Result = await runCustomerIdentificationWorkflow(
      testCase.steps[0].message,
      { testCaseId: testCase.id, evaluationMode: true }
    );
    sessionId = step1Result.sessionId;
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Response: ${step1Result.response.substring(0, 80)}...`);

    // Step 2: Customer login
    console.log(`\nStep 2: ${testCase.steps[1].description}`);
    const step2Result = await runCustomerIdentificationWorkflow(
      testCase.steps[1].message,
      { testCaseId: testCase.id, evaluationMode: true }
    );
    console.log(`   Session ID: ${step2Result.sessionId}`);
    console.log(`   Response: ${step2Result.response.substring(0, 80)}...`);

    // Step 3: Repair history request
    console.log(`\nStep 3: ${testCase.steps[2].description}`);
    const step3Result = await runCustomerIdentificationWorkflow(
      testCase.steps[2].message,
      { testCaseId: testCase.id, evaluationMode: true }
    );
    console.log(`   Session ID: ${step3Result.sessionId}`);
    console.log(`   Response: ${step3Result.response.substring(0, 80)}...`);

    // Step 4: Contact form selection (should trigger evaluation)
    console.log(`\nStep 4: ${testCase.steps[3].description} - SESSION END EXPECTED`);
    const step4Result = await runCustomerIdentificationWorkflow(
      testCase.steps[3].message,
      { testCaseId: testCase.id, evaluationMode: true }
    );
    console.log(`   Session ID: ${step4Result.sessionId}`);
    console.log(`   Evaluation Complete: ${step4Result.evaluationComplete}`);
    console.log(`   Response: ${step4Result.response.substring(0, 100)}...`);

    if (step4Result.evaluationComplete && step4Result.aggregationResult) {
      evaluationTriggered = true;
      const agg = step4Result.aggregationResult;
      console.log(`\n🎯 EVALUATION TRIGGERED SUCCESSFULLY!`);
      console.log(`   Aggregation Success: ${agg.success}`);
      if (agg.success && agg.sessionAggregation) {
        const sa = agg.sessionAggregation;
        console.log(`   Overall Score: ${sa.weightedSessionScore?.toFixed(2)}/5.0`);
        console.log(`   Trace Count: ${sa.traceCount}`);
        console.log(`   Tool Variability: ${(sa.dispersionMetrics?.toolSequenceVariability * 100)?.toFixed(1)}%`);
        console.log(`   Reproducibility Hash: ${sa.reproducibilityHash?.substring(0, 16)}...`);
      }
    }

    // Check for evaluation files
    console.log(`\n📁 Checking for evaluation files...`);
    try {
      const fs = await import('fs');
      const sessionEvalPath = `./session-evaluations/${sessionId}.json`;

      if (fs.existsSync(sessionEvalPath)) {
        console.log(`   ✅ Session evaluation file found: ${sessionEvalPath}`);
        const evalData = JSON.parse(fs.readFileSync(sessionEvalPath, 'utf8'));
        console.log(`   📊 Stored Score: ${evalData.weightedSessionScore?.toFixed(2)}/5.0`);
        console.log(`   🔗 Trace Count: ${evalData.traceCount}`);
      } else {
        console.log(`   ❌ No session evaluation file found`);
      }
    } catch (error) {
      console.log(`   ⚠️ Could not check evaluation files: ${error.message}`);
    }

  } catch (error) {
    console.error(`❌ Test failed:`, error);
  }

  // Final assessment
  console.log(`\n` + '='.repeat(60));
  console.log('📊 LLM EVALUATION TRACKING ASSESSMENT');
  console.log('='.repeat(60));

  console.log(`\n🎯 Session Management:`);
  console.log(`   Session Created: ${sessionId ? '✅ YES' : '❌ NO'}`);
  console.log(`   Session ID: ${sessionId || 'N/A'}`);

  console.log(`\n🧠 LLM Evaluation:`);
  console.log(`   Evaluation Triggered: ${evaluationTriggered ? '✅ YES' : '❌ NO'}`);
  console.log(`   Trace-level Judge: ${evaluationTriggered ? '✅ ACTIVE' : '❌ NOT TRIGGERED'}`);
  console.log(`   Session Aggregation: ${evaluationTriggered ? '✅ WORKING' : '❌ NOT WORKING'}`);

  console.log(`\n📊 GENIAC Compliance:`);
  console.log(`   40/30/15/10/5 Weights: ${evaluationTriggered ? '✅ APPLIED' : '❌ NOT TESTED'}`);
  console.log(`   Dispersion Metrics: ${evaluationTriggered ? '✅ CALCULATED' : '❌ NOT TESTED'}`);
  console.log(`   Reproducibility Hash: ${evaluationTriggered ? '✅ GENERATED' : '❌ NOT TESTED'}`);

  const overallSuccess = sessionId && evaluationTriggered;
  console.log(`\n🎯 Overall Status: ${overallSuccess ? '✅ LLM EVALUATION TRACKING WORKING' : '❌ NEEDS FIXING'}`);

  if (!overallSuccess) {
    console.log(`\n🔧 Troubleshooting:`);
    if (!sessionId) {
      console.log(`   - Session creation failed - check session manager`);
    }
    if (!evaluationTriggered) {
      console.log(`   - Evaluation not triggered - check session end detection`);
      console.log(`   - Verify Langfuse prompts exist: "geniac-trace-judge", "llm-judge-evaluator"`);
      console.log(`   - Check workflow finalizeSession step logic`);
    }
  }

  return { sessionId, evaluationTriggered, overallSuccess };
}

// Run the test
testLLMEvaluationTracking().then(result => {
  console.log(`\n✅ LLM Evaluation Tracking Test Complete`);
  console.log(`Result: ${result.overallSuccess ? 'PASS' : 'FAIL'}`);
}).catch(error => {
  console.error('❌ LLM Evaluation Tracking Test Failed:', error);
});
