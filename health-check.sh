#!/bin/bash

# Sanden Repair System Health Check Script
# This script checks if the server is running and responsive

echo "=== Sanden Repair System Health Check ==="
echo "$(date)"

# Check PM2 process status
echo ""
echo "PM2 Process Status:"
pm2 jlist | jq -r '.[] | select(.name == "sanden-repair-system") | "Name: \(.name), Status: \(.pm2_env.status), CPU: \(.monit.cpu)%, Memory: \(.monit.memory)MB"'

# Check server responsiveness
echo ""
echo "Server Health Check:"
if curl -s -f http://localhost/api/agents/repair-workflow-orchestrator/stream -X POST -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"test"}]}' | grep -q "messageId"; then
    echo "✅ Server is responding and processing requests"
else
    echo "⚠️  Server is not responding properly"
fi

# Check system resources
echo ""
echo "System Resources:"
echo "Memory usage: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "Disk usage: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "Load average: $(uptime | awk -F'load average:' '{print $2}')"

echo ""
echo "=== Health Check Complete ==="
