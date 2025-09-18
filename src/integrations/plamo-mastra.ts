// Plamo Model Integration for Mastra with Langfuse
// Provides streaming responses compatible with Mastra frontend using Langfuse prompts

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { langfuse } from './langfuse.js';

interface PlamoResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class PlamoMastraProvider {
  private modelName: string;
  private isStreaming: boolean;

  constructor() {
    this.modelName = 'plamo';
    this.isStreaming = false;
  }

  // Get Langfuse prompt for Plamo
  private async getPlamoPrompt(promptName: string, context: any = {}) {
    try {
      console.log(`📝 Fetching Langfuse prompt: ${promptName}`);
      const promptText = await langfuse.getPromptText(promptName, "production");
      
      if (!promptText) {
        throw new Error(`Prompt '${promptName}' not found in Langfuse`);
      }

      // Format the prompt with context
      const formattedPrompt = promptText
        .replace(/\{customerId\}/g, context.customerId || '')
        .replace(/\{sessionId\}/g, context.sessionId || '')
        .replace(/\{message\}/g, context.message || '')
        .replace(/\{context\}/g, JSON.stringify(context, null, 2));

      console.log(`✅ Langfuse prompt loaded: ${promptName}`);
      return formattedPrompt;
    } catch (error) {
      console.error(`❌ Error fetching Langfuse prompt '${promptName}':`, error);
      throw error; // No fallback - Langfuse only
    }
  }

  // Generate streaming response compatible with Mastra using Langfuse
  async generateStream(messages: any[], options: any = {}) {
    const stream = new EventEmitter();
    
    try {
      // Extract the last user message
      const lastMessage = messages[messages.length - 1];
      const userInput = lastMessage.content || lastMessage.text || "";
      
      console.log(`🤖 Plamo generating response for: ${userInput.substring(0, 50)}...`);
      
      // Determine which Langfuse prompt to use based on context
      let promptName = 'Domestic-customer-identification'; // Default
      
      // Check message content to determine appropriate prompt
      if (userInput.includes('修理') || userInput.includes('故障') || userInput.includes('問題')) {
        promptName = 'Domestic-repair-agent';
      } else if (userInput.includes('予約') || userInput.includes('訪問') || userInput.includes('スケジュール')) {
        promptName = 'Domestic-repair-scheduling';
      } else if (userInput.includes('履歴') || userInput.includes('過去') || userInput.includes('記録')) {
        promptName = 'Domestic-repair-history-ticket';
      }
      
      // Get context from options
      const context = {
        message: userInput,
        customerId: options.customerId,
        sessionId: options.sessionId,
        ...options.context
      };
      
      // Get formatted prompt from Langfuse
      const formattedPrompt = await this.getPlamoPrompt(promptName, context);
      
      const ollama = spawn('ollama', ['run', this.modelName, formattedPrompt]);
      
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
              promptTokens: formattedPrompt.length,
              completionTokens: fullResponse.length,
              totalTokens: formattedPrompt.length + fullResponse.length
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

  // Generate non-streaming response using Langfuse
  async generate(messages: any[], options: any = {}): Promise<PlamoResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        // Extract the last user message
        const lastMessage = messages[messages.length - 1];
        const userInput = lastMessage.content || lastMessage.text || "";
        
        // Determine which Langfuse prompt to use
        let promptName = 'Domestic-customer-identification'; // Default
        
        if (userInput.includes('修理') || userInput.includes('故障') || userInput.includes('問題')) {
          promptName = 'Domestic-repair-agent';
        } else if (userInput.includes('予約') || userInput.includes('訪問') || userInput.includes('スケジュール')) {
          promptName = 'Domestic-repair-scheduling';
        } else if (userInput.includes('履歴') || userInput.includes('過去') || userInput.includes('記録')) {
          promptName = 'Domestic-repair-history-ticket';
        }
        
        // Get context from options
        const context = {
          message: userInput,
          customerId: options.customerId,
          sessionId: options.sessionId,
          ...options.context
        };
        
        // Get formatted prompt from Langfuse
        const formattedPrompt = await this.getPlamoPrompt(promptName, context);
        
        const ollama = spawn('ollama', ['run', this.modelName, formattedPrompt]);
        
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
                promptTokens: formattedPrompt.length,
                completionTokens: output.length,
                totalTokens: formattedPrompt.length + output.length
              }
            });
          } else {
            reject(new Error(error || 'Plamo process failed'));
          }
        });
        
        ollama.on('error', (err) => {
          reject(err);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Health check
  async healthCheck() {
    try {
      const testMessages = [{ role: 'user', content: 'こんにちは' }];
      const response = await this.generate(testMessages);
      return {
        status: 'healthy',
        model: this.modelName,
        response: response.text.substring(0, 50) + '...',
        langfuse: 'connected'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        model: this.modelName,
        error: error instanceof Error ? error.message : 'Unknown error',
        langfuse: 'error'
      };
    }
  }
}

// Export singleton instance
export const plamoProvider = new PlamoMastraProvider();
