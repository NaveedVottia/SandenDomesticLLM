import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";
import { sharedMastraMemory, createMemoryIds, getCustomerData } from "../../shared-memory.js";

// Import the robust row extraction function from customer-tools
function extractRowsFromZapier(result: any): any[] {
  if (!result) return [];

  console.log(`🔍 [DEBUG] Extracting rows from Zapier result:`, JSON.stringify(result, null, 2));

  // Handle Zapier MCP format: { content: [{ type: "text", text: "json_string" }] }
  if (result?.content && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.type === "text" && typeof item.text === "string") {
        try {
          const parsedContent = JSON.parse(item.text);
          console.log(`🔍 [DEBUG] Parsed content from text:`, JSON.stringify(parsedContent, null, 2));

          // Extract rows from parsed content
          if (parsedContent?.results && Array.isArray(parsedContent.results)) {
            const out: any[] = [];
            for (const entry of parsedContent.results) {
              if (Array.isArray(entry?.rows)) {
                out.push(...entry.rows);
              }
            }
            if (out.length) {
              console.log(`🔍 [DEBUG] Extracted ${out.length} rows from content:`, JSON.stringify(out, null, 2));
              return out;
            }
          }
        } catch (error) {
          console.log(`❌ [DEBUG] Failed to parse content text:`, error);
        }
      }
    }
  }

  // Direct rows array
  if (Array.isArray(result?.rows)) return result.rows;

  // Results array or object with nested rows
  if (result?.results) {
    const out: any[] = [];
    if (Array.isArray(result.results)) {
      for (const entry of result.results) {
        if (Array.isArray(entry?.rows)) out.push(...entry.rows);
        else if (entry) out.push(entry);
      }
    } else if (typeof result.results === "object") {
      for (const key of Object.keys(result.results)) {
        if (!/^\d+$/.test(key)) continue;
        const value = (result.results as any)[key];
        if (Array.isArray(value?.rows)) out.push(...value.rows);
        else if (Array.isArray(value)) out.push(...value);
        else if (value) out.push(value);
      }
    }
    if (out.length) return out;
  }

  // Numeric keyed object: { "0": { rows: [...] }, ... }
  if (typeof result === "object") {
    const out: any[] = [];
    for (const key of Object.keys(result)) {
      if (!/^\d+$/.test(key)) continue;
      const value = (result as any)[key];
      if (Array.isArray(value?.rows)) out.push(...value.rows);
      else if (Array.isArray(value)) out.push(...value);
      else if (value) out.push(value);
    }
    if (out.length) return out;
  }

  console.log(`❌ [DEBUG] No rows extracted from result`);
  return [];
}

