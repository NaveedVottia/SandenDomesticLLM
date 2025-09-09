import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

// Simple in-memory storage for customer data (temporary solution)
const customerMemory = new Map<string, any>();

// Create a shared memory instance with proper storage configuration
export const sharedMastraMemory = new Memory({
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Same database as main Mastra instance
  }),
});

console.log("✅ Created shared Mastra Memory instance with LibSQL storage");

// Helper functions for memory management using legacy approach
export const createMemoryIds = (sessionId: string, customerId?: string) => {
  const resourceId = customerId || sessionId; // Use customer ID as resource if available
  const threadId = `thread-${sessionId}`;
  
  return {
    resource: resourceId,
    thread: threadId
  };
};

// Store customer data in memory using simple Map storage
export const storeCustomerData = async (memIds: { resource: string; thread: string }, customerData: any) => {
  try {
    // Use simple Map storage
    const key = `customer_${memIds.resource}`;
    customerMemory.set(key, {
      customerId: customerData.customerId,
      storeName: customerData.storeName,
      email: customerData.email,
      phone: customerData.phone,
      location: customerData.location,
      lastInteraction: new Date().toISOString(),
      currentAgent: "customer-identification",
      sessionStart: new Date().toISOString()
    });
    
    console.log(`🔍 [Memory] Stored customer data for key: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error storing customer data:`, error);
    return false;
  }
};

// Get customer data from memory using simple Map storage
export const getCustomerData = async (memIds: { resource: string; thread: string }) => {
  try {
    // Use simple Map storage
    const key = `customer_${memIds.resource}`;
    const customerData = customerMemory.get(key);
    
    if (customerData && customerData.customerId) {
      console.log(`🔍 [Memory] Retrieved customer data for key: ${key}`);
      return customerData;
    }
    
    console.log(`🔍 [Memory] No customer data found for key: ${key}`);
    return null;
  } catch (error) {
    console.error(`❌ [Memory] Error getting customer data:`, error);
    return null;
  }
};

// Update current agent in memory
export const updateCurrentAgent = async (memIds: { resource: string; thread: string }, agentName: string) => {
  try {
    // Get current working memory and update agent info (with type assertion)
    const currentMemory = await (sharedMastraMemory as any).getWorkingMemory({
      resourceId: memIds.resource,
      threadId: memIds.thread
    });
    
    await (sharedMastraMemory as any).updateWorkingMemory({
      resourceId: memIds.resource,
      threadId: memIds.thread,
      workingMemory: {
        ...currentMemory,
        currentAgent: agentName,
        lastInteraction: new Date().toISOString()
      }
    });
    
    console.log(`🔍 [Memory] Updated current agent to: ${agentName}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error updating current agent:`, error);
    return false;
  }
};

// Clear customer memory
export const clearCustomerMemory = async (memIds: { resource: string; thread: string }) => {
  try {
    // Clear working memory by setting it to empty object (with type assertion)
    await (sharedMastraMemory as any).updateWorkingMemory({
      resourceId: memIds.resource,
      threadId: memIds.thread,
      workingMemory: {}
    });
    
    console.log(`🔍 [Memory] Cleared customer memory for resource: ${memIds.resource}`);
    return true;
  } catch (error) {
    console.error(`❌ [Memory] Error clearing customer memory:`, error);
    return false;
  }
};

export default sharedMastraMemory;
