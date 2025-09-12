import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();

// Enable CORS for all requests
app.use(cors({
  origin: '*',
  credentials: true,
}));

// Proxy API calls to your deployed server
app.use('/api', createProxyMiddleware({
  target: 'http://52.199.226.109:80',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} to 52.199.226.109:80`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}));

// Serve the UI from the demo site
app.use('/', createProxyMiddleware({
  target: 'https://demo.dev-maestra.vottia.me/sanden-dev',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🌐 Serving UI: ${req.url}`);
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Reverse proxy server running on port ${PORT}`);
  console.log(`🌐 UI: http://localhost:${PORT}`);
  console.log(`🔄 API calls will be proxied to 52.199.226.109:80`);
  console.log(`🎯 This allows the UI to connect to your deployed server!`);
});
