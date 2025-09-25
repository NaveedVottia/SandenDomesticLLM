# Setup & Configuration

This folder contains all setup scripts, configuration files, and deployment tools for the Sanden Repair System.

## 📁 Contents

### Server Configuration
- `server.env` - Main environment configuration with API keys and settings
- `env.local.template` - Template for local environment setup
- `ecosystem.config.cjs` - PM2 process manager configuration

### Deployment Scripts
- `start-server.sh` - Main server startup script
- `health-check.sh` - Health monitoring script
- `monitor-server.sh` - Server monitoring utility
- `keep-alive.sh` - Keep-alive maintenance script
- `sanden-keepalive.service` - Systemd service configuration

### Setup & Creation Scripts
- `create-*` - Scripts to generate prompts and configurations
- `deploy-*` - Deployment and infrastructure setup scripts
- `download-*` - Data and prompt downloading utilities
- `update-*` - Configuration update and migration scripts

### AWS Configuration
- **Claude Access**: Configured for AWS Bedrock in ap-northeast-1 region
- **Karakuri Access**: SageMaker endpoint configuration
- **Credentials**: AWS access keys for model APIs

## 🚀 Quick Setup

```bash
# Copy environment template
cp setup/env.local.template .env

# Edit with your API keys
nano .env

# Start the server
./setup/start-server.sh

# Check health
./setup/health-check.sh
```

## 🔑 Required API Keys

### AWS (for Claude via Bedrock)
```
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
```

### Anthropic (Direct API - faster alternative)
```
ANTHROPIC_API_KEY=your_key_here
```

### Langfuse (Prompt management)
```
LANGFUSE_HOST=your_langfuse_url
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
```

## 📊 Monitoring

The setup includes comprehensive monitoring:
- Health checks every 30 seconds
- Automatic restart on failure
- Log rotation and monitoring
- Performance tracking

## 🔧 Troubleshooting

- Check `server.log` for application logs
- Check `monitor.log` for monitoring logs
- Use `health-check.sh` to verify system status
- Check AWS credentials if Bedrock access fails

## 📦 Related Folders

- `evaluation/` - GENIAC evaluation suite and results
- `src/` - Main application source code
- `dist/` - Compiled TypeScript output
