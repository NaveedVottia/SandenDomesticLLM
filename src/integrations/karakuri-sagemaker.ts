/**
 * Karakuri SageMaker Integration
 * Provides interface to Karakuri LM 8x7B Instruct model deployed on AWS SageMaker
 */

import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

export class KarakuriSageMakerIntegration {
  private client: SageMakerRuntimeClient;
  private endpointName: string;
  private region: string;

  constructor() {
    this.region = process.env.KARAKURI_REGION || "ap-northeast-1";
    this.endpointName = process.env.KARAKURI_ENDPOINT_NAME || "Karakuri-Endpoint-1";

    this.client = new SageMakerRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    });
  }

  /**
   * Invoke Karakuri model with a prompt
   */
  async invoke(prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}): Promise<string> {
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        do_sample: true,
      }
    };

    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: "application/json",
      Body: JSON.stringify(payload),
    });

    try {
      const response = await this.client.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.Body));

      // Handle different response formats
      if (result.generated_text) {
        return result.generated_text;
      } else if (result.outputs && Array.isArray(result.outputs)) {
        return result.outputs[0] || "";
      } else if (Array.isArray(result)) {
        return result[0] || "";
      } else {
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error("Karakuri SageMaker error:", error);
      throw new Error(`Karakuri SageMaker invocation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test connection to Karakuri endpoint
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.invoke("こんにちは、テストです。", {
        maxTokens: 50,
        temperature: 0.1
      });

      if (response && response.length > 0) {
        console.log("✅ Karakuri SageMaker connection successful");
        console.log("📝 Test response:", response.substring(0, 100), "...");
        return true;
      } else {
        console.error("❌ Empty response from Karakuri");
        return false;
      }
    } catch (error) {
      console.error("❌ Karakuri SageMaker connection failed:", error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      name: "KARAKURI LM 8x7b instruct v0.1.1",
      provider: "SB Intuitions",
      endpoint: this.endpointName,
      region: this.region,
      type: "sagemaker",
      architecture: "8x7B parameters",
      contextWindow: "~4096 tokens",
      languages: ["ja", "en"],
      useCase: "Japanese business applications, instruction following"
    };
  }

  /**
   * Batch invoke multiple prompts
   */
  async batchInvoke(prompts: string[], options: {
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<string[]> {
    const results: string[] = [];

    for (const prompt of prompts) {
      try {
        const result = await this.invoke(prompt, options);
        results.push(result);
      } catch (error) {
        console.error(`Batch invoke failed for prompt: ${prompt.substring(0, 50)}...`, error);
        results.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Add small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

export const karakuriSageMaker = new KarakuriSageMakerIntegration();
