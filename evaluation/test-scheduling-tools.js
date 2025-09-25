import { createSchedulingEntry, googleSheetsCreateRow, googleCalendarAddEvent } from './dist/mastra/tools/sanden/scheduling-tools.js';
import { storeCustomerData, createMemoryIds } from './dist/mastra/shared-memory.js';
import dotenv from 'dotenv';

dotenv.config({ path: './server.env' });

async function testSchedulingTools() {
  console.log("🧪 Testing Scheduling Tools...\n");

  try {
    // Step 1: Store test customer data
    console.log("📝 Step 1: Storing test customer data...");
    const memIds = createMemoryIds("test-customer", "test-customer");
    const customerData = {
      customerId: "test-customer",
      storeName: "Test Store",
      email: "test@example.com",
      phone: "123-456-7890",
      location: "Tokyo"
    };
    
    const stored = await storeCustomerData(memIds, customerData);
    console.log("✅ Customer data stored:", stored);

    // Step 2: Test createSchedulingEntry
    console.log("\n📝 Step 2: Testing createSchedulingEntry...");
    const schedulingData = {
      customerId: "test-customer",
      companyName: "Test Store",
      email: "test@example.com",
      phone: "123-456-7890",
      location: "Tokyo",
      productId: "PROD001",
      productCategory: "Vending Machine",
      model: "VM-2024",
      serialNumber: "SN001",
      warrantyStatus: "有効",
      repairId: "REP001",
      scheduledDateTime: "2025-09-10 15:00",
      issueDescription: "Test repair scheduling",
      status: "予約済み",
      visitRequired: "要",
      priority: "中",
      technician: "AI",
      notes: "Test scheduling entry"
    };

    const result1 = await createSchedulingEntry.execute({ context: schedulingData });
    console.log("✅ createSchedulingEntry result:", result1);

    // Step 3: Test googleSheetsCreateRow
    console.log("\n📝 Step 3: Testing googleSheetsCreateRow...");
    const sheetData = {
      instructions: "Create test row",
      worksheet: "Logs",
      "COL__DOLLAR__A": "test-customer",
      "COL__DOLLAR__B": "Test Store",
      "COL__DOLLAR__C": "test@example.com",
      "COL__DOLLAR__D": "123-456-7890",
      "COL__DOLLAR__E": "Tokyo",
      "COL__DOLLAR__F": "PROD001",
      "COL__DOLLAR__G": "Vending Machine",
      "COL__DOLLAR__H": "VM-2024",
      "COL__DOLLAR__I": "SN001",
      "COL__DOLLAR__J": "有効",
      "COL__DOLLAR__K": "REP002",
      "COL__DOLLAR__L": "2025-09-10 16:00",
      "COL__DOLLAR__M": "Test sheet creation",
      "COL__DOLLAR__N": "予約済み",
      "COL__DOLLAR__O": "要",
      "COL__DOLLAR__P": "中",
      "COL__DOLLAR__Q": "AI",
      "COL__DOLLAR__R": "Test sheet entry",
      "COL__DOLLAR__S": "AI",
      "COL__DOLLAR__T": "123-456-7890",
      "COL__DOLLAR__U": "2025-09-10 16:00",
      "COL__DOLLAR__V": "VM-2024"
    };

    const result2 = await googleSheetsCreateRow.execute({ context: sheetData });
    console.log("✅ googleSheetsCreateRow result:", result2);

    // Step 4: Test googleCalendarAddEvent
    console.log("\n📝 Step 4: Testing googleCalendarAddEvent...");
    const calendarData = {
      instructions: "Create test calendar event",
      text: "Test repair appointment for Test Store - VM-2024 on 2025-09-10 17:00"
    };

    const result3 = await googleCalendarAddEvent.execute({ context: calendarData });
    console.log("✅ googleCalendarAddEvent result:", result3);

    console.log("\n🎉 All scheduling tools tested successfully!");

  } catch (error) {
    console.error("❌ Error testing scheduling tools:", error);
  }
}

testSchedulingTools();
