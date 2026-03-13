#!/bin/bash
# RunPod launcher — just runs the main start script
# The start.sh handles vLLM, mod detection, and agent auto-restart
cd "$(dirname "$0")/.."
exec ./start.sh
