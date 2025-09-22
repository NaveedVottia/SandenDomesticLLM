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

async function testProductsWorksheet() {
  const zapierMcp = new ZapierMcpTestClient();

  try {
    console.log("🔍 Testing direct access to Products worksheet...");

    const result = await zapierMcp.callTool("google_sheets_get_data_range", {
      instructions: "Get all data from the Products worksheet",
      a1_range: "A:F"
    });

    console.log("✅ Products worksheet data:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Error accessing Products worksheet:", error);
  }
}

async function testFindWorksheet() {
  const zapierMcp = new ZapierMcpTestClient();

  try {
    console.log("🔍 Finding Products worksheet...");

    const result = await zapierMcp.callTool("google_sheets_find_worksheet", {
      instructions: "Find the Products worksheet",
      title: "Products"
    });

    console.log("✅ Products worksheet found:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Error finding Products worksheet:", error);
  }
}

// Run both tests
await testFindWorksheet();
console.log("\n" + "="*50 + "\n");
await testProductsWorksheet();
