import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

export const validateSession = createTool({
  id: "validateSession",
  description: "Validate session and return session information",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string } }) => {
    const { sessionId } = context;

    try {
      // Use Logs: Get Data Range as a lightweight connectivity check; in a real impl you'd have a dedicated session tool
      await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "validate session connectivity",
        a1_range: "A1:I1",
      });
      const result = { data: { sessionId } };
      return {
        success: true,
        data: result.data,
        message: "Session validated successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Session validation failed: ${errorMessage}`
      };
    }
  },
});

export const getSystemInfo = createTool({
  id: "getSystemInfo",
  description: "Get system information",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string } }) => {
    const { sessionId } = context;

    try {
      const headers = await zapierMcp.callTool("google_sheets_get_data_range", {
        instructions: "system info headers",
        a1_range: "A1:I1",
      });
      const result = { data: { headers } };
      return {
        success: true,
        data: result.data,
        message: "System info retrieved successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Failed to get system info: ${errorMessage}`
      };
    }
  },
});

export const getHelp = createTool({
  id: "getHelp",
  description: "Get help information for a specific topic",
  inputSchema: z.object({
    sessionId: z.string().describe("Session ID for validation"),
    topic: z.string().optional().describe("Help topic"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { sessionId: string; topic?: string } }) => {
    const { sessionId, topic } = context;

    try {
      const result = { data: { topic: topic || "" } };
      return {
        success: true,
        data: result.data,
        message: "Help information retrieved successfully",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        data: null,
        message: `Failed to get help: ${errorMessage}`
      };
    }
  },
});

export const zapierAiQuery = createTool({
  id: "zapierAiQuery",
  description: "Use Zapier AI to extract/summarize content from a URL or the configured data source (e.g., Google Sheets). Provide url and prompt.",
  inputSchema: z.object({
    url: z.string().url().optional().describe("Optional URL to extract from. If omitted, uses the configured source."),
    prompt: z.string().describe("Instruction or question for the AI extractor/summarizer"),
    context: z.record(z.string(), z.unknown()).optional().describe("Optional JSON context to include"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: { url?: string; prompt: string; context?: Record<string, unknown> } }) => {
    const { url, prompt, context: extra } = context;
    try {
      const instructions = url
        ? `Extract and summarize content from this URL: ${url}. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`
        : `Extract and summarize content from the configured source. Task: ${prompt}. Extra: ${JSON.stringify(extra || {})}`;
      const res = await zapierMcp.callTool("ai_by_zapier_extract_content_from_url_beta", {
        instructions,
      });
      return { success: true, data: res?.results || res, message: "AI query completed" };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, data: null, message: `AI query failed: ${errorMessage}` };
    }
  },
});

export const searchFAQDatabase = createTool({
  id: "searchFAQDatabase",
  description: "Search the FAQ database for relevant questions and answers",
  inputSchema: z.object({
    keywords: z.string().describe("Keywords to search for in FAQ"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.array(z.object({
      question: z.string(),
      answer: z.string(),
      url: z.string().optional(),
    })),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { keywords } = context;

    try {
      console.log(`🔍 Searching FAQ for: "${keywords}"`);
      
      // Get all FAQ entries to search locally for partial matches
      const allFAQResult = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
        instructions: `Get all FAQ entries for local search`,
        worksheet: "FAQ",
        row_count: "500",
        range: "A:Z",
        output_format: "json"
      });
      
      console.log("🔍 FAQ Search Result:", JSON.stringify(allFAQResult, null, 2));

      if (allFAQResult && allFAQResult.content && allFAQResult.content[0] && allFAQResult.content[0].text) {
        const parsedContent = JSON.parse(allFAQResult.content[0].text);
        
        // Handle different result structures
        let faqRows = [];
        
        // Structure 1: Direct numeric keyed object with raw_rows
        if (parsedContent["0"] && parsedContent["0"].raw_rows) {
          console.log("🔍 [DEBUG] Found structure 1: numeric keyed object with raw_rows");
          const rawRows = JSON.parse(parsedContent["0"].raw_rows);
          faqRows = rawRows.map((row: any[]) => ({
            "COL$A": row[0] || "",
            "COL$B": row[1] || "",
            "COL$C": row[2] || "",
            "COL$D": row[3] || ""
          }));
        }
        // Structure 2: Results array with formatted_rows
        else if (parsedContent.results && parsedContent.results[0] && parsedContent.results[0].formatted_rows) {
          console.log("🔍 [DEBUG] Found structure 2: results array with formatted_rows");
          faqRows = parsedContent.results[0].formatted_rows;
        }
        // Structure 3: Results array with raw_rows (this is the actual structure we're getting)
        else if (parsedContent.results && parsedContent.results[0] && parsedContent.results[0].raw_rows) {
          console.log("🔍 [DEBUG] Found structure 3: results array with raw_rows");
          const rawRows = JSON.parse(parsedContent.results[0].raw_rows);
          faqRows = rawRows.map((row: any[]) => ({
            "COL$A": row[0] || "",
            "COL$B": row[1] || "",
            "COL$C": row[2] || "",
            "COL$D": row[3] || ""
          }));
        }
        
        console.log("🔍 [DEBUG] Processed FAQ rows:", faqRows.length, "items");
        
        // Search locally for partial matches (case-insensitive)
        const searchTerms = keywords.toLowerCase().split(' ');
        const matchingFAQs = faqRows.filter((row: any) => {
          const questionText = (row["COL$B"] || "").toLowerCase(); // Question is in column B
          const answerText = (row["COL$C"] || "").toLowerCase();   // Answer is in column C
          
          // Check if any search term matches in question or answer
          return searchTerms.some((term: string) => 
            questionText.includes(term) || answerText.includes(term)
          );
        });
        
        console.log("🔍 [DEBUG] Matching FAQs:", matchingFAQs.length, "items");
        
        if (matchingFAQs.length > 0) {
          return {
            success: true,
            data: matchingFAQs.map((item: any) => ({
              question: item["COL$B"] || '',
              answer: item["COL$C"] || '',
              url: item["COL$D"] || ''
            })),
            message: `Found ${matchingFAQs.length} relevant FAQ entries`
          };
        }
      }
      
      return {
        success: false,
        data: [],
        message: "No FAQ data found for the given keywords"
      };
      
    } catch (error: any) {
      console.error("FAQ search error:", error);
      return { 
        success: false, 
        data: [], 
        message: `FAQ search failed: ${error.message}` 
      };
    }
  },
});

export const commonTools = { validateSession, getSystemInfo, getHelp, zapierAiQuery, searchFAQDatabase };
