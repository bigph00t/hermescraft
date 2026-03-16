# HermesCraft Deep Audit Report
Generated: 2026-03-15

## 1. Every Action/Endpoint the Bot Supports

### GET Endpoints (Observation)
| Endpoint | Purpose |
|----------|---------|
| GET /health (or /) | Connection status, username, server address |
| GET /status | Full game state: health, food, position, dimension, biome, time, inventory, nearby blocks/entities, notable blocks, lookingAt, chat, deaths, weather |
| GET /inventory | Categorized inventory (tools/weapons/armor/food/materials/blocks/other) |
| GET /nearby?radius=N | Entities + block scan within radius (block scan capped at 16) |
| GET /chat?count=N&clear=bool | Recent chat messages (clears log by default!) |
| GET /commands | Pending player commands queued via in-game chat |
| GET /task | Background task status |

### POST Endpoints (Actions)
| Endpoint | Parameters | Purpose |
|----------|-----------|---------|
| POST /connect | none | (Re)connect bot to MC server |
| POST /action/goto | {x,y,z} | Pathfind to exact block |
| POST /action/goto_near | {x,y,z,range} | Pathfind near position |
| POST /action/follow | {player} | Continuous follow (GoalFollow, dynamic=true) |
| POST /action/look | {x,y,z} | Look at coordinates |
| POST /action/stop | none | Cancel pathfinder + stop digging + stop pvp |
| POST /action/collect | {block,count} | Find + mine blocks (max 20/batch), auto-pickup |
| POST /action/dig | {x,y,z} | Mine specific block at coords |
| POST /action/pickup | none | Walk to nearby item drops and collect |
| POST /action/find_blocks | {block,radius,count} | Search for block locations |
| POST /action/find_entities | {type,radius} | Search for entities nearby |
| POST /action/complete_command | {index} | Mark a queued player command as completed |
| POST /action/craft | {item,count} | Craft item (auto-finds crafting table within 4 blocks) |
| POST /action/recipes | {item} | Look up crafting recipe |
| POST /action/smelt | {input,fuel,count} | Smelt in nearby furnace (waits up to 30s) |
| POST /action/attack | {target} | Find + approach + single hit on mob/entity |
| POST /action/eat | none | Eat best food in inventory |
| POST /action/equip | {item,slot} | Equip item to hand/head/torso/legs/feet |
| POST /action/toss | {item,count} | Drop item (ignores count, tosses full stack!) |
| POST /action/place | {block,x,y,z} | Place block at position (finds adjacent reference block) |
| POST /action/interact | {x,y,z} | Right-click/activate block (chests, doors, buttons) |
| POST /action/close_screen | none | Close open GUI window |
| POST /action/chat | {message} | Send chat message |
| POST /action/wait | {seconds} | Sleep for N seconds (max 60) |
| POST /action/use | none | Use/activate held item |
| POST /action/sleep_bed | none | Sleep in nearby bed |
| POST /task/ACTION | same as action | Run any action as background task |
| POST /task/cancel | none | Cancel current background task |

**Total: 8 GET endpoints, 24 POST action endpoints, background task system**

## 2. Every mc CLI Command

### Observation Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc status | state, observe, s | GET /status |
| mc inventory | inv, i | GET /inventory |
| mc nearby [radius] | look, n | GET /nearby |
| mc read_chat [count] | messages, msg | GET /chat |
| mc health | h | GET /health |
| mc commands | cmds, queue | GET /commands |

### Movement Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc goto X Y Z | go, g | POST /action/goto |
| mc goto_near X Y Z [range] | near | POST /action/goto_near |
| mc follow PLAYER | f | POST /action/follow |
| mc look_at X Y Z | - | POST /action/look |
| mc stop | - | POST /action/stop |

### Mining Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc collect BLOCK [N] | mine, c | POST /action/collect |
| mc dig X Y Z | d | POST /action/dig |
| mc pickup | p | POST /action/pickup |
| mc find_blocks BLOCK [radius] [count] | find, fb | POST /action/find_blocks |
| mc find_entities [TYPE] [radius] | fe | POST /action/find_entities |

### Crafting Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc craft ITEM [N] | cr | POST /action/craft |
| mc recipes ITEM | recipe, r | POST /action/recipes |
| mc smelt INPUT [fuel] [count] | sm | POST /action/smelt |

### Combat/Survival Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc attack [target] | kill, a | POST /action/attack |
| mc eat | e | POST /action/eat |
| mc equip ITEM [slot] | eq | POST /action/equip |

### Building Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc place BLOCK X Y Z | pl | POST /action/place |
| mc interact X Y Z | use_block | POST /action/interact |
| mc close | - | POST /action/close_screen |

