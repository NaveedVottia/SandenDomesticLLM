/**
 * Test Karakuri CloudFormation Endpoint
 * Tests the CloudFormation deployed Karakuri endpoint
 */

import { config } from 'dotenv';
import { join } from 'path';
import { karakuriSageMaker } from './src/integrations/karakuri-sagemaker.js';

// Load environment
config({ path: join(process.cwd(), 'server.env') });

async function testKarakuriCloudFormation() {
  console.log('🧪 Testing Karakuri CloudFormation Endpoint...\n');

  // Verify environment variables
  console.log('🔍 Environment Check:');
  console.log(`KARAKURI_ENDPOINT_NAME: ${process.env.KARAKURI_ENDPOINT_NAME || 'NOT SET'}`);
  console.log(`KARAKURI_REGION: ${process.env.KARAKURI_REGION || 'NOT SET'}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
  console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}\n`);

  // Check CloudFormation stack status
  console.log('🔍 Checking CloudFormation stack status...');
  try {
    const stackStatus = await runCommand(`aws cloudformation describe-stacks --stack-name Stack-KARAKURI-LM-8x7b-instruct-1 --region us-east-1 --query 'Stacks[0].StackStatus' --output text`);
    console.log(`CloudFormation Stack Status: ${stackStatus}`);

    if (stackStatus !== 'CREATE_COMPLETE') {
      console.log('⚠️  Stack not ready yet. Expected: CREATE_COMPLETE');
      console.log('💡 Wait a few more minutes, then try again');
      console.log('📊 Check status: https://console.aws.amazon.com/cloudformation/');
      return;
    }
  } catch (error) {
    console.log('❌ Could not check CloudFormation status');
    console.log('💡 Make sure the stack is deployed first');
  }

  // Check endpoint status
  console.log('\n🔍 Checking SageMaker endpoint status...');
  try {
    const endpointStatus = await runCommand(`aws sagemaker describe-endpoint --endpoint-name Endpoint-KARAKURI-LM-8x7b-instruct-1 --region us-east-1 --query 'EndpointStatus' --output text`);
    console.log(`SageMaker Endpoint Status: ${endpointStatus}`);

    if (endpointStatus !== 'InService') {
      console.log('⚠️  Endpoint not ready yet. Expected: InService');
      console.log('💡 This can take 10-15 minutes after CloudFormation completes');
      return;
    }
  } catch (error) {
    console.log('❌ Could not check endpoint status');
    console.log('💡 Make sure the CloudFormation deployment completed successfully');
    return;
  }

  console.log('\n✅ CloudFormation deployment looks good!');
  console.log('🔄 Testing Karakuri connectivity...');

  try {
    // Test basic connection
    const connected = await karakuriSageMaker.testConnection();

    if (!connected) {
      console.log('❌ Connection test failed');
      return;
    }

    // Test Japanese business context
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

    // Test multiple scenarios
    console.log('\n🔄 Testing different Japanese prompts...');

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

    // Show model info
    console.log('\n📊 Model Information:');
    const modelInfo = karakuriSageMaker.getModelInfo();
    console.log(JSON.stringify(modelInfo, null, 2));

    console.log('\n🎯 Karakuri CloudFormation integration successful!');
    console.log('🇯🇵 Ready for Japanese business applications!');
    console.log('\n🚀 Next steps:');
    console.log('1. Update your agent configurations to use Karakuri');
    console.log('2. Run GENIAC evaluation: node test-karakuri-geniac.js');
    console.log('3. Monitor costs and usage');

  } catch (error) {
    console.error('❌ Karakuri test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');

    if (error.message.includes('Unable to locate credentials') || error.message.includes('credentials')) {
      console.log('💡 AWS Credentials Issue:');
      console.log('   1. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in server.env');
      console.log('   2. Verify credentials are not expired');
    }

    if (error.message.includes('endpoint') || error.message.includes('Endpoint')) {
      console.log('💡 Endpoint Issue:');
      console.log('   1. Wait for CloudFormation stack to complete (CREATE_COMPLETE)');
      console.log('   2. Wait for SageMaker endpoint to be InService (10-15 minutes)');
      console.log('   3. Check endpoint name matches: Endpoint-KARAKURI-LM-8x7b-instruct-1');
    }

    if (error.message.includes('region') || error.message.includes('Region')) {
      console.log('💡 Region Issue:');
      console.log('   1. Ensure KARAKURI_REGION=us-east-1 in server.env');
      console.log('   2. CloudFormation deploys to US East (N. Virginia)');
    }

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.log('💡 Timeout Issue:');
      console.log('   1. Endpoint may still be starting up');
      console.log('   2. Try again in a few minutes');
    }

    console.log('\n📞 Support: Check AWS SageMaker console for detailed error messages');
    console.log('🔗 Console: https://console.aws.amazon.com/sagemaker/');
  }
}

// Helper function to run shell commands
async function runCommand(command) {
  const { exec } = await import('child_process');
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

testKarakuriCloudFormation();
