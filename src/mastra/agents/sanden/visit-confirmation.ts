import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
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
    ...productTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
  } as any,
  memory: sharedMemory, // Use shared memory instead of new Memory()
});

// Bind prompt from Langfuse
(async () => {
  try {
    const prompt = await loadLangfusePrompt("Domestic-repair-scheduling", { label: "production" });
    (repairVisitConfirmationAgent as any).instructions = prompt;
    try {
      await langfuse.logPrompt("repair-scheduling", { label: "production", agentId: "repair-scheduling" }, prompt, { length: prompt?.length || 0 });
    } catch {}
  } catch {}
})();
