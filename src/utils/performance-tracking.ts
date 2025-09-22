/**
 * Performance Tracking Utilities
 * Infrastructure monitoring that doesn't interfere with LLM operations
 */

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, any>;
}

/**
 * Simple performance tracker
 * Tracks timing without adding content to responses
 */
export class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000;
  private alertThresholds = {
    slowOperation: 10000, // 10 seconds
    verySlowOperation: 30000 // 30 seconds
  };

  startOperation(operation: string, metadata?: Record<string, any>): string {
    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metric: PerformanceMetric = {
      operation,
      startTime: Date.now(),
      success: false,
      metadata
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    return id;
  }

  endOperation(id: string, success: boolean = true, errorType?: string) {
    const metric = this.metrics.find(m => `${m.operation}_${m.startTime}` === id.split('_').slice(0, -2).join('_'));
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      metric.errorType = errorType;

      // Log performance alerts (but don't modify responses)
      if (metric.duration && metric.duration > this.alertThresholds.verySlowOperation) {
        console.warn(`🚨 VERY SLOW: ${metric.operation} took ${metric.duration}ms`);
      } else if (metric.duration && metric.duration > this.alertThresholds.slowOperation) {
        console.warn(`🐌 SLOW: ${metric.operation} took ${metric.duration}ms`);
      }
    }
  }

  getMetricsSummary(hours: number = 1) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.startTime > cutoffTime);

    if (recentMetrics.length === 0) {
      return { total: 0, avgDuration: 0, successRate: 0, slowOperations: 0 };
    }

    const completedMetrics = recentMetrics.filter(m => m.duration !== undefined);
    const avgDuration = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length;
    const successRate = (recentMetrics.filter(m => m.success).length / recentMetrics.length) * 100;
    const slowOperations = completedMetrics.filter(m => (m.duration || 0) > this.alertThresholds.slowOperation).length;

    return {
      total: recentMetrics.length,
      avgDuration: Math.round(avgDuration),
      successRate: Math.round(successRate),
      slowOperations
    };
  }

  getRecentSlowOperations(limit: number = 10) {
    return this.metrics
      .filter(m => m.duration && m.duration > this.alertThresholds.slowOperation)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit)
      .map(m => ({
        operation: m.operation,
        duration: m.duration,
        success: m.success,
        timestamp: new Date(m.startTime).toISOString()
      }));
  }

  clearMetrics() {
    this.metrics = [];
  }
}

// Global performance tracker instance
export const performanceTracker = new PerformanceTracker();
