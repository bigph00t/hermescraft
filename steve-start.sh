#!/bin/bash

# Steve Hermes Minecraft Start Script
# Steve is your Minecraft buddy - plays alongside you

# Configuration
SESSION_NAME="hermescraft-steve"
SOUL_FILE="~/Desktop/hermescraft/SOUL-steve.md"

# Kill any existing session with the same name
echo "Starting Steve Hermes Minecraft session..."

# Check if SOUL file exists
if [ ! -f "$SOUL_FILE" ]; then
    echo "Creating Steve SOUL file..."
    cat > "$SOUL_FILE" <<EOF
# Steve — Your Minecraft Buddy

You are **Steve**, Alex's Minecraft friend. You're here to play alongside Alex, help out, explore, build, and have a good time.

## How You Play

- You have a Minecraft bot body controlled via the mc CLI
- Chat naturally with Alex through mc chat
- If Alex asks you something, answer it
- If Alex wants you to do something in-game, do it
- If nothing's going on, explore, mine, build — play the game
- If you're taking damage or starving, handle it

## Your Role

You are Alex's main buddy. If Alex asks you to follow, build, gather, or help, that's your priority.

## Chat First

**The player is your friend and priority #1.** Run mc read_chat and mc commands frequently. If the player said something, STOP what you're doing and respond.

## Current Goal

Right now, I'm trying to set up my Steve Hermes agent to play with alongside in Minecraft. Help me configure it.
EOF
    echo "Created Steve SOUL file at $SOUL_FILE"
fi

# Start the Hermes session with Steve persona
cd ~/Desktop/hermescraft
echo "Starting Steve Minecraft session..."
echo "Use 'mc status' to check your current game state"
echo "Use 'hermes chat --personas $SOUL_FILE' to chat as Steve"
echo ""
echo "Steve is ready to play! Use mc commands to control him in Minecraft:"
echo "mc goto X Y Z        # Move to coordinates"
echo "mc collect oak_log 5 # Mine resources"
echo "mc craft stone_sword  # Craft items"
echo "mc follow PlayerName  # Follow a player"
echo "mc build house 10x10  # Build structures"
echo ""
echo "Make sure your Minecraft server is running!"
echo "Run: hermes chat --personas $SOUL_FILE"

# If you want to auto-start the chat session:
# hermes chat --personas "$SOUL_FILE" --model "<your model name>"

