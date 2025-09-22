/**
 * Network Reliability Utilities
 * Safe infrastructure improvements that don't interfere with LLM prompt tracking
 */

// Retry configuration - only for network operations
export const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000,  // 5 seconds max
  backoffMultiplier: 1.5
} as const;

// Timeout configuration
export const timeoutConfig = {
  defaultTimeout: 30000, // 30 seconds
  shortTimeout: 10000,   // 10 seconds for quick operations
  longTimeout: 60000     // 60 seconds for complex operations
} as const;

/**
 * Retry wrapper for async operations
 * Only retries on network-related errors, doesn't add content
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config = retryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Only retry on network-related errors, not content/validation errors
      const isRetryableError = error instanceof TypeError ||
                              (error as any)?.code === 'ECONNRESET' ||
                              (error as any)?.code === 'ETIMEDOUT' ||
                              (error as any)?.code === 'ENOTFOUND';

      if (!isRetryableError || attempt >= config.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );

      // Brief delay before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Timeout wrapper for operations
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = timeoutConfig.defaultTimeout
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Circuit breaker for protecting external services
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
