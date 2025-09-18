import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();
const TARGET_ORIGIN = process.env.TARGET_ORIGIN || 'http://52.199.226.109:80';

// Enable CORS for all requests
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (curl) or reflect provided origin for browser
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'proxy-healthy', 
    timestamp: new Date().toISOString(),
    target: TARGET_ORIGIN
  });
});

// Dedicated streaming proxy for /api/test/stream (ensure no buffering)
app.use('/api/test/stream', createProxyMiddleware({
  target: TARGET_ORIGIN,
  changeOrigin: true,
  proxyTimeout: 600000,
  timeout: 600000,
  pathRewrite: () => '/api/test/stream',
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    // Forward streaming-friendly headers
    proxyReq.setHeader('Accept', req.headers['accept'] || 'text/plain, text/event-stream, application/json');
    proxyReq.setHeader('Cache-Control', 'no-cache');
    proxyReq.setHeader('Connection', 'keep-alive');
    proxyReq.setHeader('X-Accel-Buffering', 'no');
    console.log(`🔄 Proxying ${req.method} ${req.url} to ${TARGET_ORIGIN}${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Propagate streaming headers back to client
    proxyRes.headers['Cache-Control'] = 'no-cache, no-transform';
    proxyRes.headers['Connection'] = 'keep-alive';
    proxyRes.headers['X-Accel-Buffering'] = 'no';
    console.log(`✅ Response from server: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// Dedicated streaming proxy for /sanden-dev/api/test/stream -> /api/test/stream
app.use('/sanden-dev/api/test/stream', createProxyMiddleware({
  target: TARGET_ORIGIN,
  changeOrigin: true,
  proxyTimeout: 600000,
  timeout: 600000,
  pathRewrite: () => '/api/test/stream',
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Accept', req.headers['accept'] || 'text/plain, text/event-stream, application/json');
    proxyReq.setHeader('Cache-Control', 'no-cache');
    proxyReq.setHeader('Connection', 'keep-alive');
    proxyReq.setHeader('X-Accel-Buffering', 'no');
    console.log(`🔄 Proxying ${req.method} ${req.url} to ${TARGET_ORIGIN}/api/test/stream`);
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-transform';
    proxyRes.headers['Connection'] = 'keep-alive';
    proxyRes.headers['X-Accel-Buffering'] = 'no';
    console.log(`✅ Response from server: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// Proxy API calls to your deployed server (general)
app.use('/api', createProxyMiddleware({
  target: TARGET_ORIGIN,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'  // Keep the /api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} to ${TARGET_ORIGIN}${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response from server: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// General UI proxy: /sanden-dev/api/* -> /api/* on target
app.use('/sanden-dev/api', createProxyMiddleware({
  target: TARGET_ORIGIN,
  changeOrigin: true,
  pathRewrite: {
    '^/sanden-dev/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 UI Proxy ${req.method} ${req.url} -> ${TARGET_ORIGIN}${req.url.replace('/sanden-dev', '')}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ UI Response from server: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ UI Proxy error:', err);
    res.status(500).json({ error: 'UI proxy error' });
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 API Proxy server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔄 API calls: http://localhost:${PORT}/api/* -> ${TARGET_ORIGIN}/api/*`);
});
