#!/bin/bash

# Hermescraft Civilization Startup
# Initializes and starts persistent agent societies

# Configuration
SESSION_NAME="hermescraft"
CIVILIZATION_NAME="EternalCity"

# Initialize civilization
source ~/.bashrc
export PERSONA="~/Desktop/hermescraft/SOUL-steve.md"

echo "Starting Hermescraft Civilization..."

# Create civilization
echo "Creating $CIVILIZATION_NAME..."

# Add founding identities
echo "Adding founding identities..."

# Start society
echo "Starting persistent society operations..."

# Launch game loop
python3 ~/Desktop/hermescraft/gameloop.py \
    --bridge "http://localhost:3001" \
    --interval 3 \
    --goal "Build sustainable civilization" \
    --max-turns 1000000 \
    --chain-of-thought 9

echo "Civilization is now running autonomously"
