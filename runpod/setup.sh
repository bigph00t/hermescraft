#!/bin/bash
set -euo pipefail
# HermesCraft RunPod Setup — A6000 48GB with RunPod Desktop template

echo "=== HermesCraft RunPod Setup ==="

# Java 21
apt update && apt install -y openjdk-21-jre-headless openjdk-21-jdk

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# vLLM
pip install vllm

# OBS Studio
apt install -y obs-studio ffmpeg

# Fabric installer
mkdir -p /opt/fabric && cd /opt/fabric
curl -OJ https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar

# Minecraft directories
mkdir -p /opt/minecraft-server /opt/minecraft-client

echo "=== Setup complete. Run start-all.sh to launch ==="
