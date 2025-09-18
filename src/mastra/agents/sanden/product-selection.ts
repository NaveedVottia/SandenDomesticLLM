import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { loadLangfusePrompt } from "../../prompts/langfuse.js";
import { langfuse } from "../../../integrations/langfuse.js";
import { sharedMemory } from "./customer-identification.js";

export const repairAgentProductSelection = new Agent({
  name: "Domestic-repair-agent",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
   
  // Instructions will be populated from Langfuse at runtime
  instructions: "",
  
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
  },
  memory: sharedMemory, // Use shared memory
});

// Bind prompt from Langfuse
(async () => {
  try {
    const instructions = await loadLangfusePrompt("Domestic-repair-agent", { label: "production" });
    if (instructions) {
      // Use the correct method to update instructions
      (repairAgentProductSelection as any).__updateInstructions(instructions);
      console.log(`[Langfuse] ✅ Loaded prompt via SDK: Domestic-repair-agent`);
    } else {
      console.error("[Langfuse] No prompt content received from Langfuse for Domestic-repair-agent");
      (repairAgentProductSelection as any).__updateInstructions("You are a helpful AI assistant. Please respond to user messages.");
    }
  } catch (error) {
    console.error("[Langfuse] Failed to load Domestic-repair-agent prompt:", error);
    (repairAgentProductSelection as any).__updateInstructions("You are a helpful AI assistant. Please respond to user messages.");
  }
})();
