import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Proxy configuration
const proxyOptions = {
  target: 'http://52.199.226.109',
  changeOrigin: true,
  pathRewrite: {
    '^/api/test/stream': '/api/test/stream'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Proxy all requests to your local server
app.use('/api', proxy);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Proxy server running',
    target: 'http://52.199.226.109'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔄 Proxy server running on port ${PORT}`);
  console.log(`📡 Proxying to: http://52.199.226.109`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 UI endpoint: https://demo.dev-maestra.vottia.me/sanden-dev`);
});

export default app;
