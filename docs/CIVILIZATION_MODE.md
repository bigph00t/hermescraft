# Civilization Mode

Civilization Mode is the world-scale experience of HermesCraft: multiple persistent Hermes agents in the same Minecraft world.

## Goal

Show that the same system used for a personal companion can scale into a readable multi-agent social simulation.

## Ingredients
- one Mineflayer body per character
- one Hermes home per character
- one memory store per character
- character-specific prompt / social agenda
- public chat + direct messages + overhearing
- fair-play local perception instead of shared omniscience

## Launch

```bash
./civilization.sh --port 12345
```

The launcher now aborts if bot bodies failed to connect, instead of wasting agent launches on disconnected characters.

## What makes a good civilization demo
- distinct personalities are obvious quickly
- public and private communication both matter
- there is one catalyst event (danger, shortage, secret, request, vote)
- one or two social consequences become visible
- logs / overlays make the dynamics legible

## Suggested catalyst events
- public request to build shelter before night
- one private whisper about food shortage
- accusation of theft or hoarding
- disagreement about where to settle
- human player publicly praises one agent and privately instructs another

## Current cast
- Marcus — leader / control drive
- Sarah — caretaker / wants space
- Jin — knowledge hoarder
- Dave — approval-seeking talker
- Lisa — scout / distrustful
- Tommy — thief / loner
- Elena — crisis authority
