#!/bin/bash
# setup-pod.sh — Install all dependencies on a fresh RunPod pod
# Run once after pod creation. Idempotent — safe to re-run.
set -e

echo "=== HermesCraft Pod Setup ==="

# ── Docker (for MC server) ──
if ! command -v docker &>/dev/null; then
    echo "[setup] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker || true
else
    echo "[setup] Docker already installed"
fi

# ── Docker Compose ──
if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
    echo "[setup] Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
else
    echo "[setup] Docker Compose already installed"
fi

# ── Node.js 20 via nvm ──
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    echo "[setup] Installing Node.js 20 via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
else
    echo "[setup] Node.js $(node -v) already installed"
fi

# ── tmux (for agent sessions) ──
if ! command -v tmux &>/dev/null; then
    echo "[setup] Installing tmux..."
    apt-get update && apt-get install -y tmux
else
    echo "[setup] tmux already installed"
fi

# ── Python packages for model download ──
pip install -q huggingface_hub vllm 2>/dev/null || pip3 install -q huggingface_hub vllm

# ── llama-server (llama.cpp with CUDA) ──
if ! command -v llama-server &>/dev/null; then
    echo "[setup] Installing llama-server..."
    # Try pre-built binary first
    LLAMA_URL="https://github.com/ggerganov/llama.cpp/releases/latest/download/llama-server-linux-cuda12-x86_64.tar.gz"
    if curl -sfL "$LLAMA_URL" | tar xz -C /usr/local/bin/ 2>/dev/null; then
        echo "[setup] llama-server installed from pre-built binary"
    else
        echo "[setup] Pre-built binary not found, building from source..."
        apt-get update && apt-get install -y cmake build-essential
        git clone --depth 1 https://github.com/ggerganov/llama.cpp /tmp/llama.cpp
        cd /tmp/llama.cpp && cmake -B build -DGGML_CUDA=ON && cmake --build build --target llama-server -j$(nproc)
        cp build/bin/llama-server /usr/local/bin/
        rm -rf /tmp/llama.cpp
    fi
    llama-server --version && echo "[setup] llama-server ready" || echo "[setup] WARNING: llama-server version check failed"
else
    echo "[setup] llama-server already installed"
fi

# ── Download model weights to network volume ──
MODEL_DIR="${MODEL_DIR:-/models}"
mkdir -p "$MODEL_DIR"

MAIN_MODEL="$MODEL_DIR/qwen35-27b-heretic-q6_k.gguf"
if [ ! -f "$MAIN_MODEL" ]; then
    echo "[setup] Downloading main brain model (~22 GB)..."
    huggingface-cli download \
        llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1-GGUF \
        --include "*q6_k*" \
        --local-dir "$MODEL_DIR/"
    # Rename to expected path if needed
    GGUF_FILE=$(ls "$MODEL_DIR"/*q6_k*.gguf 2>/dev/null | head -1)
    if [ -n "$GGUF_FILE" ] && [ "$GGUF_FILE" != "$MAIN_MODEL" ]; then
        mv "$GGUF_FILE" "$MAIN_MODEL"
    fi
    echo "[setup] Main brain model downloaded: $(ls -lh "$MAIN_MODEL" | awk '{print $5}')"
else
    echo "[setup] Main brain model already exists: $(ls -lh "$MAIN_MODEL" | awk '{print $5}')"
fi

SECONDARY_DIR="$MODEL_DIR/Qwen3.5-9B"
if [ ! -d "$SECONDARY_DIR" ] || [ -z "$(ls -A "$SECONDARY_DIR" 2>/dev/null)" ]; then
    echo "[setup] Downloading secondary brain model (~9 GB)..."
    huggingface-cli download Qwen/Qwen3.5-9B --local-dir "$SECONDARY_DIR/"
    echo "[setup] Secondary brain model downloaded"
else
    echo "[setup] Secondary brain model already exists"
fi

echo ""
echo "=== Setup Complete ==="
echo "  Docker:       $(docker --version 2>/dev/null || echo 'not found')"
echo "  Node.js:      $(node -v 2>/dev/null || echo 'not found')"
echo "  llama-server: $(llama-server --version 2>/dev/null || echo 'not found')"
echo "  Models:       $MODEL_DIR"
echo ""
echo "Next: Clone repo, npm install, then run infra/start-stack.sh"
