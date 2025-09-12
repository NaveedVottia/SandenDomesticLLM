#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

// Load environment variables
dotenv.config({ path: "./server.env" });

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Model configurations - Only real models, no false aliases
const MODELS = {
  claude_sonnet: {
    name: 'claude_sonnet',
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0', // Using working v1 model
    description: 'AWS Bedrock Claude 3.5 Sonnet'
  }
  // Removed false aliases: karakuri, tsuzumi, plamo, nova_micro, nova_pro
  // These were all pointing to the same Claude model
};

// Helper function to encode chunks for f0ed format
function encodeChunk(chunk) {
  return chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Helper function to prepare streaming headers
function prepareStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

// Helper function to write message ID
function writeMessageId(res, messageId) {
  res.write(`f:{"messageId":"${messageId}"}\n`);
  try { res.flush?.(); } catch {}
}

// Helper function to write finish metadata
function writeFinish(res, fullTextLength) {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
  try { res.flush?.(); } catch {}
}

// Generate response using AI SDK 5 with Bedrock
async function generateBedrockResponse(modelId, messages, res) {
  try {
    console.log(`🤖 Using AI SDK 5 with model: ${modelId}`);
    
    // Convert messages to AI SDK format
    const systemMessage = "You are a helpful assistant for Sanden repair system. Respond in Japanese when appropriate.";
    const aiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Use AI SDK 5 generateText
    const result = await generateText({
      model: bedrock(modelId),
      system: systemMessage,
      messages: aiMessages,
      maxTokens: 1000,
      temperature: 0.7,
    });

    const fullText = result.text;
    
    // Stream the response in chunks
    const chunkSize = 10;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      const chunk = fullText.slice(i, i + chunkSize);
      res.write(`0:"${encodeChunk(chunk)}"\n`);
      try { res.flush?.(); } catch {}
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`✅ AI SDK 5 response complete, length: ${fullText.length} characters`);
    return fullText.length;
  } catch (error) {
    console.error('❌ AI SDK 5 Bedrock error:', error);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "Multi-model server operational with SDK5 v2",
    models: Object.keys(MODELS),
    endpoints: {
      ui: "/",
      api: "/api/test/stream",
      models: "/api/models"
    }
  });
});

// List available models
app.get("/api/models", (req, res) => {
  res.json({
    models: Object.values(MODELS).map(model => ({
      id: model.name,
      name: model.name,
      provider: model.provider,
      description: model.description
    }))
  });
});

// Main streaming endpoint with model selection
app.post("/api/test/stream", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const prompt = req.body?.prompt;
    const model = req.body?.model || 'claude_sonnet'; // Default to claude_sonnet

    console.log(`🔍 Stream request received`);
    console.log(`🔍 Model: ${model}`);
    console.log(`🔍 Messages:`, messages);
    console.log(`🔍 Prompt:`, prompt);

    // Validate model
    if (!MODELS[model]) {
      res.status(400).json({ error: `Model '${model}' not found. Available models: ${Object.keys(MODELS).join(', ')}` });
      return;
    }

    const modelConfig = MODELS[model];
    console.log(`🤖 Using model: ${modelConfig.name} (${modelConfig.provider})`);

    prepareStreamHeaders(res);
    const messageId = `${model}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, messageId);

    let fullTextLength = 0;

    // Route to appropriate model provider
    if (modelConfig.provider === 'bedrock') {
      fullTextLength = await generateBedrockResponse(modelConfig.modelId, messages, res);
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }

    writeFinish(res, fullTextLength);

    console.log(`✅ ${model} stream complete, length: ${fullTextLength} characters`);
    res.end();
  } catch (error) {
    console.error("❌ Stream error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Simple UI endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Sanden Multi-Model Server",
    version: "SDK5 v2 Compatible",
    models: Object.keys(MODELS),
    endpoints: {
      health: "/health",
      models: "/api/models", 
      stream: "/api/test/stream"
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Multi-model server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 Models: http://localhost:${PORT}/api/models`);
  console.log(`🔗 API: http://localhost:${PORT}/api/test/stream`);
  console.log(`📋 Available models: ${Object.keys(MODELS).join(', ')}`);
  console.log(`✅ Real models only - no false aliases`);
});
