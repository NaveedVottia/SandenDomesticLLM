import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { Langfuse } from "langfuse";
import { extractCustomerId, createToolContext } from "../../utils/customer-context.js";
import { z } from "zod";
import dotenv from "dotenv";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";

// Load environment variables
dotenv.config({ path: "./server.env" });

// Debug logging
console.log("🔍 Customer Identification Agent Instructions:");
console.log("📝 Using dynamic Langfuse loading");

// Session-aware shared memory using Mastra Memory for SDKv5 compatibility
const createSessionAwareMemory = () => {
  return new Memory();
};

// Global shared memory instance
const sharedMemory = createSessionAwareMemory();

// Working memory template for customer profiles
const WORKING_MEMORY_TEMPLATE = `# Customer Profile
- **Customer ID**: {{customerId}}
- **Store Name**: {{storeName}}
- **Email**: {{email}}
- **Phone**: {{phone}}
- **Location**: {{location}}
- **Last Interaction**: {{lastInteraction}}
- **Current Agent**: {{currentAgent}}
- **Session Start**: {{sessionStart}}`;

// Create a custom delegateTo tool that automatically includes customer ID from memory
const enhancedDelegateTo = {
  ...orchestratorTools.delegateTo,
  execute: async (args: any) => {
    const parsed = args.input || args.context || {};
    const agentId = parsed.agentId || "customer-identification";
    const agentContext = parsed.context || {};
    const message = parsed.message || "顧客情報の確認をお願いします。";

    // Use standardized customer context handling
    const toolContext = createToolContext(agentContext);
    const customerId = extractCustomerId(toolContext);

    // If we have a customer ID, add it to the context
    const enhancedContext = customerId ? { ...agentContext, customerId } : agentContext;

    console.log(`🔍 [SDKv5] Delegating to ${agentId} with context:`, JSON.stringify(enhancedContext));

    // Call the original delegateTo tool with enhanced context
    return orchestratorTools.delegateTo.execute({
      ...args,
      context: {
        ...parsed,
        context: enhancedContext
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
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    message: z.string(),
  }),
  execute: async (args: any) => {
    const { customerId } = args.input || args.context || {};

    if (!customerId) {
      return {
        success: false,
        data: null,
        message: "顧客IDが必要です。",
      };
    }

    try {
      console.log(`🔍 [SDKv5] Direct repair history lookup for customer ID: ${customerId}`);

      // Import the repair tool directly
      const { hybridGetRepairsByCustomerIdTool } = await import("../../tools/sanden/repair-tools");

      const result = await hybridGetRepairsByCustomerIdTool.execute({
        context: { customerId }
      });

      console.log(`🔍 [SDKv5] Direct repair history result:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      console.error(`❌ [SDKv5] Error in direct repair history:`, error);
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

        console.log(`🔍 [SDKv5] Storing customer profile in shared memory:`, {
          customerId: customerData.customerId,
          storeName: customerData.storeName,
          email: customerData.email,
          phone: customerData.phone,
          location: customerData.location
        });

        // Note: In SDKv5, we don't directly manipulate memory like this
        // The agent will handle memory through the Mastra framework
      } catch (error) {
        console.log(`❌ [SDKv5] Error handling customer data:`, error);
      }
    }

    return result;
  }
};

// Create Mastra Agent with SDKv5 model
export const routingAgentCustomerIdentification = new Agent({
  name: "Domestic-customer-identification",
  description: "サンデン・リテールシステム修理受付AI , 顧客識別エージェント",

  // Instructions will be loaded from Langfuse dynamically
  instructions: "",

  // Use bedrock model for SDKv5 compatibility
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),

  tools: {
    ...customerTools,
    ...commonTools,
    delegateTo: enhancedDelegateTo,
    lookupCustomerFromDatabase: enhancedLookupCustomerFromDatabase,
    directRepairHistory: directRepairHistoryTool,
  },

  memory: sharedMemory, // Use shared memory
});

console.log("✅ SDKv5 Customer Identification Agent created");

// Load instructions from Langfuse dynamically for SDKv5
(async () => {
  try {
    const instructions = await loadLangfusePrompt("Domestic-customer-identification", { label: "production" });
    if (instructions) {
      (routingAgentCustomerIdentification as any).__updateInstructions?.(instructions);
      console.log(`[Langfuse] ✅ Loaded Domestic-customer-identification prompt for SDKv5`);
    } else {
      console.error("[Langfuse] No prompt content received from Langfuse");
      (routingAgentCustomerIdentification as any).__updateInstructions?.("You are a helpful AI assistant. Please respond to user messages.");
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load Domestic-customer-identification prompt:", error);
    (routingAgentCustomerIdentification as any).__updateInstructions?.("You are a helpful AI assistant. Please respond to user messages.");
  }
})();

// Export the shared memory instance for use in other agents
export { sharedMemory };
