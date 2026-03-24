#!/bin/bash
# start-stack.sh — Launch entire HermesCraft stack on RunPod pod
# Order: MC server → Model servers → Agents
# Usage: ./infra/start-stack.sh [mc_host] [mc_port]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MC_HOST="${1:-localhost}"
MC_PORT="${2:-25565}"

echo "============================================"
echo "  HermesCraft — Full Stack Launcher"
echo "============================================"
echo "  MC Server:  $MC_HOST:$MC_PORT"
echo "  Main Brain: localhost:8000 (llama-server)"
echo "============================================"
echo ""

# ── Load env ──
if [ -f "$PROJECT_DIR/.env.runpod" ]; then
    set -a
    source "$PROJECT_DIR/.env.runpod"
    set +a
    echo "[stack] Loaded .env.runpod"
fi
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    echo "[stack] Loaded .env (override)"
fi

# ── Step 1: Minecraft Server ──
echo ""
echo "── Step 1: Minecraft Server ──"
if docker ps --format '{{.Names}}' | grep -q hermescraft-server; then
    echo "[stack] MC server already running"
else
    echo "[stack] Starting Paper MC server..."
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.runpod.yml up -d
    echo "[stack] Waiting for MC server to be ready..."
    # Wait for server to accept connections (up to 120s)
    for i in $(seq 1 24); do
        if docker exec hermescraft-server rcon-cli "list" 2>/dev/null | grep -q "players"; then
            echo "[stack] MC server ready on port $MC_PORT"
            break
        fi
        echo "[stack]   Waiting... ($((i*5))s)"
        sleep 5
    done
fi

# ── Step 2: Model Servers ──
echo ""
echo "── Step 2: Model Servers ──"
MAIN_OK=$(curl -sf http://localhost:8000/health 2>/dev/null && echo "yes" || echo "no")

if [ "$MAIN_OK" = "yes" ]; then
    echo "[stack] Model server already running"
else
    echo "[stack] Starting model servers..."
    nohup "$SCRIPT_DIR/start-models.sh" > /workspace/model-server.log 2>&1 &
    MODEL_PID=$!
    echo "[stack] Model startup PID: $MODEL_PID (log: /workspace/model-server.log)"
    echo "[stack] Waiting for model to be healthy..."
    # Wait for main brain
    until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
    echo "[stack] Main brain (port 8000) ready"
fi

# ── Step 3: Agents ──
echo ""
echo "── Step 3: Agents (Luna & Max) ──"
echo "[stack] Launching agents via launch-duo.sh..."
cd "$PROJECT_DIR"
./launch-duo.sh "$MC_HOST" "$MC_PORT"

echo ""
echo "============================================"
echo "  HermesCraft Stack — All Systems Running"
echo "============================================"
echo "  MC Server:    docker (port $MC_PORT)"
echo "  Main Brain:   localhost:8000 (Qwen3.5-35B-A3B)"
echo "  Agents:       tmux attach -t hermescraft-duo"
echo ""
echo "  Logs:"
echo "    Model servers: tail -f /workspace/model-server.log"
echo "    MC server:     docker logs -f hermescraft-server"
echo "    Agents:        tmux attach -t hermescraft-duo"
echo "============================================"
