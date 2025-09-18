import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './server.env' });

const app = express();
const PORT = 80;

// Middleware
app.use(cors());
app.use(express.json());

// Import only Plamo provider
import { PlamoMastraProvider } from './integrations/plamo-mastra.js';

// Initialize only Plamo provider
const plamoProvider = new PlamoMastraProvider();

// Health check endpoint
app.get('/api/plamo/health', async (req, res) => {
  try {
    const health = await plamoProvider.healthCheck();
    res.json({ status: 'healthy', ...health });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Main streaming endpoint (Mastra f0ed format)
app.post('/api/test/stream', async (req, res) => {
  try {
    const { messages, stream = true } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    console.log(`🤖 Plamo streaming request - Messages: ${messages.length}`);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate unique message ID
    const messageId = `msg-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send initial message ID
    res.write(`f:${JSON.stringify({ messageId })}\n`);

    let fullContent = '';
    let tokenCount = 0;

    // Use Plamo only
    console.log(`🤖 Using Plamo model for streaming`);
    const streamResponse = await plamoProvider.generateStream(messages, {
      temperature: 0.7,
      max_tokens: 1000
    });

    // Stream the response in Mastra f0ed format
    streamResponse.on('data', (chunk) => {
      if (chunk.content) {
        fullContent += chunk.content;
        tokenCount++;
        res.write(`0:"${chunk.content}"\n`);
      }
    });

    streamResponse.on('end', () => {
      // Send end markers
      res.write(`e:${JSON.stringify({ 
        finishReason: "stop", 
        usage: { 
          promptTokens: messages.length * 10, // Rough estimate
          completionTokens: tokenCount 
        }, 
        isContinued: false 
      })}\n`);
      
      res.write(`d:${JSON.stringify({ 
        finishReason: "stop", 
        usage: { 
          promptTokens: messages.length * 10, 
          completionTokens: tokenCount 
        } 
      })}\n`);
      
      console.log(`✅ Plamo stream complete, length: ${fullContent.length} characters`);
      res.end();
    });

    streamResponse.on('error', (error) => {
      console.error(`Plamo streaming error:`, error);
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    console.error(`Plamo streaming error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Additional endpoint for UI compatibility - duplicate the main handler
app.post('/sanden-dev/api/test/stream', async (req, res) => {
  try {
    const { messages, stream = true } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    console.log(`🤖 Plamo streaming request (UI) - Messages: ${messages.length}`);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate unique message ID
    const messageId = `msg-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send initial message ID
    res.write(`f:${JSON.stringify({ messageId })}\n`);

    let fullContent = '';
    let tokenCount = 0;

    // Use Plamo only
    console.log(`🤖 Using Plamo model for streaming (UI)`);
    const streamResponse = await plamoProvider.generateStream(messages, {
      temperature: 0.7,
      max_tokens: 1000
    });

    // Stream the response in Mastra f0ed format
    streamResponse.on('data', (chunk) => {
      if (chunk.content) {
        fullContent += chunk.content;
        tokenCount++;
        res.write(`0:"${chunk.content}"\n`);
      }
    });

    streamResponse.on('end', () => {
      // Send end markers
      res.write(`e:${JSON.stringify({ 
        finishReason: "stop", 
        usage: { 
          promptTokens: messages.length * 10, // Rough estimate
          completionTokens: tokenCount 
        }, 
        isContinued: false 
      })}\n`);
      
      res.write(`d:${JSON.stringify({ 
        finishReason: "stop", 
        usage: { 
          promptTokens: messages.length * 10, 
          completionTokens: tokenCount 
        } 
      })}\n`);
      
      console.log(`✅ Plamo stream complete (UI), length: ${fullContent.length} characters`);
      res.end();
    });

    streamResponse.on('error', (error) => {
      console.error(`Plamo streaming error (UI):`, error);
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    console.error(`Plamo streaming error (UI):`, error);
    res.status(500).json({ error: error.message });
  }
});

// Non-streaming generate endpoint
app.post('/api/plamo/generate', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await plamoProvider.generate(messages, {
      temperature: 0.7,
      max_tokens: 1000
    });

    res.json(response);
  } catch (error) {
    console.error('Plamo generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Plamo-only server is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    models: ['plamo'],
    endpoints: {
      streaming: '/api/test/stream',
      plamo: {
        health: '/api/plamo/health',
        generate: '/api/plamo/generate'
      }
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Plamo-only server running on port ${PORT}`);
  console.log(`📡 Plamo health: http://localhost/api/plamo/health`);
  console.log(`💬 Streaming endpoint: http://localhost/api/test/stream`);
  console.log(`🎯 UI endpoint: http://localhost/sanden-dev/api/test/stream`);
  console.log(`🔧 Plamo generate: http://localhost/api/plamo/generate`);
  console.log(`🧪 Test: http://localhost/api/test`);
  console.log(`🎯 UI endpoint: https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`🤖 Available models: plamo`);
});

export default app;
