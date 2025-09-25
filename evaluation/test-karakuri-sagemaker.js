/**
 * Test Karakuri on AWS SageMaker
 * Verifies connectivity and Japanese language capabilities
 */

import { config } from 'dotenv';
import { join } from 'path';
import { KarakuriSageMakerIntegration } from './dist/integrations/karakuri-sagemaker.js';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

const karakuriSageMaker = new KarakuriSageMakerIntegration();

async function testKarakuriSageMaker() {
  console.log('🧪 Testing Karakuri on AWS SageMaker...\n');

  // Verify environment variables
  console.log('🔍 Environment Check:');
  console.log(`KARAKURI_ENDPOINT_NAME: ${process.env.KARAKURI_ENDPOINT_NAME || 'NOT SET'}`);
  console.log(`KARAKURI_REGION: ${process.env.KARAKURI_REGION || 'NOT SET'}`);
  console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}\n`);

  try {
    console.log('🔄 Testing connection...');
    const connected = await karakuriSageMaker.testConnection();

    if (!connected) {
      console.log('❌ Connection test failed');
      process.exit(1);
    }

    console.log('\n🔄 Testing Japanese business context...');
    const businessResponse = await karakuriSageMaker.invoke(
      "あなたはサンデン・リテールシステムの修理受付AIです。CUST001の顧客情報を確認してください。",
      { maxTokens: 200, temperature: 0.1 }
    );

    console.log('✅ Business Context Response:');
    console.log('─'.repeat(50));
    console.log(businessResponse);
    console.log('─'.repeat(50));
    console.log(`📊 Response length: ${businessResponse.length} characters`);

    console.log('\n🔄 Testing different prompt types...');

    // Test various Japanese prompts
    const testPrompts = [
      {
        name: "Customer ID Lookup",
        prompt: "CUST001 の修理履歴を表示してください。",
        expected: "Customer lookup pattern recognition"
      },
      {
        name: "Email Lookup",
        prompt: "suzuki@seven-eleven.co.jp の保証情報を教えてください。",
        expected: "Email-based customer lookup"
      },
      {
        name: "Repair Request",
        prompt: "エアコンが故障しました。修理をお願いします。",
        expected: "Repair scheduling request"
      },
      {
        name: "Formal Business",
        prompt: "弊社の自動販売機保守契約についてご相談させていただきたいのですが。",
        expected: "Formal business Japanese"
      }
    ];

    for (const test of testPrompts) {
      console.log(`\n📋 Testing: ${test.name}`);
      console.log(`💬 Prompt: "${test.prompt}"`);
      console.log(`🎯 Expected: ${test.expected}`);

      try {
        const response = await karakuriSageMaker.invoke(test.prompt, {
          maxTokens: 150,
          temperature: 0.1
        });

        console.log('✅ Response preview:', response.substring(0, 100), '...');
        console.log(`📏 Length: ${response.length} characters`);

      } catch (error) {
        console.error(`❌ Test failed:`, error.message);
      }
    }

    // Test model info
    console.log('\n📊 Model Information:');
    const modelInfo = karakuriSageMaker.getModelInfo();
    console.log(JSON.stringify(modelInfo, null, 2));

    console.log('\n🎯 Karakuri SageMaker integration successful!');
    console.log('🇯🇵 Ready for Japanese business applications!');

  } catch (error) {
    console.error('❌ Karakuri test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');

    if (error.message.includes('Unable to locate credentials') || error.message.includes('credentials')) {
      console.log('💡 AWS Credentials Issue:');
      console.log('   1. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in server.env');
      console.log('   2. Verify credentials are not expired');
      console.log('   3. Run aws configure if needed');
    }

    if (error.message.includes('endpoint') || error.message.includes('Endpoint')) {
      console.log('💡 Endpoint Issue:');
      console.log('   1. Check KARAKURI_ENDPOINT_NAME in server.env');
      console.log('   2. Verify endpoint exists: aws sagemaker describe-endpoint --endpoint-name YOUR_ENDPOINT');
      console.log('   3. Ensure endpoint status is "InService"');
    }

    if (error.message.includes('region') || error.message.includes('Region')) {
      console.log('💡 Region Issue:');
      console.log('   1. Check KARAKURI_REGION in server.env');
      console.log('   2. Karakuri must be in ap-northeast-1 (Tokyo)');
    }

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.log('💡 Timeout Issue:');
      console.log('   1. Endpoint may be starting up (takes 5-10 minutes)');
      console.log('   2. Check endpoint status in SageMaker console');
    }

    if (error.message.includes('permission') || error.message.includes('Unauthorized')) {
      console.log('💡 Permissions Issue:');
      console.log('   1. Verify IAM role has sagemaker:InvokeEndpoint permission');
      console.log('   2. Check AWS credentials have access to the endpoint');
    }

    console.log('\n📞 Support: Check AWS SageMaker console for detailed error messages');
    process.exit(1);
  }
}

testKarakuriSageMaker();
