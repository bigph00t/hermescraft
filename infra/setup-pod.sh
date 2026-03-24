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
pip install -q huggingface_hub 2>/dev/null || pip3 install -q huggingface_hub

# ── Piper TTS (CPU-only text-to-speech for agent voices) ──
echo "[setup] Installing Piper TTS and audio dependencies..."
pip install -q piper-tts scipy 2>/dev/null || pip3 install -q piper-tts scipy

# ── Download Piper voice models (8 voices ~600MB total) ──
PIPER_DIR="${MODEL_DIR:-/models}/piper"
mkdir -p "$PIPER_DIR"

# Voice models to download from rhasspy/piper-voices on HuggingFace
PIPER_VOICES=(
    "en/en_US/kristin/medium/en_US-kristin-medium"
    "en/en_US/ryan/high/en_US-ryan-high"
    "en/en_US/amy/medium/en_US-amy-medium"
    "en/en_US/arctic/medium/en_US-arctic-medium"
    "en/en_US/hfc_female/medium/en_US-hfc_female-medium"
    "en/en_US/norman/medium/en_US-norman-medium"
    "en/en_US/lessac/high/en_US-lessac-high"
    "en/en_US/libritts_r/medium/en_US-libritts_r-medium"
)

for VOICE_PATH in "${PIPER_VOICES[@]}"; do
    VOICE_NAME="$(basename "$VOICE_PATH")"
    ONNX_FILE="$PIPER_DIR/${VOICE_NAME}.onnx"
    if [ ! -f "$ONNX_FILE" ]; then
        echo "[setup] Downloading Piper voice: $VOICE_NAME"
        python3 -c "
from huggingface_hub import hf_hub_download
hf_hub_download('rhasspy/piper-voices', filename='${VOICE_PATH}.onnx', local_dir='${PIPER_DIR}')
hf_hub_download('rhasspy/piper-voices', filename='${VOICE_PATH}.onnx.json', local_dir='${PIPER_DIR}')
" 2>/dev/null || echo "[setup] WARNING: Failed to download $VOICE_NAME"
    else
        echo "[setup] Piper voice already downloaded: $VOICE_NAME"
    fi
done

echo "[setup] Piper voices: $(ls "$PIPER_DIR"/*.onnx 2>/dev/null | wc -l) models downloaded"

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

MAIN_MODEL="$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf"
MMPROJ="$MODEL_DIR/mmproj-F16.gguf"

if [ ! -f "$MAIN_MODEL" ] || [ ! -f "$MMPROJ" ]; then
    echo "[setup] Downloading Qwen3.5-35B-A3B Q4_K_XL + mmproj (~22 GB total)..."
    huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF \
        --include "*UD-Q4_K_XL*" "*mmproj-F16*" \
        --local-dir "$MODEL_DIR/"
    ls -lh "$MODEL_DIR/"*UD-Q4_K_XL*.gguf 2>/dev/null || echo "[setup] WARNING: Q4_K_XL file not found after download"
    ls -lh "$MODEL_DIR/mmproj-F16.gguf" 2>/dev/null || echo "[setup] WARNING: mmproj file not found after download"
else
    echo "[setup] Qwen3.5-35B-A3B already downloaded: $(ls -lh "$MAIN_MODEL" | awk '{print $5}')"
fi

echo ""
echo "=== Setup Complete ==="
echo "  Docker:       $(docker --version 2>/dev/null || echo 'not found')"
echo "  Node.js:      $(node -v 2>/dev/null || echo 'not found')"
echo "  llama-server: $(llama-server --version 2>/dev/null || echo 'not found')"
echo "  Piper TTS:    $(pip show piper-tts 2>/dev/null | grep Version || echo 'not found')"
echo "  Piper voices: $(ls "${MODEL_DIR:-/models}/piper"/*.onnx 2>/dev/null | wc -l) models"
echo "  Models:       $MODEL_DIR"
echo ""
echo "Next: Clone repo, npm install, then run infra/start-stack.sh"
