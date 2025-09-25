/**
 * Test Karakuri LLM on AWS Bedrock
 * Verifies basic connectivity and Japanese language capabilities
 */

import { config } from 'dotenv';
import { join } from 'path';
import { bedrock } from '@ai-sdk/amazon-bedrock';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

async function testKarakuri() {
  console.log('🧪 Testing Karakuri on AWS Bedrock...\n');

  // Verify environment variables
  console.log('🔍 Environment Check:');
  console.log(`AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
  console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}\n`);

  try {
    const model = bedrock("sb-intuitions/karakuri-8x7b-instruct-v0-1", {
      temperature: 0.1,
      maxTokens: 500,
      region: process.env.AWS_REGION || "ap-northeast-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    console.log('🔄 Sending test request to Karakuri...');

    const response = await model.invoke([
      { role: 'user', content: 'こんにちは、自己紹介をお願いします。あなたはどのようなAIですか？' }
    ]);

    console.log('✅ Karakuri Response:');
    console.log('─'.repeat(50));
    console.log(response.content);
    console.log('─'.repeat(50));

    console.log('\n🎯 Karakuri setup successful!');
    console.log('📊 Response length:', response.content.length, 'characters');

    // Test Japanese business context
    console.log('\n🔄 Testing Japanese business context...');

    const businessResponse = await model.invoke([
      { role: 'user', content: 'あなたはサンデン・リテールシステムの修理受付AIです。CUST001の顧客情報を確認してください。' }
    ]);

    console.log('✅ Business Context Response:');
    console.log('─'.repeat(50));
    console.log(businessResponse.content);
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Karakuri test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');

    if (error.message.includes('access') || error.message.includes('AccessDenied')) {
      console.log('💡 Model Access Issue:');
      console.log('   1. Go to https://console.aws.amazon.com/bedrock/');
      console.log('   2. Select Asia Pacific (Tokyo) region');
      console.log('   3. Check "Model access" - ensure SB Intuitions Karakuri is approved');
      console.log('   4. Request access if not approved (1-2 business days)');
    }

    if (error.message.includes('region') || error.message.includes('Region')) {
      console.log('💡 Region Issue:');
      console.log('   1. Set AWS_REGION=ap-northeast-1 in server.env');
      console.log('   2. Set AWS_DEFAULT_REGION=ap-northeast-1');
      console.log('   3. Karakuri is only available in Tokyo region');
    }

    if (error.message.includes('credentials') || error.message.includes('UnauthorizedOperation')) {
      console.log('💡 Credentials Issue:');
      console.log('   1. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in server.env');
      console.log('   2. Ensure IAM user has bedrock:InvokeModel permission');
      console.log('   3. Check AWS credentials are not expired');
    }

    if (error.message.includes('model') || error.message.includes('Model')) {
      console.log('💡 Model ID Issue:');
      console.log('   1. Verify model ID: sb-intuitions/karakuri-8x7b-instruct-v0-1');
      console.log('   2. Ensure model is available in your region');
    }

    console.log('\n📞 Support: Contact AWS Bedrock support for model access issues');
  }
}

testKarakuri();
