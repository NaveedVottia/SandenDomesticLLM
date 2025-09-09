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
    
    // Test with a simple repair scheduling request
    const testMessage = "9月16日か17日に自動販売機の修理予約をお願いします。問題は冷えないことです。緊急度は低です。";
    
    console.log('📝 Test message:', testMessage);
    console.log('🔄 Sending to repair scheduling agent...');
    
    const response = await mastra.agent("repair-scheduling").generateText(testMessage);
    
    console.log('✅ Agent response:');
    console.log('==================');
    console.log(response.text);
    console.log('==================');
    
    // Check if tools were called
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('🔧 Tools called:');
      response.toolCalls.forEach((call, index) => {
        console.log(`${index + 1}. ${call.toolName}: ${call.args ? JSON.stringify(call.args, null, 2) : 'No args'}`);
      });
    } else {
      console.log('⚠️ No tools were called - this might be the issue!');
    }
    
  } catch (error) {
    console.error('❌ Error testing repair scheduling agent:', error);
  }
}

testRepairSchedulingAgent();
