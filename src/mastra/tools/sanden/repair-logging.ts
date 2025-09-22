import { z } from "zod";

export const RepairConfirmContextSchema = z.object({
  customerId: z.string().min(1),
  storeName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  product: z
    .object({
      productId: z.string().optional(),
      category: z.string().optional(),
      model: z.string().optional(),
      serial: z.string().optional(),
      warranty: z.string().optional(),
    })
    .optional(),
  appointment: z.object({
    dateTimeISO: z
      .string()
      .refine(v => !Number.isNaN(Date.parse(v)), "Invalid ISO datetime"),
    display: z.string().min(1),
  }),
  issue: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().regex(/^[0-9+\-()\s]+$/).min(7),
  machineLabel: z.string().min(1),
});

export type RepairConfirmContext = z.infer<typeof RepairConfirmContextSchema>;

export const SheetsRowSchema = z.object({
  instructions: z.string().min(1),
  worksheet: z.string().optional(),
  COL__DOLLAR__A: z.string().min(1), // 顧客ID
  COL__DOLLAR__B: z.string().min(1), // 会社名
  COL__DOLLAR__C: z.string().optional(), // メールアドレス
  COL__DOLLAR__D: z.string().optional(), // 電話番号
  COL__DOLLAR__E: z.string().optional(), // 所在地
  COL__DOLLAR__F: z.string().optional(), // 製品ID
  COL__DOLLAR__G: z.string().optional(), // 製品カテゴリ
  COL__DOLLAR__H: z.string().optional(), // 型式
  COL__DOLLAR__I: z.string().optional(), // シリアル番号
  COL__DOLLAR__J: z.string().optional(), // 保証状況
  COL__DOLLAR__K: z.string().min(1),     // Repair ID
  COL__DOLLAR__L: z.string().min(1),     // 日時
  COL__DOLLAR__M: z.string().min(1),     // 問題内容
  COL__DOLLAR__N: z.string().min(1),     // ステータス
  COL__DOLLAR__O: z.string().min(1),     // 訪問要否
  COL__DOLLAR__P: z.string().min(1),     // 優先度
  COL__DOLLAR__Q: z.string().min(1),     // 対応者
  COL__DOLLAR__R: z.string().optional(), // 備考
  COL__DOLLAR__S: z.string().min(1),     // Name
  COL__DOLLAR__T: z.string().min(1),     // phone
  COL__DOLLAR__U: z.string().min(1),     // date
  COL__DOLLAR__V: z.string().min(1),     // machine
});

export type SheetsRow = z.infer<typeof SheetsRowSchema>;

export function buildSheetsRowFromContext(ctx: RepairConfirmContext): SheetsRow {
  const repairId = `REP_SCHEDULED_${ctx.customerId}`;

  const payload = {
    instructions: "Create LOG row for confirmed repair appointment",
    COL__DOLLAR__A: ctx.customerId,
    COL__DOLLAR__B: ctx.storeName,
    COL__DOLLAR__C: ctx.email || "",
    COL__DOLLAR__D: ctx.phone || "",
    COL__DOLLAR__E: ctx.location || "",
    COL__DOLLAR__F: ctx.product?.productId || "",
    COL__DOLLAR__G: ctx.product?.category || "",
    COL__DOLLAR__H: ctx.product?.model || "",
    COL__DOLLAR__I: ctx.product?.serial || "",
    COL__DOLLAR__J: ctx.product?.warranty || "",
    COL__DOLLAR__K: repairId,
    COL__DOLLAR__L: ctx.appointment.display,
    COL__DOLLAR__M: ctx.issue,
    COL__DOLLAR__N: "未対応",
    COL__DOLLAR__O: "要",
    COL__DOLLAR__P: "中",
    COL__DOLLAR__Q: "AI",
    COL__DOLLAR__R: "",
    COL__DOLLAR__S: ctx.contactName,
    COL__DOLLAR__T: ctx.contactPhone,
    COL__DOLLAR__U: ctx.appointment.display,
    COL__DOLLAR__V: ctx.machineLabel,
  };

  // Validate before returning
  const parsed = SheetsRowSchema.parse(payload);
  return parsed;
}

export const CalendarEventSchema = z.object({
  instructions: z.string().min(1),
  text: z.string().min(1),
  attendees: z.string().optional(),
  calendarid: z.string().optional(),
});

export type CalendarEventPayload = z.infer<typeof CalendarEventSchema>;

export function buildCalendarQuickAdd(ctx: RepairConfirmContext): CalendarEventPayload {
  const title = `【訪問修理】${ctx.machineLabel}（${ctx.storeName}）`;
  const when = ctx.appointment.dateTimeISO;
  const text = `${title} at ${when} 場所: ${ctx.location || ""} 連絡先: ${ctx.contactName} ${ctx.contactPhone} 顧客ID:${ctx.customerId}`;

  const payload = {
    instructions: "Add calendar event for confirmed repair appointment",
    text,
    attendees: ctx.email ? ctx.email : undefined,
    calendarid: process.env.REPAIRS_CALENDAR_ID || undefined,
  };

  return CalendarEventSchema.parse(payload);
}

export async function confirmAndLogRepair(rawCtx: unknown, mastra: any) {
  console.log("[LOGS] confirmAndLogRepair called with:", JSON.stringify(rawCtx, null, 2));

  // Validate incoming context from UI
  const ctx = RepairConfirmContextSchema.parse(rawCtx);
  console.log("[LOGS] Context validated:", JSON.stringify(ctx, null, 2));

  // Defensive validation for must-have fields already done by Zod above
  // Optional extra structural check with validateContext tool
  try {
    const { validateContext } = await import("./orchestrator-tools.js");
    await validateContext.execute({
      context: ctx,
      requiredFields: [
        "customerId",
        "storeName",
        "appointment.dateTimeISO",
        "contactName",
        "contactPhone",
      ],
    });
  } catch {}

  const sheetsPayload = buildSheetsRowFromContext(ctx);
  // Add worksheet specification for Logs
  sheetsPayload.worksheet = "Logs";
  console.log("[LOGS] Sheets payload built:", JSON.stringify(sheetsPayload, null, 2));

  const calendarPayload = buildCalendarQuickAdd(ctx);
  console.log("[LOGS] Calendar payload built:", JSON.stringify(calendarPayload, null, 2));

  // Attempt both writes, never throw back to UI
  try {
    const { googleSheetsCreateRow } = await import("./scheduling-tools.js");
    await googleSheetsCreateRow.execute(sheetsPayload);
  } catch (e) {
    console.error("[LOGS] Sheets write failed", e);
  }

  try {
    const { googleCalendarEvent } = await import("./scheduling-tools.js");
    await googleCalendarEvent.execute(calendarPayload);
  } catch (e) {
    console.error("[LOGS] Calendar write failed", e);
  }

  return { ok: true, repairId: `REP_SCHEDULED_${ctx.customerId}` };
}
