import { bedrock } from "@ai-sdk/amazon-bedrock";
import { streamText, generateText } from "ai";
import { LangfuseIntegration } from "./langfuse.js";

export class AmazonTitanProvider {
  private model: any;
  private langfuse: LangfuseIntegration;
  private modelName: string;

  constructor() {
    this.modelName = "amazon-titan-express";
    this.langfuse = new LangfuseIntegration();
    
    // Initialize Amazon Titan Text Express from AWS Bedrock
    this.model = bedrock("amazon.titan-text-express-v1");
    
    console.log(`🤖 Amazon Titan Express Provider initialized with model: amazon.titan-text-express-v1`);
  }

  /**
   * Generate streaming response using Amazon Titan Express
   */
  async generateStream(messages: any[], options: any = {}) {
    try {
      console.log(`🤖 Amazon Titan Express generating stream for ${messages.length} messages`);
      
      // Get appropriate prompt from Langfuse based on context
      const prompt = await this.getClaudePrompt(messages);
      
      // Prepare messages with system prompt
      const systemMessage = {
        role: "system",
        content: prompt
      };
      
      const allMessages = [systemMessage, ...messages];
      
      console.log(`📝 Using Langfuse prompt: ${prompt.substring(0, 100)}...`);
      
      const result = await streamText({
        model: this.model,
        messages: allMessages,
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.max_tokens || 1000,
      });

      return result.textStream;
    } catch (error) {
      console.error("❌ Amazon Titan Express streaming error:", error);
      throw error;
    }
  }

  /**
   * Generate non-streaming response using Amazon Titan Express
   */
  async generate(messages: any[], options: any = {}) {
    try {
      console.log(`🤖 Amazon Titan Express generating response for ${messages.length} messages`);
      
      // Get appropriate prompt from Langfuse based on context
      const prompt = await this.getClaudePrompt(messages);
      
      // Prepare messages with system prompt
      const systemMessage = {
        role: "system",
        content: prompt
      };
      
      const allMessages = [systemMessage, ...messages];
      
      console.log(`📝 Using Langfuse prompt: ${prompt.substring(0, 100)}...`);
      
      const result = await generateText({
        model: this.model,
        messages: allMessages,
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.max_tokens || 1000,
      });

      return {
        content: result.text,
        usage: result.usage,
        finishReason: result.finishReason
      };
    } catch (error) {
      console.error("❌ Amazon Titan Express generation error:", error);
      throw error;
    }
  }

  /**
   * Get appropriate Langfuse prompt based on message context
   */
  private async getClaudePrompt(messages: any[]): Promise<string> {
    try {
      // Extract user input from messages
      const userMessage = messages.find(msg => msg.role === "user");
      const userInput = userMessage?.content || "";
      
      // Determine prompt based on keywords in user input
      let promptName = "Domestic-customer-identification"; // Default to customer identification
      
      if (userInput.includes("修理") || userInput.includes("repair") || userInput.includes("メンテナンス")) {
        promptName = "Domestic-repair-agent";
      } else if (userInput.includes("予約") || userInput.includes("schedule") || userInput.includes("アポイント")) {
        promptName = "Domestic-repair-scheduling";
      } else if (userInput.includes("製品") || userInput.includes("product") || userInput.includes("商品")) {
        promptName = "Domestic-product-selection";
      } else if (userInput.includes("問題") || userInput.includes("issue") || userInput.includes("トラブル")) {
        promptName = "Domestic-issue-analysis";
      } else if (userInput.includes("訪問") || userInput.includes("visit") || userInput.includes("確認")) {
        promptName = "Domestic-visit-confirmation";
      }
      
      console.log(`🎯 Selected Langfuse prompt: ${promptName}`);
      
      // Get prompt from Langfuse
      const prompt = await this.langfuse.getPromptText(promptName, "production");
      
      if (!prompt) {
        console.warn(`⚠️ No prompt found for ${promptName}, using minimal fallback`);
        return "You are a helpful AI assistant. Please respond to user messages.";
      }
      
      return prompt;
    } catch (error) {
      console.error("❌ Error getting Langfuse prompt:", error);
      return "You are a helpful AI assistant. Please respond to user messages.";
    }
  }


  /**
   * Health check for Amazon Titan Express
   */
  async healthCheck() {
    try {
      // Test with a simple message
      const testMessages = [{ role: "user", content: "こんにちは" }];
      const response = await this.generate(testMessages, { max_tokens: 10 });
      
      return {
        status: "healthy",
        model: this.modelName,
        provider: "aws-bedrock",
        langfuse: "connected", // Simplified for now
        testResponse: response.content.substring(0, 50) + "..."
      };
    } catch (error) {
      return {
        status: "unhealthy",
        model: this.modelName,
        provider: "aws-bedrock",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export singleton instance
export const amazonTitanProvider = new AmazonTitanProvider();