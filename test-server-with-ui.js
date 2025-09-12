import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();

// Enable CORS for all requests
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "Test server with UI and API",
    endpoints: {
      ui: "/",
      api: "/api/test/stream"
    }
  });
});

// Test API endpoint that actually works
app.post("/api/test/stream", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const prompt = req.body?.prompt;

    console.log(`🔍 Test stream request received`);
    console.log(`🔍 Messages:`, messages);
    console.log(`🔍 Prompt:`, prompt);

    // Set streaming headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Generate message ID
    const messageId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.write(`f:{"messageId":"${messageId}"}\n`);

    // Stream test response in f0ed format
    const testResponse = "これはテストストリーミングレスポンスです。Mastra f0edプロトコルでストリーミングしています。";
    let totalLength = 0;
    
    for (const char of testResponse) {
      totalLength += char.length;
      res.write(`0:"${char}"\n`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
    }

    // Write finish metadata
    res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${totalLength}},"isContinued":false}\n`);
    res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${totalLength}}}\n`);

    console.log(`✅ Test stream complete, length: ${totalLength} characters`);
    res.end();
  } catch (error) {
    console.error("❌ Test stream error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the static UI from the remote URL
app.use('/', createProxyMiddleware({
  target: 'https://demo.dev-maestra.vottia.me', // Target the base domain
  changeOrigin: true,
  pathRewrite: {
    '^/': '/sanden-dev/', // Rewrite root to /sanden-dev
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

const PORT = 80; // Run on port 80 for direct access
app.listen(PORT, () => {
  console.log(`🚀 Test server with UI and API running on port ${PORT}`);
  console.log(`🔗 UI: http://localhost:${PORT} -> https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`🔗 API: http://localhost:${PORT}/api/test/stream (f0ed streaming)`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});


