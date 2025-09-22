/**
 * GENIAC Topic 1 - Operational Metrics Tracking
 * Comprehensive performance monitoring for LLM evaluation
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  // Response Time Metrics
  ttft: number; // Time to First Token (ms)
  totalResponseTime: number; // Total response time (ms)
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };

  // Token Usage Metrics
  tokens: {
    input: number;
    output: number;
    total: number;
  };

  // Cost Metrics
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };

  // Throughput Metrics
  throughput: {
    requestsPerSecond: number;
    tokensPerSecond: number;
    concurrentUsers: number;
  };

  // Error Metrics
  errors: {
    count: number;
    rate: number;
    types: Record<string, number>;
  };

  // Tool Execution Metrics
  tools: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
    toolBreakdown: Record<string, {
      calls: number;
      successRate: number;
      averageTime: number;
    }>;
  };
}

export interface TestExecution {
  testId: string;
  startTime: number;
  firstTokenTime?: number;
  endTime?: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  toolsExecuted?: Array<{
    toolName: string;
    startTime: number;
    endTime?: number;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

export class MetricsCollector {
  private executions: Map<string, TestExecution> = new Map();
  private responseTimes: number[] = [];
  private ttftTimes: number[] = [];
  private toolExecutionTimes: Map<string, number[]> = new Map();

  /**
   * Start tracking a test execution
   */
  startTest(testId: string): void {
    const execution: TestExecution = {
      testId,
      startTime: performance.now(),
      toolsExecuted: []
    };
    this.executions.set(testId, execution);
  }

  /**
   * Record first token time (TTFT)
   */
  recordFirstToken(testId: string): void {
    const execution = this.executions.get(testId);
    if (execution && !execution.firstTokenTime) {
      execution.firstTokenTime = performance.now();
    }
  }

  /**
   * Record tool execution start
   */
  startToolExecution(testId: string, toolName: string): void {
    const execution = this.executions.get(testId);
    if (execution) {
      execution.toolsExecuted = execution.toolsExecuted || [];
      execution.toolsExecuted.push({
        toolName,
        startTime: performance.now(),
        success: true // Default to true, will be updated when tool completes
      });
    }
  }

  /**
   * Record tool execution completion
   */
  endToolExecution(testId: string, toolName: string, success: boolean, error?: string): void {
    const execution = this.executions.get(testId);
    if (execution?.toolsExecuted) {
      const toolExecution = execution.toolsExecuted
        .filter(tool => tool.toolName === toolName && !tool.endTime)
        .pop();

      if (toolExecution) {
        toolExecution.endTime = performance.now();
        toolExecution.success = success;
        if (error) toolExecution.error = error;
      }
    }
  }

  /**
   * Record token usage
   */
  recordTokenUsage(testId: string, inputTokens: number, outputTokens: number): void {
    const execution = this.executions.get(testId);
    if (execution) {
      execution.tokensUsed = { input: inputTokens, output: outputTokens };
    }
  }

  /**
   * Complete test execution
   */
  endTest(testId: string, error?: string): void {
    const execution = this.executions.get(testId);
    if (execution) {
      execution.endTime = performance.now();
      if (error) execution.error = error;

      // Record metrics for aggregation
      if (execution.endTime && execution.startTime) {
        const totalTime = execution.endTime - execution.startTime;
        this.responseTimes.push(totalTime);

        if (execution.firstTokenTime) {
          const ttft = execution.firstTokenTime - execution.startTime;
          this.ttftTimes.push(ttft);
        }
      }

      // Record tool execution times
      execution.toolsExecuted?.forEach(tool => {
        if (tool.endTime && tool.startTime) {
          const toolTime = tool.endTime - tool.startTime;
          const toolTimes = this.toolExecutionTimes.get(tool.toolName) || [];
          toolTimes.push(toolTime);
          this.toolExecutionTimes.set(tool.toolName, toolTimes);
        }
      });
    }
  }

  /**
   * Calculate comprehensive performance metrics
   */
  calculateMetrics(): PerformanceMetrics {
    // Calculate percentiles
    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const sortedTtftTimes = [...this.ttftTimes].sort((a, b) => a - b);

    const p50 = this.calculatePercentile(sortedResponseTimes, 50);
    const p95 = this.calculatePercentile(sortedResponseTimes, 95);
    const p99 = this.calculatePercentile(sortedResponseTimes, 99);

    const ttftP50 = this.calculatePercentile(sortedTtftTimes, 50);
    const ttftP95 = this.calculatePercentile(sortedTtftTimes, 95);
    const ttftP99 = this.calculatePercentile(sortedTtftTimes, 99);

    // Calculate token and cost metrics (estimates based on Claude 3.5 Sonnet pricing)
    const totalTokens = Array.from(this.executions.values())
      .filter(exec => exec.tokensUsed)
      .reduce((acc, exec) => ({
        input: acc.input + (exec.tokensUsed?.input || 0),
        output: acc.output + (exec.tokensUsed?.output || 0)
      }), { input: 0, output: 0 });

    // Claude 3.5 Sonnet pricing (as of 2025)
    const inputCostPerToken = 0.000003; // $3 per million tokens
    const outputCostPerToken = 0.000015; // $15 per million tokens

    const inputCost = totalTokens.input * inputCostPerToken;
    const outputCost = totalTokens.output * outputCostPerToken;
    const totalCost = inputCost + outputCost;

    // Calculate tool metrics
    const toolMetrics: Record<string, { calls: number; successRate: number; averageTime: number }> = {};
    let totalToolCalls = 0;
    let successfulToolCalls = 0;
    let totalToolTime = 0;

    for (const [toolName, times] of this.toolExecutionTimes) {
      const calls = times.length;
      const successfulCalls = times.length; // Assume all completed calls are successful for now
      const averageTime = times.reduce((sum, time) => sum + time, 0) / calls;

      toolMetrics[toolName] = {
        calls,
        successRate: 1.0, // Placeholder - would need actual success tracking
        averageTime
      };

      totalToolCalls += calls;
      successfulToolCalls += successfulCalls;
      totalToolTime += times.reduce((sum, time) => sum + time, 0);
    }

    const averageToolTime = totalToolCalls > 0 ? totalToolTime / totalToolCalls : 0;

    // Calculate throughput (based on test duration)
    const totalTestDuration = Math.max(...this.responseTimes) / 1000; // Convert to seconds
    const requestsPerSecond = this.executions.size / Math.max(totalTestDuration, 1);
    const tokensPerSecond = (totalTokens.input + totalTokens.output) / Math.max(totalTestDuration, 1);

    // Error metrics
    const failedTests = Array.from(this.executions.values()).filter(exec => exec.error).length;
    const errorRate = this.executions.size > 0 ? failedTests / this.executions.size : 0;

    return {
      ttft: ttftP50,
      totalResponseTime: p50,
      percentiles: {
        p50,
        p95,
        p99
      },
      tokens: {
        input: totalTokens.input,
        output: totalTokens.output,
        total: totalTokens.input + totalTokens.output
      },
      cost: {
        inputCost,
        outputCost,
        totalCost,
        currency: 'USD'
      },
      throughput: {
        requestsPerSecond,
        tokensPerSecond,
        concurrentUsers: 1 // Sequential execution
      },
      errors: {
        count: failedTests,
        rate: errorRate,
        types: this.categorizeErrors()
      },
      tools: {
        totalCalls: totalToolCalls,
        successfulCalls: successfulToolCalls,
        failedCalls: totalToolCalls - successfulToolCalls,
        averageExecutionTime: averageToolTime,
        toolBreakdown: toolMetrics
      }
    };
  }

  /**
   * Generate comprehensive metrics report
   */
  generateReport(): string {
    const metrics = this.calculateMetrics();

    return `
# GENIAC Topic 1 - Performance Metrics Report

## Response Time Metrics
- TTFT (Time to First Token): ${metrics.ttft.toFixed(2)}ms
- P50 Response Time: ${metrics.percentiles.p50.toFixed(2)}ms
- P95 Response Time: ${metrics.percentiles.p95.toFixed(2)}ms
- P99 Response Time: ${metrics.percentiles.p99.toFixed(2)}ms

## Token Usage
- Input Tokens: ${metrics.tokens.input}
- Output Tokens: ${metrics.tokens.output}
- Total Tokens: ${metrics.tokens.total}

## Cost Analysis (${metrics.cost.currency})
- Input Cost: $${metrics.cost.inputCost.toFixed(6)}
- Output Cost: $${metrics.cost.outputCost.toFixed(6)}
- Total Cost: $${metrics.cost.totalCost.toFixed(6)}

## Throughput Metrics
- Requests/Second: ${metrics.throughput.requestsPerSecond.toFixed(2)}
- Tokens/Second: ${metrics.throughput.tokensPerSecond.toFixed(2)}
- Concurrent Users: ${metrics.throughput.concurrentUsers}

## Error Metrics
- Error Count: ${metrics.errors.count}
- Error Rate: ${(metrics.errors.rate * 100).toFixed(2)}%
- Error Types: ${JSON.stringify(metrics.errors.types, null, 2)}

## Tool Execution Metrics
- Total Tool Calls: ${metrics.tools.totalCalls}
- Successful Calls: ${metrics.tools.successfulCalls}
- Failed Calls: ${metrics.tools.failedCalls}
- Average Execution Time: ${metrics.tools.averageExecutionTime.toFixed(2)}ms

### Tool Breakdown:
${Object.entries(metrics.tools.toolBreakdown)
  .map(([tool, stats]) =>
    `- ${tool}: ${stats.calls} calls, ${(stats.successRate * 100).toFixed(1)}% success, ${stats.averageTime.toFixed(2)}ms avg`
  ).join('\n')}

## Test Summary
- Total Tests: ${this.executions.size}
- Completed Tests: ${this.executions.size - metrics.errors.count}
- Failed Tests: ${metrics.errors.count}
- Average Response Time: ${this.responseTimes.length > 0
    ? (this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length).toFixed(2)
    : 0}ms
`;
  }

  /**
   * Export metrics in JSON format for further analysis
   */
  exportMetrics(): any {
    return {
      executions: Array.from(this.executions.entries()),
      responseTimes: this.responseTimes,
      ttftTimes: this.ttftTimes,
      toolExecutionTimes: Object.fromEntries(this.toolExecutionTimes),
      calculatedMetrics: this.calculateMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private categorizeErrors(): Record<string, number> {
    const errorTypes: Record<string, number> = {};

    for (const execution of this.executions.values()) {
      if (execution.error) {
        // Simple categorization - could be enhanced with more sophisticated error classification
        if (execution.error.includes('timeout')) {
          errorTypes.timeout = (errorTypes.timeout || 0) + 1;
        } else if (execution.error.includes('network')) {
          errorTypes.network = (errorTypes.network || 0) + 1;
        } else if (execution.error.includes('tool')) {
          errorTypes.tool = (errorTypes.tool || 0) + 1;
        } else {
          errorTypes.other = (errorTypes.other || 0) + 1;
        }
      }
    }

    return errorTypes;
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

// Convenience functions for easy integration
export function startTestTracking(testId: string): void {
  metricsCollector.startTest(testId);
}

export function recordFirstToken(testId: string): void {
  metricsCollector.recordFirstToken(testId);
}

export function startToolTracking(testId: string, toolName: string): void {
  metricsCollector.startToolExecution(testId, toolName);
}

export function endToolTracking(testId: string, toolName: string, success: boolean, error?: string): void {
  metricsCollector.endToolExecution(testId, toolName, success, error);
}

export function recordTokens(testId: string, inputTokens: number, outputTokens: number): void {
  metricsCollector.recordTokenUsage(testId, inputTokens, outputTokens);
}

export function endTestTracking(testId: string, error?: string): void {
  metricsCollector.endTest(testId, error);
}

export function getMetricsReport(): string {
  return metricsCollector.generateReport();
}

export function exportMetricsData(): any {
  return metricsCollector.exportMetrics();
}
