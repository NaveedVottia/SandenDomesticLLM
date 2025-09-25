/**
 * Manual Session Aggregation Test
 * Test the session aggregator directly to verify it works
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from server.env
config({ path: join(process.cwd(), 'server.env') });

import { runSessionAggregatorWorkflow } from './src/mastra/workflows/session-aggregator.ts';
import { createSessionContext, updateSessionContext, completeSessionContext } from './src/utils/session-manager.ts';

async function testManualAggregation() {
  console.log('🔧 MANUAL SESSION AGGREGATION TEST');
  console.log('=' .repeat(50));

  const testSessionId = `test_session_${Date.now()}`;

  try {
    // Step 1: Create a test session with some mock data
    console.log('📝 Step 1: Creating test session...');
    const sessionContext = await createSessionContext({
      user_input: 'test input',
      test_case_id: 'manual_agg_test',
      evaluation_mode: true,
      geniac_topic: 'Topic_1',
      session_type: 'test_session'
    });
    console.log(`   ✅ Session created: ${sessionContext.sessionId}`);

    // Step 2: Add some mock interactions to simulate a conversation
    console.log('📝 Step 2: Adding mock interactions...');
    await updateSessionContext(sessionContext.sessionId, {
      lastUserInput: 'こんにちは',
      lastInteraction: new Date().toISOString(),
      agentInteractions: 5,
      currentAgent: 'customer-identification'
    });

    await updateSessionContext(sessionContext.sessionId, {
      lastUserInput: 'cust009でログイン',
      lastInteraction: new Date(Date.now() + 1000).toISOString(),
      agentInteractions: 10,
      customerId: 'CUST009'
    });

    await updateSessionContext(sessionContext.sessionId, {
      lastUserInput: '3',
      lastInteraction: new Date(Date.now() + 2000).toISOString(),
      agentInteractions: 15,
      shouldEndSession: true
    });
    console.log('   ✅ Mock interactions added');

    // Step 3: Complete the session
    console.log('📝 Step 3: Completing session...');
    await completeSessionContext(sessionContext.sessionId, {
      completed_at: new Date().toISOString(),
      total_interactions: 15,
      final_status: 'contact_form_selected'
    });
    console.log('   ✅ Session completed');

    // Step 4: Run session aggregation
    console.log('📝 Step 4: Running session aggregation...');
    const aggregationResult = await runSessionAggregatorWorkflow(sessionContext.sessionId, {
      judgePromptName: "geniac-trace-judge",
      judgeLabel: "production",
      includeMetadata: true,
      storageOptions: {
        persistToDatabase: true,
        exportToJson: true,
        exportPath: `./session-evaluations/${sessionContext.sessionId}.json`
      }
    });

    console.log('📊 Aggregation Result:');
    console.log(`   Success: ${aggregationResult.success}`);

    // Check if workflow succeeded by looking at the result structure
    const workflowSuccess = aggregationResult.status === 'success' ||
                           (aggregationResult.result && aggregationResult.result.success);

    if (workflowSuccess && aggregationResult.result && aggregationResult.result.sessionAggregation) {
      const agg = aggregationResult.sessionAggregation;
      console.log(`   ✅ Session Score: ${agg.weightedSessionScore?.toFixed(2)}/5.0`);
      console.log(`   🔢 Trace Count: ${agg.traceCount}`);
      console.log(`   🎲 Variability: ${(agg.dispersionMetrics?.toolSequenceVariability * 100)?.toFixed(1)}%`);
      console.log(`   🔐 Hash: ${agg.reproducibilityHash?.substring(0, 16)}...`);
    } else {
      console.log(`   ❌ Aggregation failed:`, aggregationResult.error);
    }

    // Step 5: Check for evaluation file
    console.log('📁 Step 5: Checking for evaluation file...');
    const fs = await import('fs');
    const evalFile = `./session-evaluations/${sessionContext.sessionId}.json`;

    if (fs.existsSync(evalFile)) {
      console.log(`   ✅ Evaluation file created: ${evalFile}`);
      const evalData = JSON.parse(fs.readFileSync(evalFile, 'utf8'));
      console.log(`   📊 Stored Score: ${evalData.weightedSessionScore?.toFixed(2)}/5.0`);
    } else {
      console.log(`   ❌ Evaluation file not found`);
    }

  } catch (error) {
    console.error('❌ Manual aggregation test failed:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📋 MANUAL AGGREGATION TEST COMPLETE');
}

// Run the test
testManualAggregation().then(() => {
  console.log('✅ Manual aggregation test finished');
}).catch(error => {
  console.error('❌ Manual aggregation test error:', error);
});
