import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { confirmAndLogRepair } from "../../tools/sanden/repair-logging.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";
import { sharedMastraMemory } from "../../shared-memory.js";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Create tool wrapper for confirmAndLogRepair
const confirmAndLogRepairTool = createTool({
  id: "confirmAndLogRepair",
  description: "Validate and log repair appointment to both Google Sheets and Calendar with proper data mapping",
  inputSchema: z.object({
    customerId: z.string().min(1),
    storeName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    product: z
      .object({
        productId: z.string().optional(),
        category: z.string().optional(),
        model: z.string().optional(),
        serial: z.string().optional(),
        warranty: z.string().optional(),
      })
      .optional(),
    appointment: z.object({
      dateTimeISO: z
        .string()
        .refine(v => !Number.isNaN(Date.parse(v)), "Invalid ISO datetime"),
      display: z.string().min(1),
    }),
    issue: z.string().min(1),
    contactName: z.string().min(1),
    contactPhone: z.string().regex(/^[0-9+\-()\s]+$/).min(7),
    machineLabel: z.string().min(1),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    repairId: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    console.log("[TOOL] confirmAndLogRepair called with context:", JSON.stringify(context, null, 2));
    // Pass mastra instance if needed
    return await confirmAndLogRepair(context, null);
  },
});

// Simple approach: Add a tool that directly calls confirmAndLogRepair when user confirms
// This is more reliable than intercepting the stream method

// Create the agent with tools
export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",

  instructions: "", // Will be loaded from Langfuse

  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...productTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
    confirmAndLogRepair: confirmAndLogRepairTool,
  } as any,
  memory: sharedMastraMemory, // Use shared memory instead of new Memory()
});

// Bind prompt from Langfuse
(async () => {
  try {
    console.log("🔄 Loading repair-scheduling prompt from Langfuse...");
    const prompt = await loadLangfusePrompt("repair-scheduling", {cacheTtlMs: 0 , label: "production" });
    if (prompt) {
      (repairVisitConfirmationAgent as any).__updateInstructions(prompt);
      console.log("✅ Repair-scheduling prompt loaded successfully, length:", prompt.length);
    } else {
      console.log("❌ No prompt found for repair-scheduling");
    }
    try {
      await langfuse.logPrompt("repair-scheduling", { label: "production", agentId: "repair-scheduling" }, prompt, { length: prompt?.length || 0 });
    } catch (logError) {
      console.log("⚠️ Failed to log prompt to Langfuse:", logError instanceof Error ? logError.message : String(logError));
    }
  } catch (error) {
    console.error("❌ Failed to load repair-scheduling prompt:", error);
  }
})();
