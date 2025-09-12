import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools";
import { customerTools } from "../../tools/sanden/customer-tools";
import { commonTools } from "../../tools/sanden/common-tools";
import { memoryTools } from "../../tools/sanden/memory-tools";
import { loadLangfusePrompt } from "../../prompts/langfuse";
import { langfuse } from "../../../integrations/langfuse";
import { sharedMemory } from "./customer-identification";

export const repairVisitConfirmationAgent = new Agent({
  name: "Domestic-repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-haiku-20240307-v1:0"),
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
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load Domestic-repair-scheduling prompt:", error);
  }
})();
