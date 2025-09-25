/**
 * Claude Bedrock Integration
 * Provides interface to Claude 3.5 Sonnet model deployed on AWS Bedrock
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export class ClaudeBedrockIntegration {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.modelId = process.env.CLAUDE_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async invoke(prompt: string, options: any = {}): Promise<string> {
    try {
      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      };

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify(requestBody),
        contentType: "application/json",
        accept: "application/json",
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content[0].text;
      }

      throw new Error("No content in Claude response");
    } catch (error) {
      console.error("Claude Bedrock invocation failed:", error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.invoke("Hello, please respond with 'OK' if you can understand this message.");
      return true;
    } catch (error) {
      console.error("Claude Bedrock connection test failed:", error);
      return false;
    }
  }

  getModelInfo(): any {
    return {
      provider: "Anthropic",
      model: "Claude 3.5 Sonnet",
      modelId: this.modelId,
      region: process.env.AWS_REGION || "us-east-1",
    };
  }
}
