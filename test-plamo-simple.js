#!/usr/bin/env node
/**
 * Test Plamo Mastra Integration
 */

import { spawn } from 'child_process';

class PlamoTest {
  constructor() {
    this.modelName = 'plamo';
  }

  async testHealth() {
    try {
      console.log('🔍 Testing Plamo health...');
      
      const ollama = spawn('ollama', ['run', this.modelName, 'こんにちは']);
      
      let output = '';
      let error = '';
      
      ollama.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ollama.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      return new Promise((resolve, reject) => {
        ollama.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Plamo is healthy!');
            console.log('📝 Response:', output.trim().substring(0, 100) + '...');
            resolve({ status: 'healthy', response: output.trim() });
          } else {
            console.log('❌ Plamo health check failed:', error);
            reject(new Error(error || 'Plamo process failed'));
          }
        });
        
        ollama.on('error', (err) => {
          console.log('❌ Plamo error:', err);
          reject(err);
        });
      });
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
}

async function main() {
  const test = new PlamoTest();
  try {
    await test.testHealth();
    console.log('\n🎉 Plamo integration is ready!');
    console.log('\n📡 Backend URL for Mastra f0ed streaming:');
    console.log('POST http://localhost:3000/api/plamo/chat/completions');
    console.log('\n📋 Example request:');
    console.log('curl -X POST "http://localhost:3000/api/plamo/chat/completions" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"messages": [{"role": "user", "content": "こんにちは"}], "stream": true}\'');
  } catch (error) {
    console.error('❌ Plamo test failed:', error);
  }
}

main();
