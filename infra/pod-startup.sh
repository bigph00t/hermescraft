#!/bin/bash
# pod-startup.sh — Persistent startup script for RunPod pod
# Sources all tools from /workspace so everything survives pod pause/resume
# Usage: source /workspace/hermescraft/infra/pod-startup.sh

echo "=== HermesCraft Pod Startup ==="

# Node.js via nvm
export NVM_DIR=/workspace/.nvm
source "$NVM_DIR/nvm.sh"
echo "  Node: $(node --version)"

# Python venv
source /workspace/venv/bin/activate
echo "  Python: $(python3 --version)"

# Java 21
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
echo "  Java: $(java -version 2>&1 | head -1)"

# llama.cpp
export PATH="/workspace/llama.cpp/build/bin:$PATH"
echo "  llama-server: $(which llama-server)"

# CUDA
export PATH="/usr/local/cuda-11.8/bin:$PATH"
export LD_LIBRARY_PATH="/usr/local/cuda-11.8/lib64:${LD_LIBRARY_PATH:-}"

# Model paths
export MODEL_DIR=/workspace/models
export MAIN_MODEL="$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf"
export MMPROJ="$MODEL_DIR/mmproj-F16.gguf"
export PIPER_VOICES_DIR="$MODEL_DIR/piper"

# HermesCraft paths
export HC_DIR=/workspace/hermescraft
export MC_DIR=/workspace/mcserver

# Agent config
export VLLM_URL="http://localhost:8000/v1"
export MODEL_NAME="Qwen3.5-35B-A3B"
export MAX_TOKENS=128
export TICK_MS=2000
export TEMPERATURE=0.6

echo ""
echo "=== Environment Ready ==="
echo "  Model: $MAIN_MODEL"
echo "  MC Server: $MC_DIR"
echo "  Agent Code: $HC_DIR"
echo ""
echo "Commands:"
echo "  start-model    — Launch llama-server"
echo "  start-mc       — Launch Paper MC server"
echo "  start-tts      — Launch TTS bridge"
echo "  start-agents   — Launch 8 agents"
echo ""

# Helper aliases
alias start-model="nohup llama-server -m \$MAIN_MODEL --mmproj \$MMPROJ --port 8000 -ngl 99 --served-model-name Qwen3.5-35B-A3B -n 128 --ctx-size 8192 -t 4 > /workspace/llama.log 2>&1 & echo 'llama-server started (PID \$!)'"
alias start-mc="cd \$MC_DIR && nohup \$JAVA_HOME/bin/java -Xmx4G -jar paper.jar --nogui > /workspace/mc.log 2>&1 & echo 'MC server started (PID \$!)'"
alias start-tts="cd \$HC_DIR && nohup /workspace/venv/bin/python3 infra/tts-bridge.py > /workspace/tts.log 2>&1 & echo 'TTS bridge started (PID \$!)'"
alias start-agents="cd \$HC_DIR && bash launch-agents.sh"
