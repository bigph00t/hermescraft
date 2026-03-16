# Companion Mode

Companion Mode is the personal-scale experience of HermesCraft: one embodied Hermes agent in your world.

## Goal

Make the agent feel like a real in-world friend, not a detached chatbot and not a benchmark bot.

## What matters most
- responsiveness to player chat
- helping with concrete gameplay tasks
- remembering preferences and corrections
- fair environment understanding
- using vision when layout/build quality matters

## Good demo beats
- player asks for a house and the agent surveys before building
- agent remembers a prior preference (style, placement, caution)
- natural back-and-forth chat while surviving together
- the agent uses `mc scene` or `mc screenshot_meta` before making a spatial judgment

## Launch

Quickest Steve-only launcher:

```bash
./start-steve.sh
```

Generic single-agent launcher:

```bash
MC_PORT=12345 ./hermescraft.sh
```

## Good prompts
- build me a small starter house here
- follow me and keep me safe
- gather wood while I mine stone
- help me organize this base
- what do you think this area needs?

## Companion quality checklist
- does it answer in chat quickly?
- does it avoid blocking long tasks when the player is speaking?
- does it build on the ground and verify layout?
- does it admit uncertainty when it cannot see something?
- does it feel like it is playing with the human, not just executing commands?
