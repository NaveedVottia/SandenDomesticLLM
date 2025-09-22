import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { schedulingTools } from "../../tools/sanden/scheduling-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { productTools } from "../../tools/sanden/product-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { orchestratorTools } from "../../tools/sanden/orchestrator-tools.js";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sharedMastraMemory } from "../../shared-memory.js";

// Load environment variables with absolute path
dotenv.config({ path: path.resolve(process.cwd(), "server.env") });

// Load instructions from Langfuse synchronously first
let REPAIR_SCHEDULING_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("repair-scheduling", undefined, { cacheTtlSeconds: 0 });
  if (promptClient?.prompt?.trim()) {
    REPAIR_SCHEDULING_INSTRUCTIONS = promptClient.prompt.trim();
    console.log(`[Langfuse] ✅ Loaded repair-scheduling prompt via SDK (v${promptClient.version})`);
  } else {
    console.warn(`[Langfuse] ⚠️ No prompt available for repair-scheduling`);
  }
} catch (error) {
  console.error("[Langfuse] Failed to load repair-scheduling prompt:", error);
}

export const repairVisitConfirmationAgent = new Agent({
  name: "repair-scheduling",
  description: "サンデン・リテールシステム修理受付AI , 修理予約エージェント",
  instructions: REPAIR_SCHEDULING_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0", {
    temperature: 0.1,
    maxTokens: 1000,
    region: process.env.AWS_REGION || "ap-northeast-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
  tools: {
    ...schedulingTools,
    ...customerTools,
    ...productTools, // Add product tools for hybridGetProductsByCustomerId
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
    lookupCustomerFromDatabase: orchestratorTools.lookupCustomerFromDatabase, // Add lookup tool
    confirmAndLogRepair: orchestratorTools.confirmAndLogRepair, // Add confirm and log tool
    autoConfirmRepair: orchestratorTools.autoConfirmRepair, // Add auto confirm tool
  },
  memory: sharedMastraMemory, // Use shared memory
});
