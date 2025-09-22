import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { repairTools } from "../../tools/sanden/repair-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { z } from "zod";
import { sharedMastraMemory, createMemoryIds, storeCustomerData, getCustomerData } from "../../shared-memory.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables FIRST before any Langfuse operations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../server.env") });

// Load instructions from Langfuse synchronously first
let REPAIR_AGENT_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("customer-identification", undefined, { cacheTtlSeconds: 0 });
  REPAIR_AGENT_INSTRUCTIONS = promptClient?.prompt?.trim() || "";
  console.log(`[Langfuse] ✅ Loaded customer-identification prompt via SDK (v${promptClient.version}) - using original prompt like repair history`);
} catch (error) {
  console.error("[Langfuse] Failed to load customer-identification prompt:", error);
  REPAIR_AGENT_INSTRUCTIONS = "";
}

// Agent will be created after tool definitions

// Debug logging
console.log("🔍 Customer Identification Agent Configuration:");
console.log("📝 Langfuse Prompt Loading: ✅ Enabled");
console.log("📝 Model Temperature: 0.1 (deterministic)");
console.log("📝 Max Tokens: 1000");
console.log("📝 Memory: ✅ Using proper Mastra Memory with resource/thread IDs");

// Create a custom delegateTo tool that automatically includes customer ID from memory
const enhancedDelegateTo = {
  ...orchestratorTools.delegateTo,
  execute: async (args: any) => {
    const parsed = args.input || args.context || {};
    const agentId = parsed.agentId || "customer-identification";
    const agentContext = parsed.context || {};
    const message = parsed.message || "顧客情報の確認をお願いします。";
    
    console.log(`🔍 [DEBUG] Delegating to ${agentId} with context:`, JSON.stringify(agentContext));
    
    // Call the original delegateTo tool
    return orchestratorTools.delegateTo.execute({
      ...args,
      context: {
        ...parsed,
        context: agentContext
      }
    });
  }
};


// Create a direct repair history tool that bypasses delegation
const directRepairHistoryTool = {
  id: "directRepairHistory",
  description: "Get repair history directly without delegation",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Customer ID to get repair history for"),
    sessionId: z.string().optional().describe("Session ID for memory lookup"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async (args: any) => {
    let { customerId, sessionId } = args.input || args.context || {};
    
    // If customerId is not provided, try to get it from shared memory
    if (!customerId) {
      try {
        // Use the provided sessionId or try common session IDs
        const sessionIdsToTry = sessionId ? [sessionId] : ['default', 'current', 'session'];
        
        for (const sid of sessionIdsToTry) {
          const memIds = createMemoryIds(sid);
          const customerData = await getCustomerData(memIds);
          if (customerData && customerData.customerId) {
            customerId = customerData.customerId;
            console.log(`🔍 [DEBUG] Retrieved customer ID from memory: ${customerId} (session: ${sid})`);
            break;
          }
        }
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from memory:`, error);
      }
    }
    
    if (!customerId) {
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客情報を確認してください。",
      };
    }
    
    try {
      console.log(`🔍 [DEBUG] Direct repair history lookup for customer ID: ${customerId}`);
      
      // Import the repair tool directly
      const { hybridGetRepairsByCustomerIdTool } = await import("../../tools/sanden/repair-tools");
      
      const result = await hybridGetRepairsByCustomerIdTool.execute({
        context: { customerId }
      });
      
      console.log(`🔍 [DEBUG] Direct repair history result:`, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in direct repair history:`, error);
      return {
        success: false,
        data: null,
        message: `エラーが発生しました: ${error.message}`,
      };
    }
  },
};

// Create a custom lookupCustomerFromDatabase tool that stores customer ID in shared memory
const enhancedLookupCustomerFromDatabase = {
  ...orchestratorTools.lookupCustomerFromDatabase,
  execute: async (args: any) => {
    const result = await orchestratorTools.lookupCustomerFromDatabase.execute(args);
    
    // If customer was found, store the customer ID and profile in shared memory
    if (result.found && result.customerData && result.customerData.customerId) {
      try {
        const customerData = result.customerData;
        
        // Create memory IDs for this session using a consistent session ID
        const sessionId = `session-${customerData.customerId}`;
        const memIds = createMemoryIds(sessionId, customerData.customerId);
        
        // Store customer data using the proper shared memory functions
        await storeCustomerData(memIds, customerData);
        
        console.log(`🔍 [DEBUG] Stored complete customer profile in shared memory:`, {
          customerId: customerData.customerId,
          storeName: customerData.storeName,
          email: customerData.email,
          phone: customerData.phone,
          location: customerData.location
        });
      } catch (error) {
        console.log(`❌ [DEBUG] Failed to store customer profile in shared memory:`, error);
      }
    }
    
    return result;
  }
};

// Create agent with instructions loaded from Langfuse
export const routingAgentCustomerIdentification = new Agent({
  name: "customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",
  instructions: REPAIR_AGENT_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0", {
    temperature: 0.1,
    maxTokens: 1000,
    region: process.env.AWS_REGION || "ap-northeast-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
  tools: {
    // Re-enable all tools with fixed schemas
    ...commonTools,
    ...customerTools,
    ...repairTools,
    ...productTools,
    delegateTo: enhancedDelegateTo,
    lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
    directRepairHistory: directRepairHistoryTool,
    confirmAndLogRepair: orchestratorTools.confirmAndLogRepair,
  },
  memory: sharedMastraMemory, // Re-enable shared memory
});

function initializeAgent() {
  return routingAgentCustomerIdentification;
}

// Export the agent and initialization function
export { initializeAgent, sharedMastraMemory };

// Export the agent directly for compatibility
export const getRoutingAgentCustomerIdentification = () => routingAgentCustomerIdentification;

console.log("✅ Customer Identification Agent module loaded");
