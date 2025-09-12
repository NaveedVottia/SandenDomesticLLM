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

// Proxy /api/test/stream to your deployed server
app.use('/api/test/stream', createProxyMiddleware({
  target: 'http://52.199.226.109:80',
  changeOrigin: true,
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

// Proxy all other /api/* requests to the Mastra demo server
app.use('/api', createProxyMiddleware({
  target: 'https://mastra.demo.dev-maestra.vottia.me',
  changeOrigin: true,
  secure: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} to mastra.demo.dev-maestra.vottia.me${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Mastra proxy error:', err);
    res.status(500).json({ error: 'Mastra proxy error' });
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Hybrid Proxy server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔄 /api/test/stream -> 52.199.226.109:80/api/test/stream`);
  console.log(`🔄 All other /api/* -> mastra.demo.dev-maestra.vottia.me/api/*`);
});
