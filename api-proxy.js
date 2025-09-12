import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();

// Enable CORS for all requests
app.use(cors({
  origin: '*',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'proxy-healthy', 
    timestamp: new Date().toISOString(),
    target: '52.199.226.109:80'
  });
});

// Proxy API calls to your deployed server
app.use('/api', createProxyMiddleware({
  target: 'http://52.199.226.109:80',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'  // Keep the /api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} to 52.199.226.109:80${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response from server: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 API Proxy server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔄 API calls: http://localhost:${PORT}/api/* -> 52.199.226.109:80/api/*`);
});
