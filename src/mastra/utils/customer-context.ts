import { sharedMemory } from "../agents/sanden/customer-identification";

/**
 * Standardized customer context utility for consistent customer ID handling across all tools
 */
export interface CustomerContext {
  customerId?: string;
  sessionId?: string;
  session?: any;
  customerProfile?: any;
}

/**
 * Extract customer ID from various context sources in priority order
 */
export function extractCustomerId(context: any): string | null {
  // Priority 1: Direct customerId parameter
  if (context.customerId) {
    console.log(`🔍 [CustomerContext] Found customerId in direct context: ${context.customerId}`);
    return context.customerId;
  }

  // Priority 2: Session customerId
  if (context.session?.customerId) {
    console.log(`🔍 [CustomerContext] Found customerId in session: ${context.session.customerId}`);
    return context.session.customerId;
  }

  // Priority 3: Shared memory
  try {
    const memoryCustomerId = sharedMemory.get("customerId");
    if (memoryCustomerId) {
      console.log(`🔍 [CustomerContext] Found customerId in shared memory: ${memoryCustomerId}`);
      return memoryCustomerId;
    }
  } catch (error) {
    console.log(`❌ [CustomerContext] Error getting customerId from memory:`, error);
  }

  console.log(`❌ [CustomerContext] No customerId found in any context source`);
  return null;
}

/**
 * Extract session ID from various context sources
 */
export function extractSessionId(context: any): string | null {
  if (context.sessionId) return context.sessionId;
  if (context.session?.sessionId) return context.session.sessionId;
  
  try {
    return sharedMemory.get("sessionId");
  } catch (error) {
    console.log(`❌ [CustomerContext] Error getting sessionId from memory:`, error);
    return null;
  }
}

/**
 * Get comprehensive customer context with all available data
 */
export function getCustomerContext(context: any): CustomerContext {
  const customerId = extractCustomerId(context);
  const sessionId = extractSessionId(context);
  
  return {
    customerId: customerId || undefined,
    sessionId: sessionId || undefined,
    session: context.session,
    customerProfile: context.customerProfile || context.session?.customerProfile
  };
}

/**
 * Validate that customer ID is available, return error message if not
 */
export function validateCustomerId(context: any): { isValid: boolean; customerId?: string; errorMessage?: string } {
  const customerId = extractCustomerId(context);
  
  if (!customerId) {
    return {
      isValid: false,
      errorMessage: "顧客IDが見つかりません。先に顧客識別を完了してください。"
    };
  }
  
  return {
    isValid: true,
    customerId
  };
}

/**
 * Create standardized tool context with customer data
 */
export function createToolContext(baseContext: any, additionalData: any = {}): any {
  const customerContext = getCustomerContext(baseContext);
  
  return {
    ...baseContext,
    ...customerContext,
    ...additionalData,
    // Ensure customerId is always at root level for easy access
    customerId: customerContext.customerId,
    sessionId: customerContext.sessionId
  };
}
