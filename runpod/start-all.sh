#!/bin/bash
# Start all HermesCraft services

# 1. Start vLLM
echo "[1/5] Starting vLLM..."
vllm serve NousResearch/Hermes-4.3-Llama-3.3-36B-AWQ \
  --host 0.0.0.0 --port 8000 \
  --max-model-len 8192 \
  --quantization awq \
  --gpu-memory-utilization 0.6 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes &
VLLM_PID=$!

# Wait for vLLM
echo "Waiting for vLLM to load model..."
until curl -s localhost:8000/v1/models > /dev/null 2>&1; do sleep 5; done
echo "vLLM ready!"

# 2. Start MC server
echo "[2/5] Starting Minecraft server..."
cd /opt/minecraft-server
java -Xmx4G -Xms2G -jar server.jar nogui &
MC_SERVER_PID=$!
sleep 15

# 3. Start MC client (must be on virtual desktop)
echo "[3/5] Start MC client manually via noVNC desktop"
echo "  → Open Prism Launcher, launch 1.21.1 with Fabric + HermesBridge + Baritone"

# 4. Start agent
echo "[4/5] Starting HermesCraft agent..."
cd /opt/hermescraft
node agent/index.js &
AGENT_PID=$!

# 5. Start OBS (must be on virtual desktop)
echo "[5/5] Start OBS manually via noVNC desktop"
echo "  → Import scene from config/obs-scene.json"
echo "  → Set RTMP output to your streaming platform URL"

echo ""
echo "=== All services started ==="
echo "vLLM PID: $VLLM_PID"
echo "MC Server PID: $MC_SERVER_PID"
echo "Agent PID: $AGENT_PID"
echo ""
echo "PIDs saved to /tmp/hermescraft-pids"
echo "$VLLM_PID $MC_SERVER_PID $AGENT_PID" > /tmp/hermescraft-pids
