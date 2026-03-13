#!/bin/bash
# Position terminal (left 40%) + Minecraft (right 60%) on 1024x768 KasmVNC desktop
# Run this after starting both terminal and Minecraft

SCREEN_W=1024
SCREEN_H=768
TERM_W=$((SCREEN_W * 40 / 100))  # 410
MC_W=$((SCREEN_W - TERM_W))       # 614

echo "Arranging windows for streaming..."

# Find terminal window
TERM_WID=$(xdotool search --name "Terminal" 2>/dev/null | head -1)
if [ -z "$TERM_WID" ]; then
  TERM_WID=$(xdotool search --name "terminal" 2>/dev/null | head -1)
fi
if [ -z "$TERM_WID" ]; then
  TERM_WID=$(xdotool search --name "bash" 2>/dev/null | head -1)
fi

if [ -n "$TERM_WID" ]; then
  xdotool windowsize "$TERM_WID" "$TERM_W" "$SCREEN_H"
  xdotool windowmove "$TERM_WID" 0 0
  echo "Terminal positioned: ${TERM_W}x${SCREEN_H} at (0,0)"
else
  echo "WARNING: Terminal window not found"
fi

# Find Minecraft window
MC_WID=$(xdotool search --name "Minecraft" 2>/dev/null | head -1)
if [ -n "$MC_WID" ]; then
  xdotool windowsize "$MC_WID" "$MC_W" "$SCREEN_H"
  xdotool windowmove "$MC_WID" "$TERM_W" 0
  echo "Minecraft positioned: ${MC_W}x${SCREEN_H} at (${TERM_W},0)"
else
  echo "WARNING: Minecraft window not found"
fi

echo "Stream layout ready!"