### Utility Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc chat "message" | say | POST /action/chat |
| mc use | u | POST /action/use |
| mc toss ITEM | drop | POST /action/toss |
| mc sleep | bed | POST /action/sleep_bed |
| mc wait [seconds] | w | POST /action/wait |
| mc connect | reconnect | POST /connect |

### Background Task Commands
| Command | Aliases | Maps To |
|---------|---------|---------|
| mc bg_collect BLOCK [N] | - | POST /task/collect |
| mc bg_goto X Y Z | - | POST /task/goto |
| mc bg ACTION '{json}' | - | POST /task/ACTION |
| mc task | - | GET /task |
| mc cancel | - | POST /task/cancel |

### Special Commands
| Command | Notes |
|---------|-------|
| mc screenshot (ss, look_around) | Uses xdotool + scrot to screenshot Minecraft window (X11 only) |
| mc complete_command [idx] (done) | Mark queued command as completed |
| mc help (--help, -h) | Show help |

**Total: ~35 distinct CLI commands**

## 3. All Failure Modes

### Pathfinder Failures
- **No path found**: `b.pathfinder.goto()` throws; caught by outer try/catch, returns 400 error with message. Bot stays at current position. No retry logic.
- **Pathfinder timeout**: No explicit timeout on pathfinding. A `goto` to an unreachable location could hang the synchronous endpoint indefinitely (HTTP timeout 300s in curl).
- **Path interrupted**: If the bot falls, gets pushed, or terrain changes mid-path, pathfinder may fail silently or throw.
- **Follow with missing player**: Returns "Player/entity not found nearby" error immediately.

### Craft Failures
- **Missing ingredients**: Returns error message, tries 3 recipe sources (no table, with table, recipesAll).
- **No crafting table**: Error says "Need a crafting table nearby". BUT: table must be within 4 blocks, no auto-approach.
- **Wrong item name**: "Unknown item" error with suggestion to check spelling.
- **recipesAll fallback**: May return recipes the bot can't actually craft (missing materials), leading to confusing errors at craft time.

### Bot Death
- **Death event**: Logged to deathLog with position. Bot auto-respawns (Mineflayer default).
- **No death notification to AI**: The AI only discovers death through `mc status` (deaths counter) or health changes. No proactive alert.
- **Inventory loss**: All items lost on death. No tracking of what was lost.
- **Death position**: Logged but not exposed in status endpoint (deathLog only shows count via `deaths` field).

### Server Disconnect
- **Kicked**: Sets botReady=false, logs reason. No auto-reconnect on kick!
- **Disconnected (end event)**: Sets botReady=false, auto-reconnects after 5 seconds via setTimeout.
- **Reconnect loop**: If server stays down, creates infinite reconnect attempts every 5 seconds (no backoff, no max retries).
- **During action**: Any in-flight action will throw "Bot not connected" on next ensureBot() call.

### Other Failure Modes
- **collect with swallowed errors**: The inner loop `catch {}` silently swallows ALL errors during mining individual blocks. Could fail on every block and report "Mined 0/5".
- **smelt timeout**: Waits up to 30s (count * 10s, capped). If smelting takes longer, returns "Smelting in progress" - but no way to check later without re-opening furnace.
- **attack is single-hit**: Only attacks once. For mobs with >1 hit of HP, the AI must call attack repeatedly. No combat loop.
- **toss ignores count**: `toss({item, count})` receives count but calls `b.tossStack(invItem)` which tosses the ENTIRE stack regardless.
- **place failure**: If no adjacent solid block exists, throws error. No scaffolding logic.
- **Background task overwrite**: Only ONE background task at a time. Starting a new one silently abandons the old one's tracking (old task result is lost).
- **Chat log clearing**: GET /chat clears the log by default (`clear !== 'false'`). If the AI reads chat, those messages are gone. Double-reads will miss messages.
- **HTTP body size**: No limit on request body parsing - potential memory issue.
- **No authentication**: HTTP API has no auth. Anyone on localhost can control the bot.
- **CORS wide open**: `Access-Control-Allow-Origin: *` on all responses.

## 4. Missing Capabilities (vs Real Minecraft Player)

### Combat
- **No sustained combat loop** - only single hits, no kiting, no strafing
- **No shield blocking** - can equip shield but can't raise it
- **No bow/crossbow aiming and shooting** - `use` activates but no aim control for projectiles
- **No critical hits** (jump-attack timing)
- **No sweep attacks**
- **PvP plugin disabled** (breaks pathfinder) - no player combat

