#!/usr/bin/env node

import { config } from 'dotenv';
import { searchFAQDatabase } from './dist/mastra/tools/sanden/common-tools.js';

// Load environment variables
config({ path: './server.env' });

async function testFAQSearch() {
  console.log('🧪 Testing FAQ search functionality...\n');

  const testQueries = [
    'usb',
    'USB',
    'エラー90',
    'error90',
    '冷却異常',
    '温度設定'
  ];

  for (const query of testQueries) {
    try {
      console.log(`📥 Testing query: "${query}"`);
      const result = await searchFAQDatabase.execute({ context: { keywords: query } });
      
      console.log(`✅ Query "${query}": ${result.success ? 'Success' : 'Failed'}`);
      console.log(`📝 Message: ${result.message}`);
      
      if (result.data && result.data.length > 0) {
        console.log(`📋 Found ${result.data.length} result(s):`);
        result.data.forEach((faq, index) => {
          console.log(`   ${index + 1}. Q: ${faq.question}`);
          console.log(`      A: ${faq.answer.substring(0, 100)}...`);
          console.log(`      URL: ${faq.url}`);
        });
      } else {
        console.log(`❌ No results found`);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ Query "${query}": Error - ${error.message}`);
      console.log('');
    }
  }

  console.log('🎉 FAQ search testing complete!');
}

// Run the test
testFAQSearch().catch(console.error);
