import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();
const TARGET_ORIGIN = process.env.TARGET_ORIGIN || 'http://172.26.10.150:80';

// Enable CORS for all requests
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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

// AI SDK v5 streaming proxy to backend /api/test/stream
app.use('/api/test/stream', createProxyMiddleware({
  target: TARGET_ORIGIN,
  changeOrigin: true,
  proxyTimeout: 600000,
  timeout: 600000,
  pathRewrite: () => '/api/test/stream',
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Accept', req.headers['accept'] || 'text/event-stream, text/plain, application/json');
    proxyReq.setHeader('Cache-Control', 'no-cache');
    proxyReq.setHeader('Connection', 'keep-alive');
    proxyReq.setHeader('X-Accel-Buffering', 'no');
    console.log(`🔄 API Proxy ${req.method} ${req.url} -> ${TARGET_ORIGIN}/api/test/stream`);
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-transform';
    proxyRes.headers['Connection'] = 'keep-alive';
    proxyRes.headers['X-Accel-Buffering'] = 'no';
    console.log(`✅ API Response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ API Proxy error:', err);
    res.status(500).json({ error: 'API proxy error' });
  }
}));

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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
app.listen(PORT, () => {
  console.log(`🚀 Test server with UI and API running on port ${PORT}`);
  console.log(`🔗 UI: http://localhost:${PORT} -> https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`🔗 API proxy: http://localhost:${PORT}/api/test/stream -> ${TARGET_ORIGIN}/api/test/stream (AI SDK v5)`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});


