#!/bin/bash
set -euo pipefail
cd /opt/minecraft-server

echo "Downloading Minecraft 1.21.1 server..."
# MC 1.21.1 server jar URL from Mojang
curl -o server.jar https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar

echo "eula=true" > eula.txt
cp /opt/hermescraft/minecraft/server.properties .

echo "MC server installed. Start with: java -Xmx4G -jar server.jar nogui"