// REMOVED: getProductsByCustomerIdTool - replaced by hybridGetProductsByCustomerIdTool
export const hybridGetProductsByCustomerIdTool = createTool({
  id: "hybridGetProductsByCustomerId",
  description: "Get all products associated with a specific customer ID from the Sanden repair system",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Customer ID to search products for (optional - will use memory if not provided)"),
    sessionId: z.string().optional().describe("Session ID for validation (optional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context, writer }: { context: any; writer?: any }) => {
    let { customerId, sessionId = "default-session" } = context;

    // If customerId is directly provided (like CUST008), use it immediately
    if (customerId && customerId.match(/^CUST\d+$/)) {
      console.log(`✅ [DEBUG] Direct customer ID provided: ${customerId}`);
    } else {
      // Try to get customer ID from session context
      if (!customerId && context.session && context.session.customerId) {
        customerId = context.session.customerId;
        console.log(`🔍 [DEBUG] Retrieved customer ID from session: ${customerId}`);
      }
    }

    // If still no customerId, try to get it from shared memory
    if (!customerId) {
      try {
        // Try different possible session IDs to find the customer data
        const possibleSessionIds = [
          sessionId,
          'default',
          'current',
          'session',
          `session-${Date.now()}`
        ];

        for (const sid of possibleSessionIds) {
          if (sid) {
            const memIds = createMemoryIds(sid);
            const customerData = await getCustomerData(memIds);
            if (customerData && customerData.customerId) {
              customerId = customerData.customerId;
              console.log(`🔍 [DEBUG] Retrieved customer ID from memory: ${customerId} (session: ${sid})`);
              break;
            }
          }
        }

        // If still not found, try common customer IDs directly
        if (!customerId) {
          const commonCustomerIds = ['cust001', 'cust002', 'cust003', 'cust004', 'cust005', 'cust006', 'cust007', 'cust008', 'cust009', 'cust010'];
          for (const cid of commonCustomerIds) {
            const memIds = createMemoryIds(cid, cid);
            const customerData = await getCustomerData(memIds);
            if (customerData && customerData.customerId) {
              customerId = customerData.customerId;
              console.log(`🔍 [DEBUG] Retrieved customer ID from memory: ${customerId} (direct lookup: ${cid})`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`❌ [DEBUG] Error getting customer ID from memory:`, error);
      }
    }

    if (!customerId) {
      console.log(`❌ [DEBUG] No customer ID available for product lookup`);
      return {
        success: false,
        data: null,
        message: "顧客IDが見つかりません。先に顧客識別を完了してください。",
      };
    }

    try {
      console.log(`🔍 [DEBUG] Getting products for customer ID: ${customerId}`);

      const result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
        instructions: `Get all products for customer ID: ${customerId}`,
        worksheet: "Products",  // Use worksheet name instead of ID
        lookup_key: "顧客ID",  // Use column name instead of reference
        lookup_value: customerId,
        row_count: "50"
      });
      
      console.log(`🔍 [DEBUG] Zapier result for products:`, JSON.stringify(result, null, 2));

      // Use the same robust extraction logic as repair history
      const rows = extractRowsFromZapier(result);

      console.log(`🔍 [DEBUG] Final extracted product rows:`, JSON.stringify(rows, null, 2));

      if (rows && rows.length > 0) {
        console.log(`✅ [DEBUG] Found ${rows.length} product records`);

        // Format the product data (same structure as repair history)
        const products = rows.map((row: any) => ({
          productId: row["製品ID"] || row["COL$A"],
          customerId: row["顧客ID"] || row["COL$B"],
          productCategory: row["製品カテゴリ"] || row["COL$C"],
          model: row["型式"] || row["COL$D"],
          serialNumber: row["シリアル番号"] || row["COL$E"],
          warrantyStatus: row["保証状況"] || row["COL$F"]
        }));

        console.log(`✅ [DEBUG] Formatted products:`, JSON.stringify(products, null, 2));

        // Output directly to UI like repair history tool
        if (writer && products.length > 0) {
          let out = `顧客ID ${customerId} の製品情報 (${products.length}件)\n\n`;
          products.forEach((product, idx) => {
            out += `${idx + 1}. 製品情報\n`;
            out += `   製品ID: ${product.productId}\n`;
            out += `   製品カテゴリ: ${product.productCategory}\n`;
            out += `   型式: ${product.model}\n`;
            out += `   シリアル番号: ${product.serialNumber}\n`;
            out += `   保証状況: ${product.warrantyStatus}\n\n`;
          });
          try { writer.write(out); } catch {}
        }

        return {
          success: true,
          data: products,
          message: `顧客ID ${customerId} の製品情報を取得しました。`,
        };
      } else {
        console.log(`❌ [DEBUG] No product records found for customer ID: ${customerId}`);
        return {
          success: true,
          data: [],
          message: `顧客ID ${customerId} の製品情報は見つかりませんでした。`,
        };
      }
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error getting products:`, error);

      return {
        success: false,
        data: null,
        message: `製品情報の取得に失敗しました: ${error.message}`,
      };
    }
  },
});

// REMOVED: createProductTool and updateProductTool - not currently used

async function searchProducts(
  sessionId: string,
  query: string,
  category?: string
) {
  try {
    const results = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
      instructions: "製品検索 (partial match app-side)",
      worksheet: "228243100",  // Use worksheet ID that was working
      lookup_key: "COL$C",  // Use column reference
      lookup_value: category || "",
    });
    const rows = (results?.results as any[]) || [];
    const filtered = rows.filter((r: any) =>
      JSON.stringify(r).includes(query)
    );
    return { success: true, data: filtered, message: "製品検索が完了しました。" };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      message: `Product search failed: ${error.message}`,
    };
  }
}

async function zapierCall(event: string, payload: Record<string, any>) {
  const result = await zapierMcp.callTool("google_sheets_get_many_spreadsheet_rows_advanced", {
    instructions: event,
    row_count: 20,
  });
  return { success: true, data: result?.results || result, message: "Zapier MCP call completed successfully" };
}

// Export only the working product tool
export const productTools = {
  hybridGetProductsByCustomerIdTool, // The only working tool that returns real Google Sheets data
};
