#!/usr/bin/env node

import { MCPClient } from "@mastra/mcp";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: "./server.env" });

class ZapierMcpTestClient {
  constructor() {
    this.mcp = null;
    this.toolset = null;
  }

  async ensureConnected() {
    if (this.mcp && this.toolset) return;

    let url = process.env.ZAPIER_MCP_URL;
    if (!url) {
      try {
        const cfgPath = resolve(process.env.HOME || "/home/ec2-user", ".cursor/mcp.json");
        const raw = readFileSync(cfgPath, "utf-8");
        const json = JSON.parse(raw);
        url = json?.mcpServers?.Zapier?.url;
      } catch {}
    }
    if (!url) throw new Error("ZAPIER_MCP_URL is not set");

    this.mcp = new MCPClient({
      servers: { Zapier: { url: new URL(url) } },
      timeout: 120000,
    });
    const toolsets = await this.mcp.getToolsets();
    this.toolset = toolsets["Zapier"] || {};
  }

  async callTool(toolName, params) {
    await this.ensureConnected();
    if (!this.toolset) throw new Error("Zapier MCP toolset unavailable");

    const tool = this.toolset[toolName];
    if (!tool || typeof tool.execute !== "function") {
      throw new Error(`Zapier MCP tool not found: ${toolName}`);
    }
    const res = await tool.execute({ context: params });
    return res;
  }
}

async function testProductLookup() {
  const zapierMcp = new ZapierMcpTestClient();

  try {
    console.log("🔍 Testing Zapier MCP call for product lookup...");

    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "Get all products for customer ID: CUST008",
      worksheet: "Products",
      lookup_key: "顧客ID",
      lookup_value: "CUST008",
      row_count: "10"
    });

    console.log("✅ Zapier call successful!");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Extract rows using the same logic as product-tools.ts
    const rows = (result?.results?.[0]?.rows || result?.results || result || []);

    console.log("Extracted rows:", JSON.stringify(rows, null, 2));

    if (rows && rows.length > 0) {
      console.log("✅ Product data found:");
      rows.forEach((row, index) => {
        console.log(`  Product ${index + 1}:`, {
          productId: row["COL$A"] || row["製品ID"],
          customerId: row["COL$B"] || row["顧客ID"],
          category: row["COL$C"] || row["製品カテゴリ"],
          model: row["COL$D"] || row["型式"],
          serialNumber: row["COL$E"] || row["シリアル番号"],
          warranty: row["COL$F"] || row["保証状況"]
        });
      });
    } else {
      console.log("❌ No products found");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testProductLookup();
