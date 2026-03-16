# How to Play as Steve in Minecraft

## Quick Start

1. **Start your Minecraft server** (make sure it's running)
2. **Run the Steve setup script:**
   ```bash
   cd ~/Desktop/hermescraft
   ./steve-start.sh
   ```

3. **Begin playing as Steve:**
   ```bash
   hermes chat --personas "~/Desktop/hermescraft/SOUL-steve.md"
   ```

## Key Steve Commands During Play

- **Check game state:** `mc status`  
- **Read Alex's messages:** `mc read_chat`
- **Move somewhere:** `mc goto 100 64 -200`
- **Mine resources:** `mc collect oak_log 5`
- **Craft items:** `mc craft diamond_pickaxe`
- **Follow Alex:** `mc follow Alex`
- **Build things:** `mc build house 10x10`
- **Respond to Alex:** `mc chat "On my way!"`

## Important Reminders

- Steve is Alex's buddy - check chat frequently and respond
- Use background tasks (`mc bg_collect`) for long operations so you can stay responsive
- Save lessons to memory when you learn something new
- Have fun playing alongside Alex!

## Files Created

- `~/Desktop/hermescraft/steve-start.sh` - Setup script
- `~/Desktop/hermescraft/SOUL-steve.md` - Steve's personality and gameplay guide
- `~/Desktop/hermescraft/START-STEVE.md` - This quick reference guide

## Troubleshooting

- Make sure your Minecraft server is running
- Check that Hermes bridge is properly configured
- Verify MCP tools are working with `hermes tools list`

Steve is ready to play Minecraft with you!
