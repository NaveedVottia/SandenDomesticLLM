import { MCPClient } from "@mastra/mcp";
import { readFileSync } from "fs";
import { resolve } from "path";
export class ZapierMcpClient {
    constructor() {
        this.mcp = null;
        this.toolset = null;
        this.connecting = null;
    }
    static getInstance() {
        if (!ZapierMcpClient.instance) {
            ZapierMcpClient.instance = new ZapierMcpClient();
        }
        return ZapierMcpClient.instance;
    }
    async ensureConnected() {
        if (this.mcp && this.toolset)
            return;
        if (this.connecting)
            return this.connecting;
        let url = process.env.ZAPIER_MCP_URL;
        if (!url) {
            try {
                // Fallback to Cursor MCP config
                const cfgPath = resolve(process.env.HOME || "/home/ec2-user", ".cursor/mcp.json");
                const raw = readFileSync(cfgPath, "utf-8");
                const json = JSON.parse(raw);
                url = json?.mcpServers?.Zapier?.url;
                if (url) {
                    try {
                        process.env.ZAPIER_MCP_URL = url;
                    }
                    catch { }
                }
            }
            catch { }
        }
        if (!url)
            throw new Error("ZAPIER_MCP_URL is not set");
        this.connecting = (async () => {
            this.mcp = new MCPClient({
                servers: {
                    Zapier: { url: new URL(url) },
                },
                timeout: 120000, // Increased timeout to 120 seconds for Zapier calls
            });
            const toolsets = await this.mcp.getToolsets();
            this.toolset = toolsets["Zapier"] || {};
        })();
        return this.connecting;
    }
    async callTool(toolName, params) {
        await this.ensureConnected();
        if (!this.toolset)
            throw new Error("Zapier MCP toolset unavailable");
        const tool = this.toolset[toolName];
        if (!tool || typeof tool.execute !== "function") {
            throw new Error(`Zapier MCP tool not found: ${toolName}`);
        }
        const res = await tool.execute({ context: params });
        return res;
    }
}
ZapierMcpClient.instance = null;
export const zapierMcp = ZapierMcpClient.getInstance();
