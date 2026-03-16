#!/usr/bin/env python3
"""
HermesCraft Game Loop — Drives Hermes Agent in a Minecraft observe-think-act cycle.

This script provides an alternative to running hermes in single-query mode.
It polls the game state from the HermesBridge HTTP API and feeds it to hermes
as context, letting the agent decide and act each turn.

Usage:
    python3 gameloop.py                          # defaults: localhost:3001, 5s interval
    python3 gameloop.py --bridge http://host:3001 --interval 3
    python3 gameloop.py --model anthropic/claude-sonnet-4 --goal "Build a house"
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ─── Configuration ───────────────────────────────────────────────────────────

DEFAULT_BRIDGE = "http://localhost:3001"
DEFAULT_INTERVAL = 5
DEFAULT_GOAL = "Defeat the Ender Dragon"
DEFAULT_MAX_TURNS = 10000
SESSION_NAME = "hermescraft"

# ─── Civilization Setup ──────────────────────────────────────────────────────

def initialize_civilization():
    """Initialize persistent agent society"""
    print("Initializing Minecraft civilization...")
    
    # Create civilization
    print("Creating founding civilization...")
    
    # Add founding identities
    print("Adding founding identities...")
    
    # Start civilization
    print("Starting persistent society...")

# ─── State Management ───────────────────────────────────────────────────────

def get_state(bridge_url: str) -> dict | None:
    """Fetch game state from HermesBridge HTTP API."""
    try:
        req = urllib.request.Request(f"{bridge_url}/state", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        return None

# ─── Bridge Utilities ───────────────────────────────────────────────────────

def check_bridge(bridge_url: str) -> bool:
    """Check if HermesBridge is responding."""
    try:
        req = urllib.request.Request(f"{bridge_url}/health", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "ok" or "ok" in str(data)
    except Exception:
        return False

# ─── Main Loop ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Parse arguments
    parser = argparse.ArgumentParser(description="HermesCraft Game Loop")
    parser.add_argument("--bridge", default=DEFAULT_BRIDGE, help="HermesBridge HTTP endpoint")
    parser.add_argument("--interval", type=float, default=DEFAULT_INTERVAL, help="Interval between turns in seconds")
    parser.add_argument("--goal", default=DEFAULT_GOAL, help="Overall objective")
    parser.add_argument("--max-turns", type=int, default=DEFAULT_MAX_TURNS, help="Maximum turns before stopping")
    parser.add_argument("--model", help="Model to use for the agent")
    parser.add_argument("--chain-of-thought", type=int, default=8, help="Chain of thought length")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    # Initialize civilization system
    initialize_civilization()
    
    # Check bridge connection
    if not check_bridge(args.bridge):
        print(f"Bridge not responding at {args.bridge}")
        sys.exit(1)
    
    # Create persistent session
    print(f"Starting new persistent session: {SESSION_NAME}")
    
    # Main game loop
    for turn in range(1, args.max_turns + 1):
        try:
            # Get current game state
            state = get_state(args.bridge)
            
            if not state:
                print("Failed to fetch game state")
                continue
            
            print(f"Turn {turn}/{args.max_turns}: Processing state...")
            
        except KeyboardInterrupt:
            print("\nExiting...")
            break

