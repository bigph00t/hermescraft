// multiplayer-cooperation.md — Minecraft multiplayer mechanics, etiquette, and AI-specific multi-bot coordination rules

# Minecraft Multiplayer Cooperation

Covers physical coordination rules, resource sharing conventions, task deconfliction, communication patterns, and failure modes specific to two AI bots playing together.

---

### Physical Coordination

Players have a collision box 0.6 blocks wide and 1.8 blocks tall. Two players cannot stably occupy the same block column — they push each other sideways continuously. Never navigate to the exact same (X, Z) coordinate as your partner when they are standing there; arrive offset by at least 1 block.

Do not walk directly behind a partner navigating a narrow path or ledge. Your collision will push them and can knock them off edges, into lava, or into mobs. Stay 2+ blocks back when following through tight spaces.

Never both enter a 1×1 or 1×2 vertical shaft at the same time. One bot will be unable to move and may be pushed into void or suffocate. Assign one bot to go first; the other waits at the top until signaled clear.

Most entity types prevent block placement in the space they occupy. If your partner is standing in a block space you want to fill, you cannot place a block there — it will fail silently or return an error. Wait for the partner to move before placing.

Players can hit each other accidentally in melee combat. When fighting mobs, call out your attack position in chat before swinging. If a partner is already engaged in melee with a mob, use ranged attacks (bow, trident) from a safe angle or do not attack that mob at all. A stray sword swing does full damage to a partner with no warning.

If the server has PvP enabled (gamerule `pvp true`), player attacks deal damage. On a cooperative private server, confirm PvP is disabled or put both bots on the same scoreboard team with `friendlyFire` set to false. Team collision can be set to `never` to eliminate accidental pushing entirely.

XP orbs are attracted to the nearest player within 7.25 blocks. If a partner killed a mob and is closer to the dropped orbs, let them collect. Do not rush in to grab XP from a kill that is not yours — you will steal the reward. If you killed the mob, move toward the orbs immediately; do not dawdle.

Dropped items are picked up by whichever player's hitbox intersects the item first, with one exception: if a player drops an item themselves (throws from inventory), the other player gets pickup priority for 2 seconds. Use this mechanic intentionally when handing items to a partner — throw the item, and the partner will pick it up before you can accidentally re-collect it.

---

### Resource Sharing

Both players can open and interact with the same chest simultaneously without locking it. However, concurrent access creates a race condition: if both bots pull from the same slot at the same time, one will get the item and the other gets nothing. Coordinate chest access by designating which bot manages which chest, or by chatting "accessing chest" before opening and waiting for acknowledgment.

Do not take items from a furnace that your partner loaded. Smelting output belongs to whoever provided the ore and fuel. If you need smelted items urgently, load a separate furnace or ask permission. Stealing smelting output stalls a partner's workflow with no warning.

Agree on a storage system before both bots start gathering. Default convention: one shared community chest for bulk materials (cobblestone, dirt, wood logs), separate personal chests for tools and armor. Label chests with signs when possible. Without a system, both bots will dump resources in the same container and neither will find what they need.

Use item drops for direct transfers. Throw items on the ground near a partner using drop mechanics; the partner should step over them to collect. Announce what you are dropping in chat: "dropping 20 iron ingots for you." This prevents confusion about what is lying on the ground versus what is lost loot.

When food is scarce, the bot with higher hunger should eat first. Share food proactively — if your partner's hunger bar is low and you have surplus bread, drop some without waiting to be asked. A partner with zero hunger cannot sprint and cannot heal.

Do not both gather the same resource node simultaneously. Two bots mining the same iron vein means one gets all the ore and the other wastes ticks. Split resource nodes explicitly: announce "I have the iron vein at -50, 16, 80" and your partner should move to a different node.

When one bot is building and needs specific materials, the other bot should treat material fetching as a priority task over their own gathering. A builder blocked on materials is completely idle — that is a worse outcome than the fetcher pausing their own work.

---

### Task Coordination

Announce your intended action before starting it, especially for actions that take multiple ticks or claim a resource: "going to mine the oak forest to the east," "building the shelter here," "heading to the cave at -100, 45, 200." This prevents both bots from independently deciding to do the same thing.

Do not begin a task that overlaps geographically with an announced partner task. If partner says they are building a structure at a location, do not place blocks anywhere near that location unless explicitly asked to help.

Split complementary tasks, not parallel identical tasks. Good split: one bot mines, one bot smelts and crafts. Bad split: both bots mine separately in the same biome, returning to camp with duplicate ore and no tools ready.

If a partner is fighting mobs, help with ranged attacks from a safe distance or guard the perimeter — do not charge in and collide with their movement. If they are clearly winning without help, stay back and let them finish.

Take initiative on hard tasks that your partner has not claimed. If the base has no shelter, no food farm, and no mine, do not wait for the partner to assign you work. Pick the most critical gap and fill it. State what you chose in chat.

When building collaboratively, divide by zone or by material type, never by "I'll build some and you build some." Assign: "I will do the north wall and roof, you do the south wall and floor." This prevents block conflicts and patchy mixed styles.

If you complete your assigned task, announce it and ask what is needed next before grabbing something new. This keeps the partner's mental model of the world accurate and prevents duplication.

Avoid conversation loops. If you and your partner have exchanged more than 3 chat messages without either of you acting in the game world, stop chatting and do something. Chat is coordination overhead, not the goal.

---

### Communication Patterns

Report significant resource finds immediately with coordinates: "found diamond ore at x=-88, y=12, z=104" or "village to the north, maybe 200 blocks." Your partner cannot see your screen. Any useful world information you observe must be explicitly shared in chat or it does not exist for them.

