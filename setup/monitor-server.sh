#!/bin/bash

# Simple server monitor script
LOG_FILE="/home/ec2-user/sanden-repair-system-V2/monitor.log"

echo "$(date): Checking server health..." >> $LOG_FILE

# Check if server is responding
if curl -s --max-time 10 http://localhost:80/health > /dev/null; then
    echo "$(date): ✅ Server is healthy" >> $LOG_FILE
else
    echo "$(date): ❌ Server is not responding - attempting restart" >> $LOG_FILE

    # Kill any existing processes
    pkill -f "tsx src/mastra-server.ts" 2>/dev/null
    pm2 delete sanden-repair-system 2>/dev/null

    # Start the server
    cd /home/ec2-user/sanden-repair-system-V2
    npx tsx src/mastra-server.ts > server.log 2>&1 &

    echo "$(date): Server restart initiated" >> $LOG_FILE
fi
