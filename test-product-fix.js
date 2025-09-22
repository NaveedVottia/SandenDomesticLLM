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

async function testProductLookupWithCorrectWorksheet() {
  const zapierMcp = new ZapierMcpTestClient();

  try {
    console.log("🔍 Testing product lookup with correct Products worksheet...");

    // Use the exact worksheet ID we found: 228243100 for Products
    const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "Get all products for customer ID: CUST008 from the Products worksheet",
      worksheet: "Products",  // Try explicit name first
      lookup_key: "顧客ID",
      lookup_value: "CUST008",
      row_count: "10"
    });

    console.log("✅ Product lookup result:");
    console.log(JSON.stringify(result, null, 2));

    // Extract rows using the same logic as product-tools.ts
    let rows = [];
    if (result && result.content && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
      try {
        const parsedContent = JSON.parse(result.content[0].text);
        if (parsedContent && parsedContent.results && Array.isArray(parsedContent.results) && parsedContent.results[0] && parsedContent.results[0].rows) {
          rows = parsedContent.results[0].rows;
        }
      } catch (parseError) {
        console.log(`❌ Failed to parse content:`, parseError);
      }
    }

    // Fallback logic
    if (rows.length === 0) {
      if (result?.results?.[0]?.rows) {
        rows = result.results[0].rows;
      } else if (result?.results) {
        rows = result.results;
      } else if (result?.rows) {
        rows = result.rows;
      }
    }

    console.log("Extracted product rows:", JSON.stringify(rows, null, 2));

    if (rows && rows.length > 0) {
      console.log("✅ Products found for CUST008:");
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
      console.log("❌ No products found for CUST008");

      // Let's check what worksheet was actually used
      if (result && result.content && result.content[0] && result.content[0].text) {
        const parsed = JSON.parse(result.content[0].text);
        if (parsed.execution && parsed.execution.resolvedParams) {
          console.log("Worksheet used by Zapier:", parsed.execution.resolvedParams.worksheet);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testProductLookupWithCorrectWorksheet();
