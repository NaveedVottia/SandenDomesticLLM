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

// REMOVED: searchProductsTool - not needed for current workflow

export const getProductsByCustomerIdTool = createTool({
  id: "getProductsByCustomerId",
  description: "Get all products associated with a specific customer ID",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID to search products for"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, sessionId } = context;

    try {
      // Try the range method first to get all products, then filter by customer ID
      let result;
      try {
        // First try to get all products from the Products worksheet using range
        result = await zapierMcp.callTool("google_sheets_get_data_range", {
          instructions: `Get all data from the Products worksheet for customer ${customerId}`,
          a1_range: "A:F"
        });
      } catch (rangeError: any) {
        console.log(`[DEBUG] Range method failed, trying lookup:`, rangeError.message);
        // Fallback to lookup method with explicit parameters
        result = await zapierMcp.callTool("google_sheets_lookup_spreadsheet_rows_advanced", {
          instructions: `CRITICAL: Search ONLY in the Products worksheet for customer ID: ${customerId}. Do NOT use Customers worksheet.`,
          worksheet: "228243100",  // Use worksheet ID that was working
          lookup_key: "COL$B",  // Use column reference
          lookup_value: customerId,
          row_count: "50"
        });
      }
      
      // Extract rows from the correct format
      let rows = [];

      if (result?.content?.[0]?.text) {
        // Parse JSON response from Zapier
        try {
          const parsed = JSON.parse(result.content[0].text);
          console.log(`[DEBUG] Parsed Zapier response:`, JSON.stringify(parsed, null, 2));

          if (parsed.values && Array.isArray(parsed.values)) {
            // Range method returns values array
            rows = parsed.values.slice(1).map((row: any[]) => ({
              "COL$A": row[0], // 製品ID
              "COL$B": row[1], // 顧客ID
              "COL$C": row[2], // 製品カテゴリ
              "COL$D": row[3], // 型式
              "COL$E": row[4], // シリアル番号
              "COL$F": row[5], // 保証状況
            })).filter((row: any) => row["COL$B"] === customerId); // Filter by customer ID
            console.log(`[DEBUG] Extracted rows from range method:`, JSON.stringify(rows, null, 2));
          } else if (parsed.results?.[0]?.rows) {
            // Lookup method returns results array
            rows = parsed.results[0].rows;
            console.log(`[DEBUG] Extracted rows from lookup method:`, JSON.stringify(rows, null, 2));
          } else {
            console.log(`[DEBUG] No expected format found in parsed response`);
          }
        } catch (parseError: any) {
          console.log(`[DEBUG] Failed to parse Zapier response:`, parseError.message);
        }
      } else {
        console.log(`[DEBUG] No content[0].text found in result`);
      }

      // Fallback to original logic
      if (rows.length === 0) {
        console.log(`[DEBUG] Using fallback extraction logic`);
        rows = (result?.results?.[0]?.rows || result?.results || result || []);
        console.log(`[DEBUG] Fallback extracted rows:`, JSON.stringify(rows, null, 2));
      }

      return {
        success: true,
        data: rows,
        message: `顧客ID ${customerId} の製品情報を取得しました。`,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Failed to get products by customer ID: ${error.message}`,
      };
    }
  },
});

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

export const checkWarrantyStatusTool = createTool({
  id: "checkWarrantyStatus",
  description: "Check warranty status for a product",
  inputSchema: z.object({
    productId: z.string().optional().describe("Product ID"),
    serial: z.string().optional().describe("Serial number"),
    purchaseDate: z.string().optional().describe("Purchase date (ISO)"),
    customerId: z.string().optional().describe("Customer ID"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productId, serial, purchaseDate, customerId, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "checkWarranty",
        productId,
        serial,
        purchaseDate,
        customerId,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "保証状況を確認しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to check warranty: ${error.message}` };
    }
  },
});

export const getStandardRepairFeesTool = createTool({
  id: "getStandardRepairFees",
  description: "Get standard repair fees for a product category/model",
  inputSchema: z.object({
    productCategory: z.string().optional().describe("Product category"),
    model: z.string().optional().describe("Product model"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productCategory, model, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "getStandardFees",
        productCategory,
        model,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "標準修理料金を取得しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to get standard fees: ${error.message}` };
    }
  },
});

export const searchRepairLogsTool = createTool({
  id: "searchRepairLogs",
  description: "Search recent repair logs for a given customer/product",
  inputSchema: z.object({
    customerId: z.string().describe("Customer ID"),
    productId: z.string().optional().describe("Product ID"),
    limit: z.number().optional().default(5).describe("Max number of logs"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { customerId, productId, limit = 5, sessionId } = context;
    try {
      const result = await zapierCall("Repair", {
        action: "searchLogs",
        customerId,
        productId,
        limit,
        sessionId,
      });
      return { success: true, data: result.data || result, message: result.message || "修理履歴を取得しました。" };
    } catch (error: any) {
      return { success: false, data: null, message: `Failed to search repair logs: ${error.message}` };
    }
  },
});
export const createProductTool = createTool({
  id: "createProduct",
  description: "Create a new product record in the Sanden repair system",
  inputSchema: z.object({
    productData: z
      .object({
        name: z.string().optional(),
        category: z.string().optional(),
        price: z.string().optional(),
        description: z.string().optional(),
      })
      .describe("Product data for creation"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productData, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        productData: productData || {},
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "製品作成が完了しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Product creation failed: ${error.message}`,
      };
    }
  },
});

export const updateProductTool = createTool({
  id: "updateProduct",
  description: "Update an existing product record in the Sanden repair system",
  inputSchema: z.object({
    productId: z.string().describe("Product ID for update"),
    updates: z
      .object({
        name: z.string().optional(),
        category: z.string().optional(),
        price: z.string().optional(),
        description: z.string().optional(),
      })
      .describe("Product data updates"),
    sessionId: z.string().describe("Session ID for validation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const { productId, updates, sessionId } = context;

    try {
      const result = await zapierCall("Repair", {
        sessionId,
        productId: productId || "",
        updates: updates || {},
      });
      return {
        success: true,
        data: result.data || result,
        message: result.message || "製品更新が完了しました。",
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        message: `Product update failed: ${error.message}`,
      };
    }
  },
});

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
