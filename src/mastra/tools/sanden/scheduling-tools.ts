import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

export const googleSheetsCreateRow = createTool({
  id: "google_sheets_create_spreadsheet_row_at_top",
  description: "Create a new row in Google Sheets Logs worksheet with retry mechanism",
  inputSchema: z.object({
    instructions: z.string().describe("Instructions for creating the row"),
    "COL__DOLLAR__A": z.string().optional().describe("顧客ID"),
    "COL__DOLLAR__B": z.string().optional().describe("会社名"),
    "COL__DOLLAR__C": z.string().optional().describe("メールアドレス"),
    "COL__DOLLAR__D": z.string().optional().describe("電話番号"),
    "COL__DOLLAR__E": z.string().optional().describe("所在地"),
    "COL__DOLLAR__F": z.string().optional().describe("製品ID"),
    "COL__DOLLAR__G": z.string().optional().describe("製品カテゴリ"),
    "COL__DOLLAR__H": z.string().optional().describe("型式"),
    "COL__DOLLAR__I": z.string().optional().describe("シリアル番号"),
    "COL__DOLLAR__J": z.string().optional().describe("保証状況"),
    "COL__DOLLAR__K": z.string().optional().describe("Repair ID"),
    "COL__DOLLAR__L": z.string().optional().describe("日時"),
    "COL__DOLLAR__M": z.string().optional().describe("問題内容"),
    "COL__DOLLAR__N": z.string().optional().describe("ステータス"),
    "COL__DOLLAR__O": z.string().optional().describe("訪問要否"),
    "COL__DOLLAR__P": z.string().optional().describe("優先度"),
    "COL__DOLLAR__Q": z.string().optional().describe("対応者"),
    "COL__DOLLAR__R": z.string().optional().describe("備考"),
    "COL__DOLLAR__S": z.string().optional().describe("Name"),
    "COL__DOLLAR__T": z.string().optional().describe("phone"),
    "COL__DOLLAR__U": z.string().optional().describe("date"),
    "COL__DOLLAR__V": z.string().optional().describe("machine"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [DEBUG] Attempt ${attempt}/${maxRetries} - Creating Google Sheets row...`);

        const result = await zapierMcp.callTool("google_sheets_create_spreadsheet_row_at_top", context);

        console.log(`✅ [DEBUG] Successfully created Google Sheets row on attempt ${attempt}:`, JSON.stringify(result, null, 2));
        return {
          success: true,
          data: result,
          message: `Google Sheets row created successfully on attempt ${attempt}`
        };

      } catch (error: any) {
        console.error(`❌ [DEBUG] Attempt ${attempt}/${maxRetries} failed:`, error.message);

        // Check if it's a timeout error
        const isTimeout = error.message?.includes('408') ||
                         error.message?.includes('timeout') ||
                         error.message?.includes('exceeded maximum allowed time');

        // If it's the last attempt or not a timeout, fail
        if (attempt === maxRetries || !isTimeout) {
          console.error(`💥 [DEBUG] Final failure after ${attempt} attempts`);
          return {
            success: false,
            data: null,
            message: `Google Sheets row creation failed after ${attempt} attempts: ${error.message}`
          };
        }

        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [DEBUG] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    return {
      success: false,
      data: null,
      message: 'Unexpected error in Google Sheets row creation'
    };
  },
});

export const googleCalendarEvent = createTool({
  id: "google_calendar_quick_add_event",
  description: "Add a new event to Google Calendar with retry mechanism",
  inputSchema: z.object({
    instructions: z.string().describe("Instructions for creating the calendar event"),
    text: z.string().describe("Event description text"),
    attendees: z.string().optional().describe("Event attendees"),
    calendarid: z.string().optional().describe("Calendar ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    message: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [DEBUG] Attempt ${attempt}/${maxRetries} - Creating calendar event...`);

        const result = await zapierMcp.callTool("google_calendar_quick_add_event", context);

        console.log(`✅ [DEBUG] Successfully created calendar event on attempt ${attempt}:`, JSON.stringify(result, null, 2));
        return {
          success: true,
          data: result,
          message: `Calendar event created successfully on attempt ${attempt}`
        };

      } catch (error: any) {
        console.error(`❌ [DEBUG] Calendar event attempt ${attempt}/${maxRetries} failed:`, error.message);

        // Check if it's a timeout or network error
        const isRetryableError = error.message?.includes('408') ||
                                error.message?.includes('timeout') ||
                                error.message?.includes('network') ||
                                error.message?.includes('ECONNRESET') ||
                                error.message?.includes('ENOTFOUND');

        // If it's the last attempt or not a retryable error, fail
        if (attempt === maxRetries || !isRetryableError) {
          console.error(`💥 [DEBUG] Final failure after ${attempt} attempts for calendar event`);
          return {
            success: false,
            data: null,
            message: `Calendar event creation failed after ${attempt} attempts: ${error.message}`
          };
        }

        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [DEBUG] Retrying calendar event in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    return {
      success: false,
      data: null,
      message: 'Unexpected error in calendar event creation'
    };
  },
});

export const schedulingTools = {
  googleSheetsCreateRow,
  googleCalendarEvent,
};
