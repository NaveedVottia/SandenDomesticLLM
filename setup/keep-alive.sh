#!/bin/bash

echo "🔄 Starting Sanden Repair System Keep-Alive Monitor..."

SERVER_PID=""

while true; do
  # Check if server is actually responding (not just PM2 status)
  if ! curl -s --max-time 5 http://localhost:80/health > /dev/null; then
    echo "$(date): Server is not responding. Restarting..."

    # Kill existing PM2 process
    pm2 delete sanden-repair-system 2>/dev/null

    # Start the server
    cd /home/ec2-user/sanden-repair-system-V2
    pm2 start ecosystem.config.cjs

    # Wait for startup
    sleep 15

    # Test if server is actually responding
    if curl -s --max-time 5 http://localhost:80/health > /dev/null; then
      echo "$(date): ✅ Server started successfully and is responding"
    else
      echo "$(date): ❌ Server failed to respond to health check"
      # Try to get some logs
      pm2 logs sanden-repair-system --lines 5 --nostream | tail -5
    fi
  else
    echo "$(date): ✅ Server is responding"
  fi

  # Wait before next check
  sleep 30
done
