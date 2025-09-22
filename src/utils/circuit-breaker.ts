
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
