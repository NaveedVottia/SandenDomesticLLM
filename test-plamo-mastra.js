#!/usr/bin/env node
/**
 * Plamo Mastra Integration Test
 * Tests the Plamo model with Mastra-compatible streaming
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

class PlamoMastraProvider {
  constructor() {
    this.modelName = 'plamo';
    this.isStreaming = false;
  }

  // Generate streaming response compatible with Mastra
  async generateStream(prompt, options = {}) {
    const stream = new EventEmitter();
    
    try {
      console.log(`🤖 Plamo generating response for: ${prompt.substring(0, 50)}...`);
      
      const ollama = spawn('ollama', ['run', this.modelName, prompt]);
      
      let fullResponse = '';
      let isFirstChunk = true;
      
      ollama.stdout.on('data', (data) => {
        const chunk = data.toString().trim();
        if (chunk) {
          fullResponse += chunk;
          
          // Emit Mastra-compatible streaming format
          const streamChunk = {
            type: 'text-delta',
            textDelta: chunk,
            finishReason: null
          };
          
          stream.emit('data', streamChunk);
          
          if (isFirstChunk) {
            isFirstChunk = false;
          }
        }
      });
      
      ollama.stderr.on('data', (data) => {
        console.error('Plamo stderr:', data.toString());
      });
      
      ollama.on('close', (code) => {
        if (code === 0) {
          // Emit final chunk
          const finalChunk = {
            type: 'text-delta',
            textDelta: '',
            finishReason: 'stop'
          };
          
          stream.emit('data', finalChunk);
          stream.emit('end', {
            text: fullResponse,
            usage: {
              promptTokens: prompt.length,
              completionTokens: fullResponse.length,
              totalTokens: prompt.length + fullResponse.length
            }
          });
        } else {
          stream.emit('error', new Error(`Plamo process failed with code ${code}`));
        }
      });
      
      ollama.on('error', (err) => {
        stream.emit('error', err);
      });
      
    } catch (error) {
      stream.emit('error', error);
    }
    
    return stream;
  }

  // Generate non-streaming response
  async generate(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const ollama = spawn('ollama', ['run', this.modelName, prompt]);
      
      let output = '';
      let error = '';
      
      ollama.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ollama.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      ollama.on('close', (code) => {
        if (code === 0) {
          resolve({
            text: output.trim(),
            usage: {
              promptTokens: prompt.length,
              completionTokens: output.length,
              totalTokens: prompt.length + output.length
            }
          });
        } else {
          reject(new Error(error || 'Plamo process failed'));
        }
      });
      
      ollama.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.generate("こんにちは");
      return {
        status: 'healthy',
        model: this.modelName,
        response: response.text.substring(0, 50) + '...'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        model: this.modelName,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

async function testPlamoMastraIntegration() {
  console.log('🔧 Testing Plamo Mastra Integration...\n');

  const plamoProvider = new PlamoMastraProvider();

  try {
    // Test health check
    console.log('1. Testing health check...');
    const health = await plamoProvider.healthCheck();
    console.log('✅ Health check result:', health);

    // Test non-streaming generation
    console.log('\n2. Testing non-streaming generation...');
    const response = await plamoProvider.generate("こんにちは、エアコンの修理について相談したいです。");
    console.log('✅ Non-streaming response:', response.text);

    // Test streaming generation
    console.log('\n3. Testing streaming generation...');
    const stream = await plamoProvider.generateStream("冷蔵庫が冷えないのですが、どうすればいいでしょうか？");
    
    let streamedText = '';
    stream.on('data', (chunk) => {
      if (chunk.textDelta) {
        streamedText += chunk.textDelta;
        process.stdout.write(chunk.textDelta);
      }
    });

    stream.on('end', (result) => {
      console.log('\n✅ Streaming completed!');
      console.log('📊 Final result:', result);
    });

    stream.on('error', (error) => {
      console.error('❌ Streaming error:', error);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPlamoMastraIntegration().catch(console.error);
