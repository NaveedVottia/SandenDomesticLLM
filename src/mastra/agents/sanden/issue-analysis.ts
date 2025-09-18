import { Agent } from "@mastra/core/agent";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { repairTools } from "../../tools/sanden/repair-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
import { commonTools } from "../../tools/sanden/common-tools.js";
import { memoryTools } from "../../tools/sanden/memory-tools.js";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import { sharedMemory } from "./customer-identification.js";

dotenv.config({ path: "./server.env" });

let REPAIR_HISTORY_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("Domestic-repair-history-ticket", undefined, { cacheTtlSeconds: 1 });
  if (promptClient?.prompt?.trim()) {
    REPAIR_HISTORY_INSTRUCTIONS = promptClient.prompt.trim();
    console.log(`[Langfuse] ✅ Loaded Domestic-repair-history-ticket prompt via SDK (v${promptClient.version})`);
  } else {
    console.error("[Langfuse] No prompt content received from Langfuse for Domestic-repair-history-ticket");
    REPAIR_HISTORY_INSTRUCTIONS = "You are a helpful AI assistant. Please respond to user messages.";
  }

  // No additional hardcoded instructions - everything is in Langfuse prompt
} catch (error) {
  console.error("[Langfuse] Failed to load Domestic-repair-history-ticket prompt:", error);
  REPAIR_HISTORY_INSTRUCTIONS = "You are a helpful AI assistant. Please respond to user messages.";
}

// Wrap agent creation in try-catch to prevent server crash
let repairQaAgentIssueAnalysis: Agent;
try {
  repairQaAgentIssueAnalysis = new Agent({
    name: "Domestic-repair-history-ticket",
    description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
    instructions: REPAIR_HISTORY_INSTRUCTIONS,
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {
      ...repairTools,
      // Ensure we have access to customer tools for context
      ...customerTools,
    },
  });
  console.log("✅ SDKv5 Issue Analysis Agent created");
} catch (error) {
  console.error("❌ Failed to create Issue Analysis Agent:", error);
  // Create a minimal fallback agent
  repairQaAgentIssueAnalysis = new Agent({
    name: "Domestic-repair-history-ticket",
    description: "サンデン・リテールシステム修理受付AI , 問題分析エージェント",
    instructions: "You are a helpful AI assistant. Please respond to user messages.",
    model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
    tools: {},
  });
}

export { repairQaAgentIssueAnalysis };
