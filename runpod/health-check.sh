#!/bin/bash
echo "=== HermesCraft Health Check ==="

# GPU
echo -n "GPU: "
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader

# vLLM
echo -n "vLLM: "
curl -s localhost:8000/v1/models | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK — {d[\"data\"][0][\"id\"]}')" 2>/dev/null || echo "DOWN"

# MC Server
echo -n "MC Server: "
if pgrep -f "server.jar" > /dev/null; then echo "OK"; else echo "DOWN"; fi

# HermesBridge mod
echo -n "HermesBridge: "
curl -s localhost:3001/health 2>/dev/null && echo "" || echo "DOWN"

# Agent
echo -n "Agent: "
if pgrep -f "agent/index.js" > /dev/null; then echo "OK"; else echo "DOWN"; fi

# OBS
echo -n "OBS: "
if pgrep -f "obs" > /dev/null; then echo "OK"; else echo "DOWN"; fi
