#!/bin/bash

# Deploy script for SandenDomesticLLM test-stream-server
# This deploys the server to AWS Lightsail

echo "🚀 Starting deployment of test-stream-server to AWS Lightsail..."

# Build the project
echo "📦 Building project..."
npm run build

# Create deployment directory
DEPLOY_DIR="/home/ec2-user/test-stream-deployment"
echo "📁 Creating deployment directory: $DEPLOY_DIR"
mkdir -p $DEPLOY_DIR

# Copy necessary files
echo "📋 Copying files..."
cp src/test-stream-server.js $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp server.env $DEPLOY_DIR/

# Install dependencies in deployment directory
echo "📦 Installing dependencies..."
cd $DEPLOY_DIR
npm install --production

# Create PM2 ecosystem config for the test server
cat > ecosystem-test.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'test-stream-server',
    script: 'test-stream-server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Stop any existing test server
echo "🛑 Stopping existing test server..."
pm2 stop test-stream-server 2>/dev/null || true
pm2 delete test-stream-server 2>/dev/null || true

# Start the new server
echo "🚀 Starting test-stream-server on port 8080..."
pm2 start ecosystem-test.config.cjs

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
echo "🌐 Server running on port 8080"
echo "🔗 Health check: http://localhost:8080/health"
echo "🔗 Stream endpoint: http://localhost:8080/api/test/stream"
echo ""
echo "📊 PM2 Status:"
pm2 status
