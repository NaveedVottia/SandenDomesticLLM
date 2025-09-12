#!/usr/bin/env node

// Simple E2E Test Script for Model Comparison
// This script demonstrates the complete flow for testing different models

console.log('🚀 E2E Model Comparison Test Script');
console.log('=====================================');

console.log('\n📋 Test Scenario:');
console.log('1. User says hello');
console.log('2. Enters login details: セブンイレブン 秋葉原店, support@7aki.jp, 03-3322-4455');
console.log('3. Requests repair history');
console.log('4. Confirms data accuracy against database.txt');
console.log('5. Makes booking for September 18th, 6pm');
console.log('6. Confirms booking');
console.log('7. Verifies LOGS sheet entry');

console.log('\n🤖 Models to Test:');
console.log('- nova_micro (Nova Micro - cheapest)');
console.log('- nova_pro (Nova Pro - higher quality)');
console.log('- claude_sonnet (Claude 3.5 Sonnet v2 - premium)');

console.log('\n📊 Expected Database Data for CUST004/PROD004:');
console.log('REP102: 2025-08-03, コインが詰まる, 未対応');
console.log('REP104: 2025-08-05, コインが詰まる, 解決済み');
console.log('REP108: 2025-08-09, 画面が表示されない, 対応中');
console.log('REP116: 2025-08-17, 水漏れがある, 解決済み');
console.log('REP118: 2025-08-19, 冷却が機能しない, 未対応');

console.log('\n🔧 Manual Test Commands:');
console.log('Run these commands in sequence for each model:');

const models = ['nova_micro', 'nova_pro', 'claude_sonnet'];
const testMessages = [
  'こんにちは、修理のご相談をしたいのですが。',
  '会社名: セブンイレブン 秋葉原店\nメールアドレス: support@7aki.jp\n電話番号: 03-3322-4455',
  '修理履歴を確認したいのですが、過去の修理記録を教えてください。',
  '9月18日の午後6時に訪問修理をお願いします。自販機が故障していてメンテナンスが必要です。',
  '予約を確定してください。',
  'ログシートに記録が追加されたか確認してください。'
];

models.forEach((model, modelIndex) => {
  console.log(`\n--- Testing ${model} ---`);
  testMessages.forEach((message, msgIndex) => {
    console.log(`curl -X POST http://localhost:3000/api/test/stream \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"messages":[{"role":"user","content":"${message}"}],"model":"${model}"}' \\`);
    console.log(`  --max-time 30`);
    console.log('');
  });
});

console.log('\n📈 Evaluation Criteria:');
console.log('1. Response Time: How quickly each model responds');
console.log('2. Data Accuracy: Correct repair history retrieval');
console.log('3. Japanese Language Quality: Natural conversation flow');
console.log('4. Booking Accuracy: Proper appointment scheduling');
console.log('5. Error Handling: Graceful handling of edge cases');

console.log('\n🔍 Zapier Integration Points:');
console.log('- After login details: Wait 5 seconds for customer lookup');
console.log('- After repair request: Wait 5 seconds for database query');
console.log('- After booking request: Wait 5 seconds for calendar integration');
console.log('- After confirmation: Wait 5 seconds for LOGS sheet update');

console.log('\n📝 Expected Results:');
console.log('- All models should retrieve correct repair history for CUST004');
console.log('- All models should handle Japanese text properly');
console.log('- All models should create proper booking entries');
console.log('- All models should confirm LOGS sheet updates');

console.log('\n✅ Success Criteria:');
console.log('- Complete conversation flow without errors');
console.log('- Accurate data retrieval from database.txt');
console.log('- Proper booking confirmation');
console.log('- LOGS sheet entry verification');

console.log('\n🚀 Ready to start testing!');
console.log('Run the curl commands above for each model to compare performance.');
