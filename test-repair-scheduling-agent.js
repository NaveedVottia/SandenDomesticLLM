import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from server.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "server.env") });

async function testRepairSchedulingAgent() {
  console.log('🧪 Testing repair scheduling agent...');

  try {
    // Import the mastra instance
    const { mastraPromise } = await import("./src/mastra/index.ts");

    console.log("✅ Mastra instance loaded");

    // Wait for the mastra instance to be ready
    const mastra = await mastraPromise;

    // Test 1: Test delegation/initial response
    console.log('\n=== TEST 1: Initial delegation response ===');
    const delegationMessage = "Delegating to repair scheduling agent for customer CUST008";

    console.log('📝 Test message:', delegationMessage);
    console.log('🔄 Sending to repair scheduling agent...');

    const response1 = await mastra.getAgentById("repair-scheduling").generateText(delegationMessage);

    console.log('✅ Agent response:');
    console.log('==================');
    console.log(response1.text);
    console.log('==================');

    // Test 2: Test with actual repair request
    console.log('\n=== TEST 2: Repair request ===');
    const testMessage = "coffee machine needs maintenance, send someone at 8pm september 19th.";

    console.log('📝 Test message:', testMessage);
    console.log('🔄 Sending to repair scheduling agent...');

    const response2 = await mastra.getAgentById("repair-scheduling").generateText(testMessage, {
      sessionId: "test-session-cust008"
    });

    console.log('✅ Agent response:');
    console.log('==================');
    console.log(response2.text);
    console.log('==================');

    // Test 3: Test confirmation response
    console.log('\n=== TEST 3: Confirmation response ===');
    const confirmMessage = "yes confirm";

    console.log('📝 Test message:', confirmMessage);
    console.log('🔄 Sending to repair scheduling agent...');

    const response3 = await mastra.getAgentById("repair-scheduling").generateText(confirmMessage, {
      sessionId: "test-session-cust008"
    });

    console.log('✅ Agent response:');
    console.log('==================');
    console.log(response3.text);
    console.log('==================');

    // Check if tools were called in any response
    console.log('\n=== TOOL CALLS ANALYSIS ===');
    [response1, response2, response3].forEach((response, index) => {
      console.log(`\nResponse ${index + 1}:`);
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('🔧 Tools called:');
        response.toolCalls.forEach((call, callIndex) => {
          console.log(`  ${callIndex + 1}. ${call.toolName}: ${call.args ? JSON.stringify(call.args, null, 2) : 'No args'}`);
        });
      } else {
        console.log('⚠️ No tools were called');
      }
    });

  } catch (error) {
    console.error('❌ Error testing repair scheduling agent:', error);
  }
}

testRepairSchedulingAgent();
