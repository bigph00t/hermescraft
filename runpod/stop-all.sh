#!/bin/bash
# Stop all HermesCraft services
if [ -f /tmp/hermescraft-pids ]; then
  read VLLM_PID MC_PID AGENT_PID < /tmp/hermescraft-pids
  kill $AGENT_PID 2>/dev/null && echo "Agent stopped"
  kill $MC_PID 2>/dev/null && echo "MC server stopped"
  kill $VLLM_PID 2>/dev/null && echo "vLLM stopped"
  rm /tmp/hermescraft-pids
else
  echo "No PID file found. Killing by name..."
  pkill -f "node agent/index.js" 2>/dev/null
  pkill -f "server.jar" 2>/dev/null
  pkill -f "vllm" 2>/dev/null
fi
echo "All stopped."
