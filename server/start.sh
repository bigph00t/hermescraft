#!/usr/bin/env bash
# Start HermesCraft Paper server — The Crash map
# Usage: ./start.sh [--reset]
set -euo pipefail
cd "$(dirname "$0")"

MAP_ZIP="${MAP_ZIP:-${HOME}/Documents/The Crash - By EmeBuilds(3).zip}"

if [ "${1:-}" = "--reset" ]; then
  echo "Resetting world to original Crash map..."
  [ -f "$MAP_ZIP" ] || { echo "Missing map zip. Set MAP_ZIP=/path/to/The Crash zip"; exit 1; }
  python3 -c "import nbtlib" >/dev/null 2>&1 || { echo "Missing python package nbtlib. Install with: pip install nbtlib"; exit 1; }
  rm -rf hermescraft-world/
  mkdir -p hermescraft-world
  unzip -q "$MAP_ZIP" -d /tmp/crash_extract/
  mv /tmp/crash_extract/The\ Crash\ -\ By\ EmeBuilds/* hermescraft-world/
  rm -rf /tmp/crash_extract/
  # Apply hardcore settings
  python3 -c "
import nbtlib
f = nbtlib.load('hermescraft-world/level.dat')
d = f['Data']
d['hardcore'] = nbtlib.Byte(1)
d['Difficulty'] = nbtlib.Byte(3)
d['GameType'] = nbtlib.Int(0)
gr = d['GameRules']
gr['doMobSpawning'] = nbtlib.String('true')
gr['doLimitedCrafting'] = nbtlib.String('false')
gr['doFireTick'] = nbtlib.String('true')
gr['pvp'] = nbtlib.String('true')
f.save()
print('  Hardcore mode enabled, mobs ON, limited crafting OFF')
"
  # Clear player data
  rm -rf hermescraft-world/playerdata/* hermescraft-world/advancements/* hermescraft-world/stats/*
  echo "World reset complete."
fi

echo "Starting Paper 1.21.11 (Hardcore) on port 12345..."
exec java -Xms2G -Xmx4G \
  -XX:+UseG1GC -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 \
  -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M \
  -jar paper.jar --nogui
