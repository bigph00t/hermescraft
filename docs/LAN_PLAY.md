# LAN Play Workflow

Use this when you want to play HermesCraft in your own singleplayer world.

## Steps

1. Open your Minecraft world.
2. Use "Open to LAN".
3. Note the LAN port Minecraft gives you.
4. Launch either:

Single buddy:
```bash
MC_PORT=<LAN_PORT> ./hermescraft.sh
```

Landfolk cast (recommended stable path):
```bash
./scripts/run-landfolk-bots.sh <LAN_PORT>
# then launch each agent in its own terminal with scripts/run-landfolk-agent.sh
```

Civilization cast:
```bash
./civilization.sh --port <LAN_PORT>
```

## Recommendation

For actual playing, start with:
- `hermescraft.sh` if you want one close companion
- the direct Landfolk pattern (`run-landfolk-bots.sh` + `run-landfolk-agent.sh`) if you want a small cast of flavorful in-world characters

## Good in-game tests
- ask Steve to follow you
- ask Reed to show you where he wants the fishing shack
- ask Moss to make a path or garden area
- ask Flint for stone or cave scouting
- ask Ember to set up a hearth/forge corner

## Landmark sanity test
If you tell them something like "go inside the plane" or "head to the river", they should first inspect using their fair-perception tools instead of bluffing.