Warn about dangers proactively: "creeper outside the base north side," "lava pool at the bottom of this shaft," "it is almost night." Do not wait to be asked — warnings lose value the moment the hazard becomes obvious.

Confirm receipt of important instructions. If your partner says "can you smelt these ores," respond "on it" before starting, not after finishing. Silent action is indistinguishable from ignoring the request.

Keep status updates brief and factual: "mining iron, back in ~3 min" is better than a long explanation. The partner only needs to know what you are doing and roughly when you will be available for something else.

Celebrate shared achievements. When a major goal completes — shelter built, first iron tools made, Nether portal lit — acknowledge it in chat. This is not wasted time; it establishes shared context and motivates continued cooperation.

Request resources with specificity and justification: "need 8 planks for a crafting table" is more cooperative than "give me wood." The partner can prioritize the request appropriately when they understand why.

If you are stuck, lost, or confused, say so immediately: "I am lost, last known position was -50, 64, 80" or "I cannot figure out how to smelt this, can you do it." Pretending to be fine while stuck wastes ticks that your partner could use to help.

---

### Common Multi-Bot Failures

**Resource race:** Both bots detect the same nearby tree or ore vein and navigate to it simultaneously. The first to arrive gets everything; the second wastes travel time. Fix: the bot that announces a resource claim first owns it. If no announcement was made, yield to whoever arrived first and find another node.

**Navigation collision:** Both bots pathfind to the same destination. They collide, push each other, and may both fail to arrive. Fix: only one bot navigates to any given destination at a time. If both need to be at the same place, one goes first and the other follows after the first arrives.

**Build interference:** One bot accidentally places blocks inside or adjacent to a structure the other is building, breaking the design. Fix: treat any active build site as a no-place zone unless you are the assigned builder for that site. Ask explicitly before placing blocks near a partner's construction.

**Task duplication:** Both bots independently decide "we need wood" and both go chop wood, returning with double the needed amount while other tasks remain unstarted. Fix: when two bots both identify the same need, only one acts on it. If you hear your partner announce a task, remove it from your own action candidates.

**Initiative vacuum:** Neither bot starts difficult or dangerous tasks (mining deep, fighting a dungeon, going to the Nether) because each waits for the other to volunteer. Fix: if a critical task has been unstarted for 3+ ticks and your partner has not claimed it, claim it yourself regardless of difficulty.

**Chat instead of act:** Both bots keep asking "what should we do?" and "what do you think?" without executing anything. Fix: if you have enough information to act, act. Reserve chat for sharing information you cannot obtain yourself, not for seeking permission on obvious next steps.

**Inventory theft:** One bot takes items from a shared chest that the other bot placed and needs for an in-progress task. Fix: if you are not sure whether items in a shared chest are already claimed, ask in chat before taking.

**Friendly melee:** One bot swings a sword at a mob and hits the partner who walked into the swing arc. Fix: never swing melee weapons without checking that your partner is not within 2 blocks of your target. Use bow or crossbow when a partner is nearby and engaged.

**XP poaching:** One bot dashes into a mob fight to collect XP orbs from mobs the partner killed. Fix: stay back during your partner's combat. The XP goes to whoever is closer — do not be closer unless you are actively helping.

**Conversation asymmetry:** One bot sends useful status updates; the other acts in silence and the first bot makes decisions based on stale information. Fix: both bots must report significant actions and findings. Silent operation is only acceptable for routine repetitive tasks (mining a vein, smelting a batch) that were already announced.

---

### Minecraft Social Culture

Naming builds and areas is normal and expected: "Luna's Lookout Tower," "Max's Mine," "the community farm." Named places become navigational landmarks and express personality. Name things you build.

Showing off completed builds to a partner is expected behavior, not vanity. Walk a partner through a structure you finished: "come look at what I built." Partners who see each other's work stay more engaged and can build on each other's ideas.

Help with a partner's project without waiting to be asked, especially when your own current task is complete. If the partner is clearly struggling to finish something, offer to contribute without making it conditional.

Friendly competition is healthy: "I bet I can find iron before you do" or "my wall looks better than yours." This is motivating and social. Do not be hostile or dismissive in response to it.

Share food when your partner is hungry, without negotiation. If you have surplus and they are low, drop food immediately. Food sharing is a baseline cooperative behavior, not a favor.

Warn when night is approaching: "sunset in about 2 minutes, heading back to shelter." Give enough lead time for a partner to wrap up exposed outdoor work.

Set up a shared home base with beds for both players. A bed respawn point is one of the most critical safety items in the game — do not have one for yourself without ensuring your partner also has one. Dying without a respawn point set costs enormous time.

Treat shared infrastructure (farms, storage, furnace banks, portals) as community property that both players maintain. If you use the community farm, replant it. If you take the last torch from the supply chest, note it. Infrastructure degrades without active maintenance from both players.

---

### AI-Specific Notes

Two AI bots without a coordination protocol will reliably reproduce every failure mode listed above. The fixes are not natural — they require explicit state-sharing via chat or a shared notepad. Use the notepad to record claimed tasks, resource locations, and build zones. Check it before starting any new task.

When in doubt about what your partner is doing, ask once and act on the answer. Do not ask repeatedly. Do not assume your partner will tell you something important without being asked — their reasoning about what is important to share may differ from yours.

Shared state in chat is ephemeral; the notepad survives context wipes. Any coordination agreement that must survive more than a few minutes should be written to the notepad, not just said in chat.
