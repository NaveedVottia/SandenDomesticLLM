/**
 * Claude Anthropic Direct API Integration
 * Provides interface to Claude 3.5 Sonnet via direct Anthropic API (faster than AWS Bedrock)
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeAnthropicIntegration {
  private client: Anthropic;
  private modelId: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey: apiKey,
    });

    this.modelId = 'claude-3-5-sonnet-20241022';
  }

  async invoke(prompt: string, options: any = {}): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: this.modelId,
        max_tokens: 2000,
        temperature: 0.1,
        system: `You are a Sanden Corporation repair system customer support assistant. You must be extremely precise with business facts and follow workflow steps exactly.`,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      if (message.content && message.content.length > 0 && message.content[0].type === 'text') {
        return message.content[0].text;
      }

      throw new Error("No text content in Claude response");
    } catch (error) {
      console.error("Claude Anthropic API failed:", error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.invoke('Respond with exactly: ANTHROPIC_WORKS');
      return true;
    } catch (error) {
      console.error("Claude Anthropic connection test failed:", error);
      return false;
    }
  }

  getModelInfo(): any {
    return {
      provider: "Anthropic",
      model: "Claude 3.5 Sonnet",
      modelId: this.modelId,
      api: "Direct Anthropic API",
    };
  }
}
