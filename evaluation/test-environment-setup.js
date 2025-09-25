#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

console.log('🚀 Setting up Agent Test Environment...\n');

// Environment checks
console.log('📋 Environment Checks:');
console.log('✅ Node.js version:', process.version);
console.log('✅ Platform:', process.platform);
console.log('✅ Architecture:', process.arch);

// Check if server.env exists
if (!existsSync('server.env')) {
  console.log('❌ server.env not found! Please copy from server.env.template');
  process.exit(1);
}
console.log('✅ server.env found');

// Check package.json
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  console.log('✅ package.json valid');
  console.log('📦 Dependencies:', Object.keys(pkg.dependencies || {}).length);
} catch (e) {
  console.log('❌ package.json invalid');
  process.exit(1);
}

// Check dist folder
if (!existsSync('dist')) {
  console.log('❌ dist folder not found! Run "npm run build" first');
  process.exit(1);
}
console.log('✅ Built files found');

// Create test reports directory
if (!existsSync('test-reports')) {
  mkdirSync('test-reports');
  console.log('📁 Created test-reports directory');
}

// Create test data directory
if (!existsSync('test-data')) {
  mkdirSync('test-data');
  console.log('📁 Created test-data directory');
}

// Generate test data if not exists
const testDataPath = 'test-data/customers.json';
if (!existsSync(testDataPath)) {
  const testCustomers = [
    {
      id: 'CUST001',
      name: '株式会社セブンイレブン',
      store: '渋谷店',
      email: 'suzuki@seven-eleven.co.jp',
      phone: '03-1234-5678',
      location: '東京都渋谷区'
    },
    {
      id: 'CUST002',
      name: 'ローソン',
      store: '秋葉原店',
      email: 'tanaka@lawson.co.jp',
      phone: '06-9876-5432',
      location: '東京都千代田区'
    },
    {
      id: 'CUST999',
      name: 'テスト顧客',
      store: 'テスト店',
      email: 'test@example.com',
      phone: '00-0000-0000',
      location: 'テスト県'
    }
  ];

  writeFileSync(testDataPath, JSON.stringify(testCustomers, null, 2));
  console.log('📝 Generated test customer data');
}

// Test server health
console.log('\n🔍 Testing Server Health...');
try {
  const healthCheck = execSync('curl -s http://localhost/api/health', { timeout: 5000 });
  if (healthCheck.toString().includes('ok')) {
    console.log('✅ Server is healthy');
  } else {
    console.log('⚠️  Server response unclear');
  }
} catch (e) {
  console.log('❌ Server not responding (expected if not running)');
}

// Test database connection
console.log('\n🗄️  Testing Database Connection...');
try {
  // Check if mastra.db exists
  if (existsSync('mastra.db')) {
    console.log('✅ Database file exists');
    // Could add more sophisticated checks here
  } else {
    console.log('⚠️  Database file not found');
  }
} catch (e) {
  console.log('❌ Database connection test failed');
}

// Test Langfuse integration
console.log('\n🔗 Testing Langfuse Integration...');
try {
  const langfuseConfig = readFileSync('server.env', 'utf8');
  if (langfuseConfig.includes('LANGFUSE_')) {
    console.log('✅ Langfuse configuration found');
  } else {
    console.log('⚠️  Langfuse configuration not found');
  }
} catch (e) {
  console.log('❌ Langfuse integration test failed');
}

// Test Zapier integration
console.log('\n⚡ Testing Zapier Integration...');
try {
  const zapierConfig = readFileSync('server.env', 'utf8');
  if (zapierConfig.includes('ZAPIER_')) {
    console.log('✅ Zapier configuration found');
  } else {
    console.log('⚠️  Zapier configuration not found');
  }
} catch (e) {
  console.log('❌ Zapier integration test failed');
}

// Generate test environment report
const report = {
  timestamp: new Date().toISOString(),
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd()
  },
  checks: {
    serverEnv: existsSync('server.env'),
    packageJson: existsSync('package.json'),
    distFolder: existsSync('dist'),
    testReports: existsSync('test-reports'),
    testData: existsSync('test-data'),
    database: existsSync('mastra.db'),
    langfuseConfigured: readFileSync('server.env', 'utf8').includes('LANGFUSE_'),
    zapierConfigured: readFileSync('server.env', 'utf8').includes('ZAPIER_')
  },
  agents: [
    'customer-identification',
    'repair-scheduling',
    'issue-analysis',
    'product-selection',
    'visit-confirmation'
  ],
  tools: [
    'lookupCustomerFromDatabase',
    'directRepairHistory',
    'hybridGetRepairsByCustomerIdTool',
    'hybridGetProductsByCustomerIdTool',
    'delegateTo',
    'searchFAQDatabase',
    'fuzzySearchCustomers',
    'getCustomerDetails',
    'logCustomerData'
  ]
};

writeFileSync('test-reports/environment-check.json', JSON.stringify(report, null, 2));
console.log('📊 Environment check report saved to test-reports/environment-check.json');

console.log('\n🎯 Test Environment Setup Complete!');
console.log('\n📋 Available Test Commands:');
console.log('  npm run test:all-prompts     - Run comprehensive prompt tests');
console.log('  npm run test:repair-scheduling - Test repair scheduling agent');
console.log('  npm run test:customer-id       - Test customer identification');
console.log('  npm run test:delegation        - Test agent delegation');
console.log('  npm run test:performance       - Run performance benchmarks');

console.log('\n📁 Test Data Locations:');
console.log('  test-reports/                 - Test result reports');
console.log('  test-data/                    - Test data files');
console.log('  logs/                        - Application logs');

console.log('\n🔗 URLs:');
console.log('  Langfuse: https://langfuse.demo.dev-maestra.vottia.me');
console.log('  UI: https://demo.dev-maestra.vottia.me/sanden/');
console.log('  API: http://localhost/api/agents/customer-identification/test');

console.log('\n✨ Ready to run agent tests!');
