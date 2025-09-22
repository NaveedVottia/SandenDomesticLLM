
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
      console.warn(`🚨 SLOW RESPONSE ALERT: ${metric.endpoint} took ${metric.duration}ms`);
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
