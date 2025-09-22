import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const testPrompts = [
  { id: 1, prompt: "cust001 の修理履歴を見せてください" },
  { id: 2, prompt: "株式会社セブンイレブン 渋谷店の登録製品を確認したい" },
  { id: 3, prompt: "suzuki@seven-eleven.co.jp の製品保証状況を教えて" },
  { id: 4, prompt: "03-1234-5678 からエアコン修理の依頼です" },
  { id: 5, prompt: "cust002 の過去の修理記録を確認してください" },
  { id: 6, prompt: "ローソン 秋葉原店の所有製品を一覧表示してください" },
  { id: 7, prompt: "tanaka@lawson.co.jp の保証期間が切れていないか確認して" },
  { id: 8, prompt: "06-9876-5432 です、冷蔵庫が故障しました今すぐ来てください" },
  { id: 9, prompt: "cust003 の修理履歴と製品保証状況を分析してください" },
  { id: 10, prompt: "cust999 の情報を表示してください" },
  { id: 11, prompt: "田中さんの修理履歴を見たい" },
  { id: 12, prompt: "1" },
  { id: 13, prompt: "cust004 の保証について質問があります" },
  { id: 14, prompt: "cust005 の製品を調べて、保証対象外のものを教えて" },
  { id: 15, prompt: "cust006 今日の午後2時に修理に来てください" },
  { id: 16, prompt: "cust007 の修理パターンと製品使用状況を分析してください" },
  { id: 17, prompt: "会社はファミマですが、正確な店舗名がわかりません" },
  { id: 18, prompt: "cust008 の修理完了を記録してください" },
  { id: 19, prompt: "先月の修理で問題が多かった顧客を特定してください" },
  { id: 20, prompt: "新しい顧客として会社名サークルK、連絡先090-1111-2222で登録して、明日の修理予約をお願いします" }
];

async function testAllPrompts() {
  const results = [];
  const toolLogs = [];

  for (const testCase of testPrompts) {
    console.log(`Testing prompt #${testCase.id}: ${testCase.prompt.substring(0, 50)}...`);

    const sessionId = `TEST-${Date.now()}-${testCase.id}`;
    const startTime = new Date().toISOString();

    try {
      const response = await fetch('http://localhost/api/agents/customer-identification/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: testCase.prompt }]
        })
      });

      const data = await response.json();
      const endTime = new Date().toISOString();

      // Extract tool usage from logs (this is simplified - you'd need to integrate with actual logging)
      const toolUsage = await extractToolUsage(sessionId);

      results.push({
        testId: testCase.id,
        prompt: testCase.prompt,
        response: data.result,
        success: response.ok,
        duration: new Date(endTime) - new Date(startTime),
        toolsUsed: toolUsage.tools,
        timestamp: startTime
      });

      toolLogs.push(...toolUsage.logs);

    } catch (error) {
      console.error(`Error testing prompt #${testCase.id}:`, error.message);
      results.push({
        testId: testCase.id,
        prompt: testCase.prompt,
        error: error.message,
        success: false,
        timestamp: startTime
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate comprehensive JSON report
  const report = {
    timestamp: new Date().toISOString(),
    testSuite: "Customer Identification Agent - Full Prompt Suite",
    totalTests: testPrompts.length,
    results: results,
    toolLogs: toolLogs,
    summary: {
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      averageDuration: results.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.duration).length,
      toolUsageStats: calculateToolStats(toolLogs)
    },
    langfuseUrl: "https://langfuse.demo.dev-maestra.vottia.me",
    uiUrl: "https://demo.dev-maestra.vottia.me/sanden/"
  };

  // Save to JSON file
  const filename = `test-results-${new Date().toISOString().split('T')[0]}.json`;
  writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`Results saved to ${filename}`);

  return report;
}

function calculateToolStats(toolLogs) {
  const stats = {};
  toolLogs.forEach(log => {
    if (!stats[log.tool]) {
      stats[log.tool] = { total: 0, successful: 0, failed: 0 };
    }
    stats[log.tool].total++;
    if (log.success) {
      stats[log.tool].successful++;
    } else {
      stats[log.tool].failed++;
    }
  });

  // Calculate success rates
  Object.keys(stats).forEach(tool => {
    stats[tool].successRate = ((stats[tool].successful / stats[tool].total) * 100).toFixed(2) + '%';
  });

  return stats;
}

// Simplified tool extraction (would need actual log parsing in production)
async function extractToolUsage(sessionId) {
  // In a real implementation, this would parse Langfuse logs or server logs
  return {
    tools: ['lookupCustomerFromDatabase', 'directRepairHistory'], // placeholder
    logs: [{
      timestamp: new Date().toISOString(),
      tool: 'lookupCustomerFromDatabase',
      agent: 'customer-identification',
      success: true,
      sessionId: sessionId
    }]
  };
}

// Run the tests
testAllPrompts().then(report => {
  console.log('Test suite completed!');
  console.log(`Results: ${report.summary.successfulTests}/${report.summary.totalTests} tests passed`);
}).catch(console.error);
