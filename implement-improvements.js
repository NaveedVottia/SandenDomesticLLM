#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Safe improvements that can be added without breaking existing functionality

console.log('🔧 Implementing Safe System Improvements...\n');

// 1. Add retry logic for API calls (Priority 1)
console.log('1️⃣ Adding Network Reliability - Retry Logic');

const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
};

const retryLogic = `
async function withRetry(operation, config = ${JSON.stringify(retryConfig, null, 2)}) {
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );

        console.warn(\`Attempt \${attempt + 1} failed, retrying in \${delay}ms...\`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage example:
// const result = await withRetry(() => fetch('/api/endpoint'));
`;

writeFileSync('src/utils/retry-utils.ts', retryLogic);
console.log('✅ Created retry utility in src/utils/retry-utils.ts');

// 2. Add timeout handling for HTTP requests (Priority 1)
console.log('\n2️⃣ Adding Network Reliability - Timeout Handling');

const timeoutLogic = `
class TimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout(promise, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError(\`Request timed out after \${timeoutMs}ms\`)), timeoutMs)
    )
  ]);
}

// Usage example:
// const response = await withTimeout(fetch('/api/endpoint'), 10000);
`;

writeFileSync('src/utils/timeout-utils.ts', timeoutLogic);
console.log('✅ Created timeout utility in src/utils/timeout-utils.ts');

// 3. Add response time monitoring (Priority 1)
console.log('\n3️⃣ Adding Performance Monitoring - Response Time Alerts');

const monitoringLogic = `
interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: Date;
  userAgent?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly alertThreshold = 5000; // 5 seconds

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // Alert on slow responses
    if (metric.duration > this.alertThreshold) {
      console.warn(\`🚨 SLOW RESPONSE ALERT: \${metric.endpoint} took \${metric.duration}ms\`);
    }

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetricsSummary() {
    const recent = this.metrics.slice(-100);
    const avgDuration = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
    const slowRequests = recent.filter(m => m.duration > this.alertThreshold).length;

    return {
      totalRequests: recent.length,
      averageDuration: Math.round(avgDuration),
      slowRequests,
      slowRequestPercentage: Math.round((slowRequests / recent.length) * 100)
    };
  }

  exportMetrics() {
    return this.metrics;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Usage example:
// performanceMonitor.recordMetric({
//   endpoint: '/api/agents/customer-identification',
//   method: 'POST',
//   duration: 2500,
//   status: 200,
//   timestamp: new Date()
// });
`;

writeFileSync('src/utils/performance-monitor.ts', monitoringLogic);
console.log('✅ Created performance monitor in src/utils/performance-monitor.ts');

// 4. Add graceful error messages (Priority 2)
console.log('\n4️⃣ Adding Error Recovery - User-Friendly Messages');

const errorMessages = `
interface ErrorMapping {
  [key: string]: {
    userMessage: string;
    suggestions: string[];
  };
}

const errorMappings: ErrorMapping = {
  'NETWORK_ERROR': {
    userMessage: '申し訳ありません。ネットワーク接続に問題が発生しています。',
    suggestions: [
      'インターネット接続を確認してください',
      'しばらく待ってから再度お試しください',
      '問題が続く場合はカスタマーサポートまでお問い合わせください'
    ]
  },
  'DATABASE_ERROR': {
    userMessage: '申し訳ありません。データベースに一時的な問題が発生しています。',
    suggestions: [
      '数分待ってから再度お試しください',
      '情報が正しく入力されているか確認してください'
    ]
  },
  'TIMEOUT_ERROR': {
    userMessage: '申し訳ありません。処理がタイムアウトしました。',
    suggestions: [
      '再度お試しください',
      '問題が続く場合はよりシンプルなクエリでお試しください'
    ]
  },
  'TOOL_ERROR': {
    userMessage: '申し訳ありません。システムで一時的なエラーが発生しています。',
    suggestions: [
      '数秒待ってから再度お試しください',
      '別の方法で情報を検索してみてください'
    ]
  }
};

function getUserFriendlyError(errorCode: string): { message: string; suggestions: string[] } {
  const mapping = errorMappings[errorCode] || errorMappings['TOOL_ERROR'];

  return {
    message: mapping.userMessage,
    suggestions: mapping.suggestions
  };
}

// Usage example:
// const error = getUserFriendlyError('NETWORK_ERROR');
// console.log(error.message);
// error.suggestions.forEach(suggestion => console.log(\`- \${suggestion}\`));
`;

writeFileSync('src/utils/error-messages.ts', errorMessages);
console.log('✅ Created user-friendly error messages in src/utils/error-messages.ts');

// 5. Add circuit breaker pattern (Priority 1)
console.log('\n5️⃣ Adding Network Reliability - Circuit Breaker');

const circuitBreakerLogic = `
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number;  // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window to count failures (ms)
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();

      // Success - reset on half-open, keep closed
      if (this.state === CircuitState.HALF_OPEN) {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    // Clean up old failures outside monitoring period
    if (Date.now() - this.lastFailureTime > this.config.monitoringPeriod) {
      this.failures = 1;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private reset() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Usage example:
// const circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTimeout: 30000 });
// const result = await circuitBreaker.execute(() => fetch('/api/external-service'));
`;

writeFileSync('src/utils/circuit-breaker.ts', circuitBreakerLogic);
console.log('✅ Created circuit breaker in src/utils/circuit-breaker.ts');

// 6. Add graceful degradation (Priority 2)
console.log('\n6️⃣ Adding Error Recovery - Graceful Degradation');

const gracefulDegradationLogic = `
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
      console.warn(\`Primary operation failed for \${context || 'unknown'}, trying fallbacks...\`, primaryError.message);

      // Try each fallback in order
      for (const fallback of this.fallbacks) {
        if (fallback.isAvailable()) {
          try {
            console.log('Attempting fallback operation...');
            return await fallback.execute(primaryOperation);
          } catch (fallbackError) {
            console.warn('Fallback operation failed:', fallbackError.message);
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
`;

writeFileSync('src/utils/graceful-degradation.ts', gracefulDegradationLogic);
console.log('✅ Created graceful degradation utilities in src/utils/graceful-degradation.ts');

console.log('\n🎉 Safe Improvements Implemented Successfully!');
console.log('\n📁 Created Files:');
console.log('- src/utils/retry-utils.ts');
console.log('- src/utils/timeout-utils.ts');
console.log('- src/utils/performance-monitor.ts');
console.log('- src/utils/error-messages.ts');
console.log('- src/utils/circuit-breaker.ts');
console.log('- src/utils/graceful-degradation.ts');

console.log('\n⚠️  Next Steps:');
console.log('1. Review the generated utility files');
console.log('2. Integrate them into your existing codebase where appropriate');
console.log('3. Test the improvements in a development environment first');
console.log('4. For database caching and Langfuse optimization, additional analysis needed');

console.log('\n🔒 All changes are backwards-compatible and won\'t break existing functionality.');
