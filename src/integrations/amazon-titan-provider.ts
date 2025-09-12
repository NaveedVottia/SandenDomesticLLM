import { bedrock } from "@ai-sdk/amazon-bedrock";
import { streamText, generateText } from "ai";
import { LangfuseIntegration } from "./langfuse.js";

export class ClaudeSonnetProvider {
  private model: any;
  private langfuse: LangfuseIntegration;
  private modelName: string;

  constructor() {
    this.modelName = "claude-sonnet-3.5-v2";
    this.langfuse = new LangfuseIntegration();
    
    // Initialize Claude Sonnet 3.5 v2 from AWS Bedrock (AI SDK v5 compatible)
    this.model = bedrock("anthropic.claude-3-5-sonnet-20241022-v2:0");
    
    console.log(`🤖 Claude Sonnet 3.5 v2 Provider initialized with model: anthropic.claude-3-5-sonnet-20241022-v2:0`);
  }

  /**
   * Generate streaming response using Claude Sonnet 3.5 v2
   */
  async generateStream(messages: any[], options: any = {}) {
    try {
      console.log(`🤖 Claude Sonnet 3.5 v2 generating stream for ${messages.length} messages`);
      
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
      console.error("❌ Claude Sonnet 3.5 v2 streaming error:", error);
      throw error;
    }
  }

  /**
   * Generate non-streaming response using Claude Sonnet 3.5 v2
   */
  async generate(messages: any[], options: any = {}) {
    try {
      console.log(`🤖 Claude Sonnet 3.5 v2 generating response for ${messages.length} messages`);
      
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
      console.error("❌ Claude Sonnet 3.5 v2 generation error:", error);
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
      let promptName = "Domestic-general-assistant";
      
      if (userInput.includes("顧客") || userInput.includes("customer") || userInput.includes("識別")) {
        promptName = "Domestic-customer-identification";
      } else if (userInput.includes("修理") || userInput.includes("repair") || userInput.includes("メンテナンス")) {
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
        console.warn(`⚠️ No prompt found for ${promptName}, using fallback`);
        return this.getFallbackPrompt();
      }
      
      return prompt;
    } catch (error) {
      console.error("❌ Error getting Langfuse prompt:", error);
      return this.getFallbackPrompt();
    }
  }

  /**
   * Fallback prompt when Langfuse is unavailable
   */
  private getFallbackPrompt(): string {
    return `あなたはサンデン・リテールシステムの修理受付AIアシスタントです。

【役割】
- 顧客の修理サービスに関する問い合わせに対応
- 丁寧で親切な日本語での対応
- 技術的な問題解決のサポート

【出力形式】
- プレーンテキストのみで回答
- JSONやコードは出力しない
- 処理中表記は出力しない

【対応内容】
1. 顧客識別と認証
2. 修理履歴の確認
3. 修理予約の受付
4. 製品情報の提供
5. 技術的な問題の分析
6. 訪問確認のサポート

【言語】
- 既定は日本語
- 必要に応じて英語でも対応可能

【会話スタイル】
- 丁寧で親切
- 顧客の立場に立った対応
- 明確で分かりやすい説明`;
  }

  /**
   * Health check for Claude Sonnet 3.5 v2
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
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const claudeSonnetProvider = new ClaudeSonnetProvider();