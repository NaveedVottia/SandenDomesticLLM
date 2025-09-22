import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "./src/integrations/zapier-mcp.js";

const testDelegationTool = createTool({
  id: "testDelegation",
  description: "Test delegation to repair-scheduling agent",
  inputSchema: z.object({
    message: z.string(),
    context: z.record(z.string(), z.unknown()).optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    response: z.string(),
    extractedData: z.record(z.string(), z.unknown()).optional()
  }),
  execute: async ({ context }) => {
    const { message, context: agentContext } = context;
    const { mastraPromise } = await import("./src/mastra/index.ts");
    const mastra = await mastraPromise;

    try {
      const agent = mastra.getAgentById("repair-scheduling");
      if (!agent) throw new Error("repair-scheduling agent not found");

      console.log("🧪 Testing delegation with message:", message);
      console.log("🧪 Context:", JSON.stringify(agentContext, null, 2));

      const response = await agent.generate(message);
      console.log("✅ Agent response:", response.text);

      return {
        success: true,
        response: response.text,
        extractedData: {}
      };
    } catch (error) {
      console.error("❌ Delegation test failed:", error);
      return {
        success: false,
        response: `Error: ${error.message}`,
        extractedData: null
      };
    }
  },
});

async function testDelegation() {
  console.log("🧪 Testing delegation mechanism...");

  const result = await testDelegationTool.execute({
    context: {
      message: "vending machine september 19th, doesnt get cold, call naveed at 09089762324",
      context: {
        customerId: "CUST009",
        storeName: "ココカラファイン 横浜西口店",
        email: "service@coco-yokohama.jp",
        phone: "045-998-7766",
        location: "神奈川県・横浜",
        repairDetails: {
          productType: "vending machine",
          issue: "doesnt get cold",
          preferredDate: "September 19th",
          contactName: "Naveed",
          contactPhone: "09089762324"
        }
      }
    }
  });

  console.log("🎯 Test result:", JSON.stringify(result, null, 2));
}

testDelegation();
