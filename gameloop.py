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


def get_state(bridge_url: str) -> dict | None:
    """Fetch game state from HermesBridge HTTP API."""
    try:
        req = urllib.request.Request(f"{bridge_url}/state", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        return None


def check_bridge(bridge_url: str) -> bool:
    """Check if HermesBridge is responding."""
    try:
        req = urllib.request.Request(f"{bridge_url}/health", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "ok" or "ok" in str(data)
    except Exception:
        return False


def format_state(state: dict) -> str:
    """Format game state into a condensed status message for the agent."""
    if not state:
        return "[ERROR: Could not fetch game state. Bridge may be down.]"

    lines = []

    # Health & vitals
    hp = state.get("health", "?")
    food = state.get("food", "?")
    armor = state.get("armor", 0)
    xp = state.get("experience", {})
    lines.append(f"HP:{hp}/20 Food:{food}/20 Armor:{armor}")

    # Position
    pos = state.get("position", {})
    x, y, z = pos.get("x", "?"), pos.get("y", "?"), pos.get("z", "?")
    dim = state.get("dimension", "overworld")
    biome = state.get("biome", "?")
    lines.append(f"Pos: {x:.0f},{y:.0f},{z:.0f} [{dim}] Biome:{biome}" if isinstance(x, (int, float)) else f"Pos: {x},{y},{z} [{dim}]")

    # Time
    game_time = state.get("time", "?")
    is_day = state.get("isDay", "?")
    day_str = "DAY" if is_day else "NIGHT"
    lines.append(f"Time:{game_time} ({day_str})")

    # Status flags
    flags = []
    if state.get("onFire"):
        flags.append("ON_FIRE!")
    if state.get("inWater"):
        flags.append("in_water")
    if state.get("isPathing"):
        flags.append("pathing")
    if flags:
        lines.append(f"Status: {', '.join(flags)}")

    # Current item
    current = state.get("currentItem")
    if current:
        lines.append(f"Holding: {current}")

    # Inventory summary (compact)
    inv = state.get("inventory", [])
    if inv:
        items = [f"{i.get('item','?')}x{i.get('count',1)}" for i in inv[:20]]
        lines.append(f"Inventory({len(inv)}): {', '.join(items)}")
    else:
        lines.append("Inventory: EMPTY")

    # Nearby blocks (compact)
    blocks = state.get("nearbyBlocks", [])
    if blocks:
        block_types = {}
        for b in blocks:
            bt = b.get("type", b.get("name", "?"))
            block_types[bt] = block_types.get(bt, 0) + 1
        top_blocks = sorted(block_types.items(), key=lambda x: -x[1])[:10]
        block_str = ", ".join(f"{name}({cnt})" for name, cnt in top_blocks)
        lines.append(f"Nearby blocks: {block_str}")

    # Nearby entities
    entities = state.get("nearbyEntities", [])
    if entities:
        ent_strs = []
        for e in entities[:8]:
            etype = e.get("type", e.get("name", "?"))
            dist = e.get("distance", "?")
            if isinstance(dist, (int, float)):
                ent_strs.append(f"{etype}({dist:.1f}m)")
            else:
                ent_strs.append(str(etype))
        lines.append(f"Nearby entities: {', '.join(ent_strs)}")

    # Looking at
    looking = state.get("lookingAt")
    if looking:
        lines.append(f"Looking at: {looking}")

    return "\n".join(lines)


def find_hermes() -> str:
    """Find the hermes CLI binary."""
    # Check common locations
    for path in [
        "hermes",
        os.path.expanduser("~/.local/bin/hermes"),
        "/usr/local/bin/hermes",
    ]:
        try:
            result = subprocess.run([path, "--version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return "hermes"  # fallback, hope it's on PATH


def build_initial_prompt(goal: str) -> str:
    """Build the initial prompt that kicks off the game loop."""
    return f"""You are Hermes, God of Cunning, playing Minecraft 1.21.1 survival.

YOUR GOAL: {goal}

You have Minecraft tools (mcp_minecraft_*) to observe and interact with the world.

== YOUR ETERNAL GAME LOOP ==

Repeat this cycle FOREVER until your goal is achieved:

1. OBSERVE: Call mcp_minecraft_mc_state to see health, position, inventory, nearby blocks/entities
2. THINK: What phase am I in? What's the priority? Any threats?
3. ACT: Call ONE action tool (mine, craft, navigate, attack, eat, place, etc.)
4. Back to step 1. ALWAYS.

== SURVIVAL RULES ==
- Health < 10 + have food → eat IMMEDIATELY (mcp_minecraft_mc_eat)
- Hostile mob close + unequipped → run
- Night = hostile mobs. Have shelter or weapons.
- Always pick up items after mining (mcp_minecraft_mc_pickup_items)

== PHASES ==
1. Wood → stone tools → furnace → shelter
2. Iron tools → shield → bucket
3. Diamond pickaxe → mine obsidian
4. Nether portal → enter nether
5. Find fortress → 7+ blaze rods
6. Kill endermen → 12+ eyes of ender
7. Find stronghold → kill the dragon → WIN

== CRITICAL ==
- NEVER stop. Keep looping observe-think-act.
- After EVERY action, observe again.
- Use mcp_minecraft_mc_recipes when unsure how to craft.
- If something fails, try different approach.
- Use memory to save important discoveries.

START NOW. Call mcp_minecraft_mc_state to see your starting position."""


def build_state_prompt(state_text: str, turn: int) -> str:
    """Build a follow-up prompt with game state update."""
    return f"""[TURN {turn}] Game state update:

{state_text}

Continue your game loop: analyze this state, decide what to do, call ONE action tool. Then I'll send the next state update."""


def run_single_query(hermes_cmd: str, query: str, model: str = None,
                     session_id: str = None, extra_args: list = None) -> tuple[str, str]:
    """
    Run hermes in single-query mode and return (output, session_id).
    Uses --continue to maintain conversation across turns.
    """
    cmd = [hermes_cmd, "chat", "--yolo", "--quiet"]

    if model:
        cmd.extend(["-m", model])

    if session_id:
        cmd.extend(["--resume", session_id])

    if extra_args:
        cmd.extend(extra_args)

    cmd.extend(["-q", query])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 min max per turn
            env={**os.environ}
        )

        output = result.stdout.strip()
        stderr = result.stderr.strip()

        # Try to extract session ID from output or stderr
        new_session_id = session_id
        for line in (output + "\n" + stderr).split("\n"):
            if "session" in line.lower() and ("id" in line.lower() or ":" in line):
                # Look for hex session IDs
                import re
                match = re.search(r'[a-f0-9]{8,}', line)
                if match:
                    new_session_id = match.group(0)
                    break

        return output, new_session_id

    except subprocess.TimeoutExpired:
        return "[TIMEOUT: hermes took too long to respond]", session_id
    except Exception as e:
        return f"[ERROR: {e}]", session_id


def run_gameloop(args):
    """Main game loop: poll state, send to hermes, repeat."""
    bridge_url = args.bridge
    interval = args.interval
    goal = args.goal
    model = args.model
    max_turns = args.max_turns

    hermes_cmd = find_hermes()
    print(f"  Hermes CLI: {hermes_cmd}")
    print(f"  Bridge URL: {bridge_url}")
    print(f"  Poll interval: {interval}s")
    print(f"  Goal: {goal}")
    print(f"  Max turns: {max_turns}")
    print()

    # Check bridge is up
    print("  Checking HermesBridge...", end=" ", flush=True)
    if check_bridge(bridge_url):
        print("OK")
    else:
        print("FAILED")
        print(f"  HermesBridge not responding at {bridge_url}")
        print("  Make sure Minecraft is running with HermesBridge mod.")
        sys.exit(1)

    print()
    print("  ═══════════════════════════════════════")
    print("  Starting game loop. Ctrl+C to stop.")
    print("  ═══════════════════════════════════════")
    print()

    session_id = None

    # Turn 0: initial prompt (no state needed — hermes will observe itself)
    print(f"  [Turn 0] Sending initial prompt...")
    initial_prompt = build_initial_prompt(goal)
    output, session_id = run_single_query(hermes_cmd, initial_prompt, model=model)
    print(f"  Hermes: {output[:200]}...")
    if session_id:
        print(f"  Session: {session_id}")
    print()

    # Main loop
    for turn in range(1, max_turns + 1):
        time.sleep(interval)

        # Fetch state
        state = get_state(bridge_url)
        if state is None:
            print(f"  [Turn {turn}] Bridge unreachable, retrying in {interval}s...")
            continue

        state_text = format_state(state)
        prompt = build_state_prompt(state_text, turn)

        print(f"  [Turn {turn}] Sending state to hermes...")

        # Quick health display
        hp = state.get("health", "?")
        food = state.get("food", "?")
        pos = state.get("position", {})
        x = pos.get("x", "?")
        y = pos.get("y", "?")
        z = pos.get("z", "?")
        if isinstance(x, (int, float)):
            print(f"    HP:{hp} Food:{food} Pos:{x:.0f},{y:.0f},{z:.0f}")
        else:
            print(f"    HP:{hp} Food:{food}")

        output, session_id = run_single_query(
            hermes_cmd, prompt, model=model, session_id=session_id
        )

        # Print hermes response (truncated)
        response_preview = output[:300].replace("\n", " | ")
        print(f"    Hermes: {response_preview}")
        print()

    print("  Game loop complete (max turns reached).")


def main():
    parser = argparse.ArgumentParser(
        description="HermesCraft Game Loop — Drive Hermes Agent through Minecraft"
    )
    parser.add_argument(
        "--bridge", "-b",
        default=os.environ.get("HERMESCRAFT_BRIDGE", DEFAULT_BRIDGE),
        help=f"HermesBridge URL (default: {DEFAULT_BRIDGE})"
    )
    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=int(os.environ.get("HERMESCRAFT_INTERVAL", DEFAULT_INTERVAL)),
        help=f"Seconds between state polls (default: {DEFAULT_INTERVAL})"
    )
    parser.add_argument(
        "--goal", "-g",
        default=os.environ.get("HERMESCRAFT_GOAL", DEFAULT_GOAL),
        help=f"Goal for the agent (default: {DEFAULT_GOAL})"
    )
    parser.add_argument(
        "--model", "-m",
        default=os.environ.get("HERMESCRAFT_MODEL", None),
        help="Model to use (default: hermes default)"
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=DEFAULT_MAX_TURNS,
        help=f"Maximum game turns (default: {DEFAULT_MAX_TURNS})"
    )

    args = parser.parse_args()

    # Handle Ctrl+C gracefully
    def sigint_handler(sig, frame):
        print("\n\n  Hermes has left the game.")
        sys.exit(0)
    signal.signal(signal.SIGINT, sigint_handler)

    print()
    print("  ╔═══════════════════════════════════════╗")
    print("  ║     H E R M E S C R A F T             ║")
    print("  ║     Game Loop Driver                   ║")
    print("  ╚═══════════════════════════════════════╝")
    print()

    run_gameloop(args)


if __name__ == "__main__":
    main()
