#!/usr/bin/env bash
# deploy-fresh.sh — Fresh world + fresh agents deployment
# Wipes server world, wipes agent data, starts MC server, launches Luna & Max
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  HermesCraft Fresh Deployment"
echo "============================================"
echo ""

# ── Step 1: Stop existing sessions ──
echo "[1/6] Stopping existing sessions..."
tmux kill-session -t hermescraft-duo 2>/dev/null && echo "  Killed hermescraft-duo" || echo "  No existing duo session"
docker stop hermescraft-server 2>/dev/null && echo "  Stopped MC server" || echo "  No existing MC server"
docker rm hermescraft-server 2>/dev/null && echo "  Removed MC container" || true

# ── Step 2: Wipe server world ──
echo ""
echo "[2/6] Wiping server world..."
if [ -d server-data ]; then
    rm -rf server-data/world server-data/world_nether server-data/world_the_end
    echo "  World data wiped"
else
    echo "  No server-data dir (fresh install)"
fi

# ── Step 3: Wipe agent data ──
echo ""
echo "[3/6] Wiping all agent data..."
rm -rf data/*
mkdir -p data/luna/sessions data/max/sessions
echo "  Created fresh data dirs: luna, max"

# ── Step 4: Install deps ──
echo ""
echo "[4/6] Checking Node dependencies..."
if [ ! -d node_modules ] || [ ! -d node_modules/mineflayer ]; then
    npm install
else
    echo "  Dependencies already installed"
fi

# ── Step 5: Start MC server ──
echo ""
echo "[5/6] Starting Minecraft server (Paper 1.21.1)..."
docker compose up -d
echo "  Waiting for server to be ready..."

# Wait for server to accept connections (up to 120s)
TRIES=0
while [ $TRIES -lt 40 ]; do
    if docker exec hermescraft-server mc-monitor status 2>/dev/null | grep -q "online"; then
        echo "  Server is ONLINE!"
        break
    fi
    TRIES=$((TRIES + 1))
    echo "  Starting... ($TRIES/40)"
    sleep 3
done

if [ $TRIES -ge 40 ]; then
    echo "  Server not ready after 120s — check: docker logs hermescraft-server"
    echo "  Proceeding anyway (agents will retry connection)..."
fi

# ── Step 6: Launch agents ──
echo ""
echo "[6/6] Launching Luna & Max..."
./launch-duo.sh

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "  MC Server: localhost:25565 (Paper 1.21.1)"
echo "  Agents: Luna (artist) + Max (engineer)"
echo ""
echo "  Monitor:"
echo "    tmux attach -t hermescraft-duo"
echo "    docker logs -f hermescraft-server"
echo ""