### Movement
- **No jumping** - no explicit jump command
- **No swimming** - no underwater movement control
- **No sprinting toggle** - pathfinder allows sprint but no manual sprint
- **No sneaking/crouching** - can't bridge-build or sneak on edges
- **No boat/minecart riding**
- **No elytra flying**
- **No ladder climbing** (pathfinder may handle this)

### Inventory Management
- **No chest interaction** - can `interact` (open) but can't move items in/out of chests
- **No item sorting**
- **No armor auto-equip** (armor-manager plugin is loaded though)
- **No offhand equipping** (shield to offhand)
- **No inventory slot management** - can't move items between slots

### Building/World
- **No bucket operations** - can't place/pick up water or lava
- **No redstone** - no repeater/comparator/piston interaction
- **No sign writing**
- **No map reading**
- **No painting/item frame placement**
- **No door/trapdoor/gate opening** (interact works but no toggle tracking)

### Crafting/Smelting
- **No anvil usage** - can't repair or rename
- **No enchanting table usage**
- **No brewing stand usage**
- **No smithing table** - can't upgrade to netherite
- **No loom/stonecutter/grindstone**
- **No villager trading**

### World Interaction
- **No fishing**
- **No farming mechanics** - can't use hoe properly, no seed planting verification
- **No breeding** (need to hold food near animals)
- **No leash/lead usage**
- **No portal traversal control**
- **No TNT/explosion management**
- **No XP/enchantment system usage**
- **No book writing**

### Social
- **No whisper sending** (only receiving)
- **No team/scoreboard interaction**
- **No command block interaction**

## 5. Code Quality Issues

### Bugs
1. **toss ignores count parameter** (line 815-821): Receives `{item, count}` but calls `tossStack` which drops everything.
2. **eat may fail on non-edible items**: `mcData.foodsByName` may be undefined/empty depending on MC version. The `?.` helps but the filter may not work correctly.
3. **Reconnect on kick missing**: `bot.on('kicked')` sets botReady=false but doesn't trigger reconnect (unlike 'end' event).
4. **Chat log race condition**: GET /chat clears log by default. If polled from multiple clients or rapidly, messages are lost.
5. **briefState() includes time but not dimension** - minor inconsistency.
6. **config.mc.auth assignment truncated in display**: Line 60 shows `config.mc.auth=***` - this appears to be a redaction artifact but is actually in the source code. The actual assignment likely works but it's poorly formatted.

### Architecture Issues
1. **Single global bot instance** - no support for multiple bots.
2. **Single background task** - can only track one at a time. No task queue.
3. **No request validation** - body parameters not validated (e.g., x/y/z could be strings, NaN, etc.).
4. **No rate limiting** on API endpoints.
5. **Synchronous actions block the HTTP server** - long-running actions (collect 20 blocks) tie up the single-threaded server.
6. **No graceful shutdown** - no SIGTERM/SIGINT handler for clean bot disconnect.
7. **Mixed paradigms**: Some endpoints are under /action/ (sync), some under /task/ (async). Both use the same ACTIONS object but with very different behavior.

### Code Style
1. **No TypeScript** - pure JS with no type safety.
2. **No tests** of any kind.
3. **No input sanitization** for chat messages (potential for injection of MC commands).
4. **Magic numbers throughout** (4.5 for reach distance, 64 for search radius, 5 for scan radius, 30000 for timeout, etc.).
5. **Silent catch blocks** in collect() loop hide real errors.
6. **No JSDoc** on ACTIONS functions - parameters undocumented in code.
7. **No logging levels** - everything goes to console.log.

### CLI (bin/mc) Issues
1. **Python3 dependency for pretty printing** - heavy dependency for a shell script.
2. **No error handling for JSON parsing failures** in python3 blocks.
3. **Player name injection possible** in `mc follow` - name goes directly into JSON string without escaping.
4. **Screenshot relies on X11** (xdotool + scrot) - won't work on Wayland, headless, or macOS.

## 6. SOUL Instructions Assessment

### Strengths
- **Player-first philosophy** is excellent - constantly emphasizes checking chat.
- **Background task pattern** is well-documented with clear workflow.
- **Memory integration** - teaches the AI to save lessons and check memory before building.
- **Building philosophy** is sophisticated - "you have taste", multiple materials, proportions.
- **Vision integration** for build verification is smart.
- **Item drop awareness** - explicit "DESPAWN after 5 minutes" warning.
- **Anti-blocking pattern** - "NEVER use sleep in terminal".

