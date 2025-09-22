
interface FallbackStrategy {
  isAvailable(): boolean;
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

class CachedFallback implements FallbackStrategy {
  private cache: Map<string, any> = new Map();
  private readonly ttl: number; // Time to live in milliseconds

  constructor(ttl = 300000) { // 5 minutes default
    this.ttl = ttl;
  }

  isAvailable(): boolean {
    return this.cache.size > 0;
  }

  setCache(key: string, value: any) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // This is a fallback, so we don't execute new operations
    // Instead, we would return cached results if available
    throw new Error('Cached fallback - no operation to execute');
  }
}

class SimplifiedFallback implements FallbackStrategy {
  isAvailable(): boolean {
    return true; // Always available
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Execute a simplified version of the operation
    // For example, return basic customer info instead of full analysis
    try {
      return await operation();
    } catch (error) {
      // Return a simplified response
      return {
        success: false,
        degraded: true,
        message: 'サービスが一時的に制限されていますが、基本的な機能は利用可能です。',
        timestamp: new Date().toISOString()
      } as T;
    }
  }
}

class GracefulDegradationManager {
  private fallbacks: FallbackStrategy[] = [];

  addFallback(fallback: FallbackStrategy) {
    this.fallbacks.push(fallback);
  }

  async executeWithFallbacks<T>(
    primaryOperation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    // Try primary operation first
    try {
      return await primaryOperation();
    } catch (primaryError) {
      console.warn(`Primary operation failed for ${context || 'unknown'}, trying fallbacks...`, (primaryError as Error).message);

      // Try each fallback in order
      for (const fallback of this.fallbacks) {
        if (fallback.isAvailable()) {
          try {
            console.log('Attempting fallback operation...');
            return await fallback.execute(primaryOperation);
          } catch (fallbackError) {
            console.warn('Fallback operation failed:', (fallbackError as Error).message);
          }
        }
      }

      // All operations failed
      throw primaryError;
    }
  }
}

// Usage example:
// const degradationManager = new GracefulDegradationManager();
// degradationManager.addFallback(new CachedFallback());
// degradationManager.addFallback(new SimplifiedFallback());
//
// const result = await degradationManager.executeWithFallbacks(
//   () => performComplexAnalysis(),
//   'customer-analysis'
// );
