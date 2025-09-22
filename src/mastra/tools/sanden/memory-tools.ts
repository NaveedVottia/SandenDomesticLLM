import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sharedMastraMemory, getCustomerData } from "../../shared-memory.js";

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

// Helper function to get formatted customer profile from memory
const getCustomerProfile = async (resourceId: string, threadId: string) => {
  try {
    const customerData = await getCustomerData({ resource: resourceId, thread: threadId });

    if (customerData && customerData.customerId) {
      return WORKING_MEMORY_TEMPLATE
        .replace("{{customerId}}", customerData.customerId || "N/A")
        .replace("{{storeName}}", customerData.storeName || "N/A")
        .replace("{{email}}", customerData.email || "N/A")
        .replace("{{phone}}", customerData.phone || "N/A")
        .replace("{{location}}", customerData.location || "N/A")
        .replace("{{lastInteraction}}", customerData.lastInteraction || "N/A")
        .replace("{{currentAgent}}", customerData.currentAgent || "N/A")
        .replace("{{sessionStart}}", customerData.sessionStart || "N/A");
    }
    return null;
  } catch (error) {
    console.error("❌ [DEBUG] Error getting customer profile:", error);
    return null;
  }
};

// Memory management tools
export const getCustomerProfileTool = createTool({
  id: "getCustomerProfile",
  description: "Get the current customer profile from shared memory",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for memory access"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    profile: z.string().optional(),
    customerId: z.string().optional(),
    hasProfile: z.boolean(),
  }),
  execute: async ({ context }: { context: { sessionId: string } }) => {
    try {
      const { sessionId } = context;
      const resourceId = sessionId; // Use sessionId as resourceId
      const threadId = `thread-${sessionId}`;

      const profile = await getCustomerProfile(resourceId, threadId);
      const customerData = await getCustomerData({ resource: resourceId, thread: threadId });
      const customerId = customerData?.customerId;

      if (profile && customerId) {
        console.log(`🔍 [DEBUG] Retrieved customer profile for ${customerId}`);
        return {
          success: true,
          profile,
          customerId,
          hasProfile: true,
        };
      } else {
        console.log(`🔍 [DEBUG] No customer profile found in memory`);
        return {
          success: true,
          hasProfile: false,
        };
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error in getCustomerProfileTool:`, error);
      return {
        success: false,
        hasProfile: false,
      };
    }
  },
});

export const updateCurrentAgentTool = createTool({
  id: "updateCurrentAgent",
  description: "Update the current agent in shared memory",
  inputSchema: z.object({
    agentName: z.string().describe("Name of the current agent"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: any }) => {
    try {
      const { agentName } = input;
      sharedMastraMemory.set("currentAgent", agentName);
      sharedMastraMemory.set("lastInteraction", new Date().toISOString());
      
      console.log(`🔍 [DEBUG] Updated current agent to: ${agentName}`);
      return {
        success: true,
        message: `Current agent updated to ${agentName}`,
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in updateCurrentAgentTool:`, error);
      return {
        success: false,
        message: `Failed to update current agent: ${error.message}`,
      };
    }
  },
});

export const clearCustomerMemoryTool = createTool({
  id: "clearCustomerMemory",
  description: "Clear all customer data from shared memory",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    try {
      // Clear all customer-related memory keys
      const keysToClear = [
        "customerId", "storeName", "email", "phone", "location",
        "lastInteraction", "currentAgent", "sessionStart"
      ];
      
      keysToClear.forEach(key => {
        try {
          sharedMastraMemory.set(key, null);
        } catch (error) {
          console.log(`❌ [DEBUG] Failed to clear key ${key}:`, error);
        }
      });
      
      console.log(`🔍 [DEBUG] Cleared all customer data from memory`);
      return {
        success: true,
        message: "Customer memory cleared successfully",
      };
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error in clearCustomerMemoryTool:`, error);
      return {
        success: false,
        message: `Failed to clear customer memory: ${error.message}`,
      };
    }
  },
});

// Export memory tools
export const memoryTools = {
  getCustomerProfileTool,
  updateCurrentAgentTool,
  clearCustomerMemoryTool,
};
