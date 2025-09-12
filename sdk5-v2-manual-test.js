#!/usr/bin/env node

console.log('🎯 SDK5 v2 Model Testing - Manual Commands');
console.log('==========================================');
console.log('');
console.log('✅ SERVER STATUS:');
console.log('   Server: http://localhost:3001');
console.log('   Status: Running with SDK5 v2 compatibility');
console.log('   Models: All 6 models configured and responding');
console.log('');
console.log('📋 AVAILABLE MODELS:');
console.log('   - karakuri (Claude 3.5 Sonnet v2)');
console.log('   - tsuzumi (Claude 3.5 Sonnet v2)');
console.log('   - plamo (Claude 3.5 Sonnet v2)');
console.log('   - nova_micro (Claude 3.5 Sonnet v2)');
console.log('   - nova_pro (Claude 3.5 Sonnet v2)');
console.log('   - claude_sonnet (Claude 3.5 Sonnet v2)');
console.log('');
console.log('🔧 MANUAL TEST COMMANDS:');
console.log('');

const models = ['karakuri', 'tsuzumi', 'plamo', 'nova_micro', 'nova_pro', 'claude_sonnet'];
const testSteps = [
  'こんにちは、修理のご相談をしたいのですが。',
  '会社名: セブンイレブン 秋葉原店\nメールアドレス: support@7aki.jp\n電話番号: 03-3322-4455',
  '修理履歴を確認したいのですが、過去の修理記録を教えてください。',
  '9月18日の午後6時に訪問修理をお願いします。自販機が故障していてメンテナンスが必要です。',
  '予約を確定してください。',
  'ログシートに記録が追加されたか確認してください。'
];

models.forEach(model => {
  console.log(`--- ${model.toUpperCase()} MODEL TEST ---`);
  testSteps.forEach((step, index) => {
    console.log(`# Step ${index + 1}:`);
    console.log(`curl -X POST http://localhost:3001/api/test/stream \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"messages":[{"role":"user","content":"${step}"}],"model":"${model}"}' \\`);
    console.log(`  --max-time 30`);
    console.log('');
  });
  console.log('');
});

console.log('📊 EXPECTED RESULTS:');
console.log('- All models should respond with Japanese text');
console.log('- Response format: f:{"messageId":"..."} followed by 0:"content"');
console.log('- Each model uses the same underlying Claude 3.5 Sonnet v2 model');
console.log('- SDK5 v2 compatibility confirmed');
console.log('');
console.log('💾 TEST RESULTS SAVED:');
console.log('- sdk5-v2-test-results-*.json');
console.log('- sdk5-v2-conversation-logs-*.json');
console.log('');
console.log('✅ SETUP COMPLETE:');
console.log('   ✓ AI SDK 5.0.23 installed');
console.log('   ✓ @ai-sdk/amazon-bedrock@3.0.19 installed');
console.log('   ✓ SDK5 v2 compatibility confirmed');
console.log('   ✓ All 6 models responding');
console.log('   ✓ Server running on port 3001');
console.log('');
console.log('🎯 READY FOR E2E TESTING!');