### Weaknesses
- **No error recovery guidance**: What should the AI do when pathfinder fails? When crafting fails? When it dies? No instructions for handling failures.
- **No combat decision tree**: SOUL says "handle it" for damage but gives no priority or flee logic (the combat skill does, but SOUL should reference it).
- **No inventory management strategy**: No guidance on when to store items in chests, what to keep, what to toss when full.
- **No exploration strategy**: No guidance on what to do when "nothing is going on" beyond vague "explore, mine, build".
- **Missing technical details**: Doesn't explain that `mc collect` caps at 20 per call, that `mc attack` is single-hit, that crafting table must be within 4 blocks.
- **No death recovery plan**: What to do after dying - go back to death location? Rebuild gear? No guidance.
- **Building instructions are aspirational**: Describes great builds but the bot can only place one block at a time with exact coordinates. Building a log cabin requires 200+ individual place commands with correct coordinates. No guidance on calculating coordinates systematically.
- **No awareness of bot limitations**: Tells the AI it can "do anything a player can" but doesn't mention what it CAN'T do (no chest transfers, no enchanting, no shield blocking, etc.).
- **Web search reliance**: "Search for building ideas" - but the AI needs to translate visual designs into coordinate-based block placement, which is extremely hard.

### Overall SOUL Grade: B
Good personality and social framework, but lacks the technical specifics an AI needs to play well autonomously. An AI following these instructions would be great at chatting and responding to players but would struggle with complex tasks like building, sustained combat, or death recovery.

## 7. Prototype vs Production-Grade Gap

### What Makes This a Prototype
1. **No persistence** - bot state, chat log, death log, command queue all in memory. Server restart = total amnesia.
2. **No tests** - zero test coverage.
3. **No monitoring/health checks** - no metrics, no alerting, no uptime tracking.
4. **Single-task background system** - can only do one thing at a time.
5. **No auth/security** - open HTTP API, CORS *.
6. **No config file** - everything via env vars and CLI args.
7. **Silent error swallowing** - many catch{} blocks hide failures.
8. **No reconnect backoff** - hammers server every 5 seconds on disconnect.
9. **No inventory persistence** - can't track items across deaths.
10. **Single-hit combat** - not viable for real mob encounters.

### What Would Make It Production-Grade

#### Critical
- **Combat loop**: Implement sustained attack with retreat logic, health monitoring, and auto-eat during combat.
- **Chest/container interaction**: Ability to deposit/withdraw items from chests. Essential for any real gameplay.
- **Error recovery**: Retry logic for pathfinding, crafting, mining. Exponential backoff for reconnects.
- **Input validation**: Validate all API parameters. Sanitize chat messages.
- **Multi-task system**: Task queue with priorities, cancellation, and status tracking.
- **Death recovery**: Track death position and lost inventory. Auto-navigate back.

#### Important
- **State persistence**: Save bot state, important locations, inventory snapshots to disk/DB.
- **Authentication**: API key or token-based auth for the HTTP API.
- **Sneak/crouch action**: Required for bridge-building and edge work.
- **Jump action**: Needed for many movement scenarios.
- **Container operations**: Open chest, deposit item, withdraw item, close.
- **Enchanting/anvil/brewing**: Higher-tier gameplay support.
- **Reconnect with backoff**: Exponential backoff (5s, 10s, 20s, 40s...) with max retries.
- **Structured logging**: Log levels, timestamps, structured JSON output.
- **Health monitoring endpoint**: Detailed server health with uptime, task stats, error counts.

#### Nice to Have
- **TypeScript migration**: Type safety for the complex state management.
- **Test suite**: Unit tests for ACTIONS, integration tests for API endpoints.
- **WebSocket support**: Real-time events instead of polling.
- **Multi-bot support**: Run multiple bots on different servers.
- **Plugin system**: Allow custom actions/skills to be loaded.
- **Rate limiting**: Prevent API abuse.
- **Metrics/observability**: Prometheus metrics, structured logging.
- **Build planner**: Given a structure description, calculate all block placements automatically.
- **Coordinate memory**: Save named locations (home, mine, farm) persistently.
- **Trading system**: Villager trading automation.

### Maturity Assessment
- **Current state**: Solid prototype / MVP. Good architecture (HTTP API + CLI + AI agent is clean separation). Covers the basics well. The SOUL instructions and skill files show thoughtful design.
- **Gap to production**: ~60% of the way there. The core architecture is sound. Main gaps are reliability (error handling, reconnection, persistence), gameplay depth (combat loops, chest interaction, enchanting), and operations (monitoring, auth, tests).
- **Estimated effort to production**: 2-4 weeks of focused development for critical items. Another 2-4 weeks for important items.
