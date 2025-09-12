#!/usr/bin/env node

// Simple manual test script to verify all models are working
console.log('🚀 Manual Model Connection Test');
console.log('================================');

const models = ['karakuri', 'tsuzumi', 'plamo', 'nova_micro', 'nova_pro', 'claude_sonnet'];

console.log('\n📋 Testing Model Connections:');
console.log('Server URL: http://localhost');
console.log('Available models:', models.join(', '));

console.log('\n🔧 Manual Test Commands:');
console.log('Run these commands to test each model:');

models.forEach((model, index) => {
  console.log(`\n--- Test ${index + 1}: ${model} ---`);
  console.log(`curl -X POST http://localhost/api/test/stream \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"messages":[{"role":"user","content":"こんにちは"}],"model":"${model}"}' \\`);
  console.log(`  --max-time 30`);
});

console.log('\n📊 Expected Results:');
console.log('- All models should return streaming responses');
console.log('- Response format: f:{"messageId":"..."} followed by 0:"content"');
console.log('- Each model should respond in Japanese');

console.log('\n🔍 Connection Status Check:');
console.log('curl -s http://localhost/api/models | jq .');

console.log('\n📝 Full E2E Test Commands:');
console.log('For complete conversation testing, run these sequences:');

const testSteps = [
  'こんにちは、修理のご相談をしたいのですが。',
  '会社名: セブンイレブン 秋葉原店\nメールアドレス: support@7aki.jp\n電話番号: 03-3322-4455',
  '修理履歴を確認したいのですが、過去の修理記録を教えてください。',
  '9月18日の午後6時に訪問修理をお願いします。自販機が故障していてメンテナンスが必要です。',
  '予約を確定してください。',
  'ログシートに記録が追加されたか確認してください。'
];

models.forEach(model => {
  console.log(`\n--- Full E2E Test for ${model} ---`);
  testSteps.forEach((step, index) => {
    console.log(`# Step ${index + 1}:`);
    console.log(`curl -X POST http://localhost/api/test/stream \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"messages":[{"role":"user","content":"${step}"}],"model":"${model}"}' \\`);
    console.log(`  --max-time 30`);
    console.log('');
  });
});

console.log('\n✅ Ready to test!');
console.log('Run the commands above to verify all model connections.');
