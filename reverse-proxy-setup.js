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
    message: "Reverse proxy operational",
    ui: "https://demo.dev-maestra.vottia.me/sanden-dev",
    api: "Proxying to deployed server"
  });
});

// Proxy API calls to your deployed server
app.use('/api', createProxyMiddleware({
  target: 'http://52.199.226.109:80', // Your deployed server IP
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'  // Keep the /api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying API ${req.method} ${req.url} to 52.199.226.109:80${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ API Response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ API Proxy error:', err);
    res.status(500).json({ error: 'API Proxy error' });
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

const PORT = 80; // Run on port 80 for direct access
app.listen(PORT, () => {
  console.log(`🚀 Reverse proxy server running on port ${PORT}`);
  console.log(`🔗 UI: http://localhost:${PORT} -> https://demo.dev-maestra.vottia.me/sanden-dev`);
  console.log(`🔄 API: http://localhost:${PORT}/api/* -> 52.199.226.109:80/api/*`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});


