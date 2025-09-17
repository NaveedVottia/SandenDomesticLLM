import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { productTools } from "../../tools/sanden/product-tools.js";
import { customerTools } from "../../tools/sanden/customer-tools.js";
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
let REPAIR_AGENT_INSTRUCTIONS = "";
try {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });
  const promptClient = await langfuse.getPrompt("repair-agent", undefined, { cacheTtlSeconds: 0 });
  if (promptClient?.prompt?.trim()) {
    // Update the prompt with formatting preservation instructions
    const updatedPrompt = promptClient.prompt.trim() + `

## 重要: フォーマット保持指示
- **ツールの出力を加工・再フォーマットしない**
- **改行やインデントを保持する**
- **修理履歴や製品情報のフォーマットを変更しない**
- **ツールの結果をそのまま表示する**`;

    REPAIR_AGENT_INSTRUCTIONS = updatedPrompt;
    console.log(`[Langfuse] ✅ Loaded repair-agent prompt via SDK (v${promptClient.version}) with formatting preservation`);
  } else {
    console.warn(`[Langfuse] ⚠️ No prompt available for repair-agent`);
  }
} catch (error) {
  console.error("[Langfuse] Failed to load repair-agent prompt:", error);
  // Fallback instructions when Langfuse is not available
  REPAIR_AGENT_INSTRUCTIONS = `# 修理エージェント

あなたはサンデン・リテールシステムの修理担当エージェントです。

## 🚨 緊急最優先 🚨
**最初のメッセージで製品リクエストを検知したら、即座に製品検索を実行**
**最初のメッセージで修理履歴リクエストを検知したら、即座に修理履歴検索を実行**

## リクエスト検知パターン
以下のキーワードでリクエストを検知：
- "製品" → 製品検索実行
- "修理履歴" → 修理履歴検索実行

## 即時実行フロー
1. 顧客IDをコンテキストまたはメモリから取得
2. **製品リクエストの場合**: 即座に hybridGetProductsByCustomerIdTool を実行
3. **修理履歴リクエストの場合**: 即座に getCustomerHistory を実行
4. 他のツールや検索を一切スキップ
5. **ツールの結果をそのまま出力し、加工しない**

## 禁止事項
- 顧客情報検索ツールを使用しない
- データベース検索を実行しない
- 委譲を行わない
- 架空の情報を生成しない
- **ツールの出力形式を変更しない**
- **改行やフォーマットを変更しない**

## ツール使用
- **製品**: hybridGetProductsByCustomerIdTool
- **修理履歴**: getCustomerHistory
- 顧客IDが不明な場合のみ顧客検索を実行

## 応答形式
- **ツールの結果をそのまま表示する**
- **加工・再フォーマットしない**
- 情報が見つからない場合のみ：「情報は見つかりませんでした」
- **他の応答は一切生成しない**`;
}

// Create agent with instructions loaded from Langfuse
export const repairAgentProductSelection = new Agent({
  name: "repair-agent",
  description: "サンデン・リテールシステム修理受付AI , 製品選択エージェント",
  instructions: REPAIR_AGENT_INSTRUCTIONS,
  model: bedrock("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  tools: {
    ...productTools,
    ...customerTools,
    ...commonTools,
    ...memoryTools, // Add memory tools
    delegateTo: orchestratorTools.delegateTo, // Add delegateTo tool
    logCustomerData: orchestratorTools.logCustomerData, // Add logCustomerData tool
  },
  memory: sharedMastraMemory, // Use shared memory
});
