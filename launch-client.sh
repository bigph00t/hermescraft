#!/usr/bin/env bash
# launch-client.sh — Launch a headless MC 1.21.1 Fabric client on Glass
# Usage: ./launch-client.sh <username> <bridge_port> <display_number>
#
# Each bot gets its own Xvfb display and HermesBridge HTTP port.
# The mod reads HERMESCRAFT_PORT to bind its HTTP API.
set -euo pipefail

USERNAME="${1:?Usage: $0 <username> <bridge_port> <display_number>}"
BRIDGE_PORT="${2:?Usage: $0 <username> <bridge_port> <display_number>}"
DISPLAY_NUM="${3:?Usage: $0 <username> <bridge_port> <display_number>}"

MC_VERSION="1.21.1"
MC_DIR="$HOME/.minecraft"
VERSIONS_DIR="$MC_DIR/versions"
NATIVES_DIR="$VERSIONS_DIR/$MC_VERSION/natives"
ASSETS_DIR="$MC_DIR/assets"
LIBRARIES_DIR="$MC_DIR/libraries"
VERSION_JSON="$VERSIONS_DIR/$MC_VERSION/$MC_VERSION.json"
FABRIC_VERSION_DIR=$(find "$VERSIONS_DIR" -maxdepth 1 -name "fabric-loader-*-$MC_VERSION" -type d | head -1)

# Validate
if [ -z "$FABRIC_VERSION_DIR" ]; then
    echo "ERROR: No Fabric loader found for MC $MC_VERSION in $VERSIONS_DIR"
    echo "Install Fabric for $MC_VERSION first."
    exit 1
fi

FABRIC_VERSION=$(basename "$FABRIC_VERSION_DIR")
FABRIC_JSON="$FABRIC_VERSION_DIR/$FABRIC_VERSION.json"

if [ ! -f "$VERSION_JSON" ]; then
    echo "ERROR: Version JSON not found at $VERSION_JSON"
    exit 1
fi

if [ ! -f "$FABRIC_JSON" ]; then
    echo "ERROR: Fabric JSON not found at $FABRIC_JSON"
    exit 1
fi

# ── Start Xvfb if not already running on this display ──
if ! pgrep -f "Xvfb :$DISPLAY_NUM" > /dev/null 2>&1; then
    echo "[launch-client] Starting Xvfb on :$DISPLAY_NUM"
    Xvfb ":$DISPLAY_NUM" -screen 0 854x480x24 -ac +extension GLX &
    sleep 1
else
    echo "[launch-client] Xvfb :$DISPLAY_NUM already running"
fi

# ── Build classpath using Python helper ──
# /tmp/build_cp.py parses the version JSON and Fabric JSON to produce
# a colon-delimited classpath. If it doesn't exist, we build it inline.
CP_BUILDER="/tmp/build_cp.py"
if [ -f "$CP_BUILDER" ]; then
    CLASSPATH=$(python3 "$CP_BUILDER" "$FABRIC_JSON" "$VERSION_JSON" "$LIBRARIES_DIR")
else
    echo "[launch-client] build_cp.py not found, building classpath inline..."
    CLASSPATH=$(python3 -c "
import json, os, sys

def libs_from_json(path, lib_dir):
    with open(path) as f:
        data = json.load(f)
    jars = []
    for lib in data.get('libraries', []):
        name = lib.get('name', '')
        # Parse Maven coordinates: group:artifact:version
        parts = name.split(':')
        if len(parts) >= 3:
            group, artifact, version = parts[0], parts[1], parts[2]
            group_path = group.replace('.', '/')
            jar_name = f'{artifact}-{version}.jar'
            jar_path = os.path.join(lib_dir, group_path, artifact, version, jar_name)
            if os.path.exists(jar_path):
                jars.append(jar_path)
        # Also check for direct url/path entries
        downloads = lib.get('downloads', {})
        artifact_info = downloads.get('artifact', {})
        if 'path' in artifact_info:
            jar_path = os.path.join(lib_dir, artifact_info['path'])
            if os.path.exists(jar_path) and jar_path not in jars:
                jars.append(jar_path)
    return jars

fabric_json = '$FABRIC_JSON'
vanilla_json = '$VERSION_JSON'
lib_dir = '$LIBRARIES_DIR'

jars = libs_from_json(fabric_json, lib_dir) + libs_from_json(vanilla_json, lib_dir)
# Add the vanilla client jar
client_jar = os.path.join('$VERSIONS_DIR', '$MC_VERSION', '$MC_VERSION.jar')
if os.path.exists(client_jar):
    jars.append(client_jar)
# Deduplicate while preserving order
seen = set()
unique = []
for j in jars:
    if j not in seen:
        seen.add(j)
        unique.append(j)
print(':'.join(unique))
")
fi

if [ -z "$CLASSPATH" ]; then
    echo "ERROR: Failed to build classpath"
    exit 1
fi

# ── Determine main class from Fabric JSON ──
MAIN_CLASS=$(python3 -c "
import json
with open('$FABRIC_JSON') as f:
    data = json.load(f)
print(data.get('mainClass', 'net.fabricmc.loader.impl.launch.knot.KnotClient'))
")

# ── Extract asset index from vanilla JSON ──
ASSET_INDEX=$(python3 -c "
import json
with open('$VERSION_JSON') as f:
    data = json.load(f)
print(data.get('assetIndex', {}).get('id', '$MC_VERSION'))
")

# ── Ensure natives directory exists ──
mkdir -p "$NATIVES_DIR"

# ── Mods directory (shared across all clients — same mods) ──
MODS_DIR="$MC_DIR/mods"
mkdir -p "$MODS_DIR"

echo "[launch-client] Launching MC client: $USERNAME (port=$BRIDGE_PORT, display=:$DISPLAY_NUM)"
echo "[launch-client] Fabric version: $FABRIC_VERSION"
echo "[launch-client] Main class: $MAIN_CLASS"
echo "[launch-client] Asset index: $ASSET_INDEX"

# ── Launch Minecraft ──
export DISPLAY=":$DISPLAY_NUM"
export HERMESCRAFT_PORT="$BRIDGE_PORT"

exec java \
    -Xmx1G \
    -Xms512M \
    -Djava.library.path="$NATIVES_DIR" \
    -Dorg.lwjgl.util.NoChecks=true \
    -cp "$CLASSPATH" \
    "$MAIN_CLASS" \
    --username "$USERNAME" \
    --version "$FABRIC_VERSION" \
    --gameDir "$MC_DIR" \
    --assetsDir "$ASSETS_DIR" \
    --assetIndex "$ASSET_INDEX" \
    --accessToken 0 \
    --userType legacy \
    --versionType release \
    --quickPlayMultiplayer "localhost:25565"
