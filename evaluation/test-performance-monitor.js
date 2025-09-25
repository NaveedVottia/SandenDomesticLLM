#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('📊 Agent Performance Monitor\n');

// Read latest test results (check both root and test-reports directory)
let reportFiles = [];
try {
  reportFiles = readdirSync('.')
    .filter(f => f.startsWith('test-results-'))
    .sort()
    .reverse();
} catch (e) {
  // Fallback to test-reports directory
  const testReportsDir = 'test-reports';
  try {
    reportFiles = readdirSync(testReportsDir)
      .filter(f => f.startsWith('test-results-'))
      .sort()
      .reverse()
      .map(f => join(testReportsDir, f));
  } catch (e2) {
    // No reports found
  }
}

if (reportFiles.length === 0) {
  console.log('❌ No test reports found. Run tests first.');
  process.exit(1);
}

const latestReport = JSON.parse(readFileSync(reportFiles[0], 'utf8'));
console.log(`📈 Analyzing latest test report: ${reportFiles[0]}\n`);

// Performance metrics
const results = latestReport.results;
const successfulTests = results.filter(r => r.success).length;
const failedTests = results.filter(r => !r.success).length;
const avgDuration = results.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) /
                   results.filter(r => r.duration).length;

// Tool usage analysis
const toolUsage = {};
results.forEach(test => {
  if (test.toolsUsed) {
    test.toolsUsed.forEach(tool => {
      toolUsage[tool] = (toolUsage[tool] || 0) + 1;
    });
  }
});

// Error analysis
const errors = results.filter(r => r.error).map(r => ({
  id: r.testId,
  prompt: r.prompt.substring(0, 50) + '...',
  error: r.error
}));

// Performance report
const performanceReport = {
  timestamp: new Date().toISOString(),
  reportFile: reportFiles[0],
  summary: {
    totalTests: results.length,
    successfulTests,
    failedTests,
    successRate: `${((successfulTests / results.length) * 100).toFixed(2)}%`,
    averageDuration: `${avgDuration.toFixed(2)}ms`,
    totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
  },
  toolUsage: Object.entries(toolUsage)
    .sort(([,a], [,b]) => b - a)
    .map(([tool, count]) => ({ tool, count, percentage: `${((count / results.length) * 100).toFixed(1)}%` })),
  errors: errors.length > 0 ? errors : 'No errors',
  recommendations: []
};

// Generate recommendations
if (performanceReport.summary.successRate < '95%') {
  performanceReport.recommendations.push('⚠️  Success rate below 95% - investigate failing tests');
}

if (avgDuration > 10000) {
  performanceReport.recommendations.push('🐌 Average response time > 10s - consider optimization');
}

if (Object.keys(toolUsage).length < 3) {
  performanceReport.recommendations.push('🔧 Limited tool usage - verify agent tool integration');
}

if (performanceReport.recommendations.length === 0) {
  performanceReport.recommendations.push('✅ All metrics within acceptable ranges');
}

// Display report
console.log('📊 PERFORMANCE SUMMARY');
console.log('='.repeat(50));
console.log(`Total Tests:     ${performanceReport.summary.totalTests}`);
console.log(`Success Rate:    ${performanceReport.summary.successRate}`);
console.log(`Average Time:    ${performanceReport.summary.averageDuration}`);
console.log(`Total Duration:  ${performanceReport.summary.totalDuration}ms\n`);

console.log('🔧 TOOL USAGE');
console.log('='.repeat(30));
performanceReport.toolUsage.forEach(({ tool, count, percentage }) => {
  console.log(`${tool}: ${count} (${percentage})`);
});

if (errors.length > 0) {
  console.log('\n❌ ERRORS');
  console.log('='.repeat(20));
  errors.forEach(error => {
    console.log(`Test ${error.id}: ${error.error}`);
  });
}

console.log('\n💡 RECOMMENDATIONS');
console.log('='.repeat(25));
performanceReport.recommendations.forEach(rec => {
  console.log(rec);
});

// Save performance report
const testReportsDir = 'test-reports';
const perfReportPath = join(testReportsDir, `performance-${new Date().toISOString().split('T')[0]}.json`);
writeFileSync(perfReportPath, JSON.stringify(performanceReport, null, 2));
console.log(`\n📁 Performance report saved: ${perfReportPath}`);

// Trend analysis if multiple reports exist
if (reportFiles.length > 1) {
  console.log('\n📈 TREND ANALYSIS');
  console.log('='.repeat(20));

  const previousReport = JSON.parse(readFileSync(join(testReportsDir, reportFiles[1]), 'utf8'));
  const prevSuccessRate = ((previousReport.summary.successfulTests / previousReport.summary.totalTests) * 100).toFixed(2);
  const currentSuccessRate = performanceReport.summary.successRate.replace('%', '');

  const successTrend = currentSuccessRate - prevSuccessRate;
  console.log(`Success Rate Trend: ${successTrend >= 0 ? '+' : ''}${successTrend}%`);

  const prevAvgTime = previousReport.summary.averageDuration;
  const timeTrend = avgDuration - prevAvgTime;
  console.log(`Avg Response Time Trend: ${timeTrend >= 0 ? '+' : ''}${timeTrend.toFixed(2)}ms`);
}

console.log('\n✨ Performance analysis complete!');
