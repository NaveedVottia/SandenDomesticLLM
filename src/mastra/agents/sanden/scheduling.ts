import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";
import { sharedMemory } from "./customer-identification.js";

export const repairVisitConfirmationAgent = new Agent({
  name: "Domestic-repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
  },
  memory: sharedMemory, // Use shared memory
});

// Bind prompt from Langfuse
(async () => {
  try {
    const instructions = await loadLangfusePrompt("Domestic-repair-scheduling", { label: "production" });
    if (instructions) {
      // Use the correct method to update instructions
      (repairVisitConfirmationAgent as any).__updateInstructions(instructions);
      console.log(`[Langfuse] ✅ Loaded prompt via SDK: Domestic-repair-scheduling`);
    } else {
      console.error("[Langfuse] No prompt content received from Langfuse for Domestic-repair-scheduling");
      (repairVisitConfirmationAgent as any).__updateInstructions("You are a helpful AI assistant. Please respond to user messages.");
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load Domestic-repair-scheduling prompt:", error);
    (repairVisitConfirmationAgent as any).__updateInstructions("You are a helpful AI assistant. Please respond to user messages.");
  }
})();
