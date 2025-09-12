import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import dotenv from 'dotenv';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, streamText } from 'ai';

// Load environment variables
dotenv.config({ path: "./server.env" });

const app = express();

// Enable CORS for all requests
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Model configurations
const MODELS = {
  karakuri: {
    name: 'karakuri',
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Only SDK5 v2 compatible model
    description: 'AWS Bedrock Karakuri model - Claude 3.5 Sonnet v2'
  },
  tsuzumi: {
    name: 'tsuzumi', 
    provider: 'azure',
    modelId: 'tsuzumi-2.0', // Azure AI Tsuzumi model
    description: 'Azure AI Tsuzumi model',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY
  },
  plamo: {
    name: 'plamo',
    provider: 'bedrock', 
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Only SDK5 v2 compatible model
    description: 'AWS Bedrock Plamo model - Claude 3.5 Sonnet v2'
  },
  nova_micro: {
    name: 'nova_micro',
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Using Claude as Nova not compatible
    description: 'AWS Bedrock Nova Micro (using Claude 3.5 Sonnet v2)'
  },
  nova_pro: {
    name: 'nova_pro',
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Using Claude as Nova not compatible
    description: 'AWS Bedrock Nova Pro (using Claude 3.5 Sonnet v2)'
  },
  claude_sonnet: {
    name: 'claude_sonnet',
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    description: 'AWS Bedrock Claude 3.5 Sonnet v2'
  }
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

// Generate response using AWS Bedrock
async function generateBedrockResponse(modelId, messages, res) {
  try {
    const result = await streamText({
      model: bedrock(modelId),
      messages: messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    let fullText = '';
    for await (const delta of result.textStream) {
      fullText += delta;
      res.write(`0:"${encodeChunk(delta)}"\n`);
      try { res.flush?.(); } catch {}
    }

    return fullText.length;
  } catch (error) {
    console.error('❌ Bedrock error:', error);
    throw error;
  }
}

// Generate response using Azure AI (Tsuzumi)
async function generateAzureResponse(modelId, messages, res) {
  try {
    // For now, return a placeholder response
    // You'll need to implement Azure AI integration
    const response = `これは${modelId}モデルからの応答です。Azure AI統合は実装中です。`;
    
    let fullText = '';
    for (const char of response) {
      fullText += char;
      res.write(`0:"${encodeChunk(char)}"\n`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return fullText.length;
  } catch (error) {
    console.error('❌ Azure AI error:', error);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "Multi-model server operational",
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
    const model = req.body?.model || 'karakuri'; // Default to karakuri

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
    } else if (modelConfig.provider === 'azure') {
      fullTextLength = await generateAzureResponse(modelConfig.modelId, messages, res);
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

// Serve the static UI from the remote URL
app.use('/', createProxyMiddleware({
  target: 'https://demo.dev-maestra.vottia.me',
  changeOrigin: true,
  pathRewrite: {
    '^/': '/sanden-dev/',
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🌐 Proxying UI ${req.method} ${req.url} to ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ UI Response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ UI Proxy error:', err);
    res.status(500).send('UI Proxy error');
  }
}));

const PORT = 80;
app.listen(PORT, () => {
  console.log(`🚀 Multi-model server running on port ${PORT}`);
  console.log(`🔗 UI: http://localhost:${PORT} -> https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`🔗 API: http://localhost:${PORT}/api/test/stream (supports karakuri, tsuzumi, plamo)`);
  console.log(`🔗 Models: http://localhost:${PORT}/api/models`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📋 Available models: ${Object.keys(MODELS).join(', ')}`);
});


