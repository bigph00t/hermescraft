# Danger Avoidance — Minecraft 1.21.1

Complete reference for every damage source a player can encounter, with exact values and imperative directives for prevention and recovery.

---

## Universal Rules (Apply These Always)

- Always carry food. Starvation kills on Hard and cripples healing on Normal.
- Always carry a water bucket. Negates lava, fall damage, and fire in one slot.
- Never dig straight down. Drops you into lava, void pits, or mob caves.
- Never dig straight up. Sand, gravel, and lava pour down onto your head.
- Wear full armor at all times outside a safe base. Even leather reduces most damage categories.
- Carry milk buckets when entering the Nether, fighting witches, or exploring swamps. Milk cures Poison, Wither, and all status effects instantly.

---

### Fall Damage

**Mechanics:** Damage = (blocks fallen − 3) × 1 HP. Safe height is 3 blocks. A 23-block fall from full health kills an unarmored player.

**Negation (complete):**
- Land in water (any depth). Zero fall damage.
- Land on a slime block. Zero fall damage, bounces you back up.
- Land on a hay bale. 80% damage reduction.
- Land on a honey block. Significant reduction plus sticks to the side.
- Land on a bed. ~50% reduction.
- Land in a cobweb. Slows descent, eliminates most damage.
- Sweet berry bush. Negates ALL fall damage for entities inside it.
- Use an elytra and activate before impact.
- Use a water bucket in mid-fall: place it on the ground below one tick before landing.

**Enchantments:**
- Feather Falling IV: reduces fall damage by ~48%. Stack with Protection for further reduction.
- Use the Mace smash attack: deals bonus damage equal to fall distance and cancels your own fall damage on hit.

**Recovery:** If you survive a long fall with low HP, do not move until you eat back to full. Mobs may be waiting below.

---

### Lava

**Mechanics:** 4 HP damage every half-second while submerged. On exit, fire burns for ~15 seconds, dealing 1 HP/second (14 additional hits). All non-netherite items dropped into lava are instantly destroyed.

**Prevention:**
- Fire Resistance potion: complete immunity to lava contact and fire. Duration: 3 minutes (standard), 8 minutes (extended). Brew with magma cream. Mandatory before entering the Nether without full netherite armor.
- Netherite armor: highest fire protection. Netherite items survive lava contact when dropped.
- Fire Protection IV on all armor pieces: enough to allow natural regen to outpace damage (borderline, not reliable alone).

**Escape:**
- Pour a water bucket on yourself or onto the lava source if in the Overworld. Water converts lava source blocks to obsidian and stops the fire.
- Swim toward the nearest solid edge. Lava movement is slow — prioritize upward and lateral motion.
- Do not panic-drop items. Everything non-netherite is gone the moment it touches lava.

**Recovery:** After escaping, immediately extinguish fire by entering water or receiving rain. Drink a Fire Resistance potion if you must re-enter.

---

### Fire

**Mechanics:** 1 HP per tick while inside a fire block (reduced to 1 HP/0.5s by damage immunity). 1 HP per second while burning but outside the fire source. Soul fire: 2 HP per half-second — more dangerous than normal fire.

**Sources:** Flint and steel, fire charges, lava contact (sets you on fire for ~15 seconds), ghast fireballs, blaze fireballs, fire aspect weapons, campfires, fire blocks.

**Extinguishing:**
- Jump into water, rain, or a water-filled cauldron. Instantly removes all fire.
- Pour a water bucket onto yourself.
- Splash/lingering water bottles extinguish fire in a small radius.
- Wait it out only as a last resort: lava-sourced fire lasts ~15 seconds.

**Prevention:**
- Fire Resistance potion: complete immunity.
- Fire Protection IV enchantment on all armor: substantially reduces duration and damage.
- Stay out of soul sand valleys in the Nether — soul fire everywhere.

---

### Drowning

**Mechanics:** Players have 10 air bubbles (300 ticks). Air depletes underwater. After 10 seconds (200 ticks), drowning begins: 2 HP damage every second. Air refills instantly upon surfacing.

**Enchantments:**
- Respiration III: triples underwater time (~45 seconds before drowning, plus each level gives a 1-in-(level+1) chance to not consume air per tick).
- Aqua Affinity: does not prevent drowning but lets you mine underwater at normal speed, reducing time spent submerged.

**Items and effects:**
- Turtle Shell helmet: grants water breathing for 10 seconds after surfacing (regenerates while out of water).
- Potion of Water Breathing: complete immunity to drowning for 3 or 8 minutes.
- Conduit Power (within range of active conduit): unlimited water breathing.

**Air pocket tricks:**
- Place a door, sign, banner, or trapdoor underwater. These create an air block that instantly refills your breath bar. Build emergency air pockets in ocean monuments and deep dives.

**Recovery:** Surface immediately when at 2-3 bubbles remaining. If trapped underwater, break a block adjacent to your head to create an air pocket. Do not panic-mine — you are slow underwater without Aqua Affinity.

---

### Suffocation

**Mechanics:** 1 HP every 0.5 seconds (2 HP/second) when your head occupies a solid block. Kills an unarmored player in ~10 seconds. Protection enchantment and Resistance reduce this; armor points alone do not.

**Causes:**
- Falling sand or gravel lands on your head while you stand below it.
- A piston pushes a block into your head space.
- You teleport (ender pearl, nether portal glitch) into a solid block.
- You place a block directly above your own head.

**Prevention:**
- Never stand under a sand or gravel column you are about to mine.
- Listen for the sand/gravel falling sound — move before it lands.
- When mining upward, tap the block first to check: if it falls, step back.
- When using pistons, ensure the piston arm cannot reach your standing position.

**Escape:**
- Move horizontally one block in any direction immediately.
- Break the block trapping your head using the hand (no tool needed, just click fast).
- If gravel buried you, dig sideways, not up — more gravel will fall.

---

### Starvation

**Mechanics:** Starvation begins when hunger bar = 0. Damage: 1 HP every 4 seconds (80 ticks). Armor, Resistance, and enchantments offer no reduction.

**Difficulty floors:**
- Easy: stops at 10 HP (5 hearts). Cannot kill.
- Normal: stops at 0.5 HP (1/4 heart). Cannot kill.
- Hard: no floor. Will kill you.

**Natural regen:** Requires hunger ≥ 18 (9 full shanks) and saturation > 0. Regen costs 6 exhaustion per 1 HP healed.

**High-exhaustion activities (eat more during these):**
- Sprinting: 0.1 exhaustion/meter
- Sprint-jumping: 0.2 exhaustion/jump
- Regenerating health: 6 exhaustion per HP healed

**Best food choices:**
- Golden Carrot: 8 hunger + 14.4 saturation. Best per-item value.
- Cooked porkchop/steak: 8 hunger + 12.8 saturation.
- Suspicious stew (dandelion): 7 hunger + 21.2 saturation. Highest saturation in game.
- Bread: widely available, 5 hunger + 6 saturation. Acceptable mid-tier.

**Emergency:** Eat anything — even rotten flesh or raw chicken (food poisoning included) is better than starving to death on Hard.

---

### Void Damage

**Mechanics:** Java Edition: damage begins below Y=−128 in the Overworld (64 blocks into the void). Damage rate: 4 HP every 0.5 seconds (8 HP/second). Armor, Resistance, and enchantments provide no meaningful protection at this rate. Totem of Undying cannot save you from the void — this is the only damage source totems cannot block.

**Dimensions:**
- Overworld: void below Y=−128
- Nether: void below Y=−64 (thin void floor; less common)
- The End: void everywhere off the main island — most common void death

**Prevention:**
- In the End, never stand near island edges without a water bucket ready.
- Place blocks under yourself when bridging in the End or Nether.
- If you fall, immediately throw an ender pearl toward a solid surface.
- Elytra eliminates End void deaths — equip before engaging the dragon.
- Build parapets (1-block walls) around End island edges before fighting.

**Recovery:** There is no recovery from the void. Prevention is absolute.

---

### Cactus

**Mechanics:** 1 HP per tick on contact (damage immunity reduces to once per 0.5s). Armor reduces this damage. Cactus destroys all items it touches, including items dropped on the ground near it.

**Prevention:**
- Do not run through cactus biomes while sprinting — one block width is enough to kill.
- Never store items near cactus. One accidental nudge and your inventory contents are gone.
- Place cactus traps with fences around them to contain item destruction.

**Recovery:** Walk through only if absolutely necessary. Do not jump — jumping increases forward momentum into the block.

---

### Sweet Berry Bush

**Mechanics:** 1 HP per tick (0.5s immunity applies) while moving through the bush. Slows movement to 34% of normal speed. Standing still inside a bush deals no damage. Negates all fall damage for entities inside it.

**Prevention:**
- Walk around berry bushes, do not sprint through them.
- If trapped in bushes, stop moving. Stand still and place blocks to create a path.
- Foxes are immune — you are not.

---

### Magma Blocks

**Mechanics:** 1 HP per tick (0.5s immunity), fire damage type. Does not set the player on fire. Deals damage even underwater.

**Prevention:**
- Sneak (shift) while walking on magma blocks: zero damage.
- Frost Walker enchantment on boots: converts magma surface to frosted ice, preventing damage.
- Fire Resistance potion: complete immunity.
- Fire Protection enchantment on armor: reduces damage significantly.

**Where encountered:** Nether floor, basalt deltas, underwater ocean ravines. In the Nether, magma covers vast areas — sneak travel or drink Fire Resistance.

---

### Campfire

**Mechanics:** 1 HP per tick (0.5s immunity) when standing on a lit campfire. Does not set the player on fire. Soul campfire: same damage rate (wiki does not indicate higher damage in Java 1.21.1). Standard armor provides no protection — only fire-type mitigations apply.

**Prevention:**
- Do not stand on lit campfires.
- Extinguish campfires with a shovel when building near them.
- Frost Walker boots or Fire Resistance potion provide immunity.
- Fire Protection enchantment on armor reduces damage.

---

### Drowning in Bubble Columns (Soul Sand / Magma)

**Mechanics:** Soul sand columns push players upward (safe). Magma block columns pull players downward, potentially dragging you to the ocean floor and drowning you.

**Prevention:** Identify column direction before entering underwater structures. Avoid magma-block columns in ocean monuments. Use Water Breathing potion in Ocean Monument raids.

---

### Lightning Strike

**Mechanics:** 5 HP direct damage on hit. Sets the player on fire for several seconds. Strikes randomly during thunderstorms in any biome with precipitation. Can strike twice in rapid succession on the same entity.

**Player-targeted triggers:**
- Natural random strikes during thunderstorms
- Channeling enchantment on a trident thrown at a mob during a thunderstorm (does not directly target you)
- Trident with Channeling thrown at you by a drowned mob

**Prevention:**
- Lightning strikes exposed players (no roof overhead, sky access).
- Stand indoors or under a roof during thunderstorms.
- Place lightning rods within 128 blocks of your position to attract and redirect strikes.
- Lightning rods on rooftops protect buildings from fire ignition.

**Recovery:** Extinguish fire in water immediately. Lightning deals modest damage alone (5 HP) but the fire aftermath can kill you in open terrain.

---

### Freeze (Powder Snow)

**Mechanics:** After 7 seconds (140 ticks) inside powder snow, the player begins freezing. Damage: 1 HP every 2 seconds. The freeze meter fills at 1 tick per game tick (max 140). After leaving powder snow, it drains at 2 ticks per game tick — clears in ~3.5 seconds.

**Prevention:**
- Any single piece of leather armor prevents the freezing effect entirely.
- Leather boots additionally prevent sinking into powder snow (walk on top of it).
- Without leather boots, you sink and become trapped — combine with slow freeze damage and you can die before escaping.

**Escape:**
- Equip any leather armor piece immediately.
- Jump repeatedly — you will slowly rise out of the powder snow column.
- Break the powder snow block at your head level.

---

### Pointed Dripstone (Stalactites and Stalagmites)

**Falling stalactite damage (Java Edition):**
- Triggered when the block supporting the stalactite is broken.
- Damage formula: 1 HP per stalactite falling × max(6, blocks fallen). Minimum 6 blocks counted even for short falls.
- Example: single stalactite, 4-block fall = 6 HP (minimum 6 applied).
- Caps at 40 HP regardless of height.
- Helmet reduces damage by 25% but costs double durability.

**Landing on a stalagmite:**
- Multiplies effective fall distance by 2: damage = ceil(fall_distance × 2 − 2).
- A normal jump onto a stalagmite = ~1 HP. A fall from height = lethal.
- Fall damage immunity (slime, water, feather falling) also nullifies stalagmite damage.

**Prevention:**
- Never stand directly under stalactite clusters you are mining above.
- Light up dripstone caves thoroughly — dark ceilings hide stalactite formations.
- Place slabs or carpets on top of stalagmite clusters to eliminate landing hazard.

---

### TNT

**Mechanics:**
- Fuse time: 1.5 seconds (40 ticks, but the lit TNT entity exists for 80 ticks before detonating — practical run time ~4 seconds from click to boom).
- Point-blank damage: ~65 HP on Normal (instant kill).
- Safe distance: 7+ blocks reduces damage to near zero. Walls further reduce blast.
- Blast Protection enchantment: each level reduces explosion damage by 8%, stacks across all armor pieces up to 80% total (4 pieces × Blast Protection IV).
- Shields: completely block frontal explosion damage from creepers; similar effect against TNT.

**Prevention:**
- Never ignite TNT in an enclosed space.
- Keep TNT away from open flame, redstone, fire charges, and lightning.
- Count your fuse time — you have ~4 seconds to run 7+ blocks.

---

### Creeper Explosion

**Mechanics:**
- Fuse: 1.5 seconds (30 ticks) of hissing after entering 3-block detection range.
- Detonation cancels if you move 7+ blocks away during the countdown.
- Normal damage: up to 43 HP on Normal (instant kill in open terrain at close range).
- Charged creeper: up to 85 HP on Normal. One-shots through full iron armor.
- Detection: requires uninterrupted line of sight throughout the full countdown.

**Prevention:**
- Keep 4+ blocks distance from all creepers.
- Sprint away immediately on hearing the hiss.
- Block line of sight with a solid block to cancel detonation.
- Shield: completely blocks frontal explosion damage from a regular creeper.
- Flint and steel detonates a creeper immediately — do not use in close quarters.

**Recovery:** After a creeper explosion, check inventory for missing items (creeper craters swallow dropped items into the pit). Backtrack your path to retrieve.

---

### Wither Effect

**Mechanics:** Unlike Poison, Wither CAN kill you on all difficulties. Deals damage while turning hearts black, making remaining health invisible.

- Level I: 0.5 HP/second (wither skeleton hit)
- Level II: 1 HP/second (wither boss skulls, wither rose)

**Sources:**
- Wither skeleton melee attack: Wither I for 10 seconds
- Wither boss skull projectiles: Wither II for 10 seconds (Normal), 40 seconds (Hard)
- Wither Rose block contact: Wither II
- Suspicious stew crafted with wither rose: Wither effect on consumption

**Cure:** Drink milk immediately. Milk cures all active status effects at once.

**Prevention:**
- Kill wither skeletons quickly from range — a single melee hit gives 10 seconds of Wither.
- Bring 3+ milk buckets into any Nether fortress.
- When fighting the Wither boss, drink milk the moment you get hit by a skull.

---

### Poison Effect

**Mechanics:** Poison drains health but cannot kill. Health floor: 1 HP. Level I: 0.8 HP/second. Higher levels faster.

**Sources:**
- Cave spider melee attack (Poison I, 7 seconds Normal, 15 Hard)
- Bee sting (Poison I, 10 seconds)
- Witch splash potion (Poison II, 45 seconds)
- Eating pufferfish (Poison IV, 1 minute)
- Eating poisonous potato (Poison IV, ~4 seconds, 60% chance)
- Bogged skeleton arrows (Poison I)

**Cure:** Milk bucket or honey bottle (Java Edition). Honey bottle removes Poison only. Milk removes all effects.

**Prevention:**
- Avoid cave spiders — they inflict Poison through armor.
- Do not eat pufferfish unless you need the Nausea + Poison for a brewing recipe and have milk ready.
- Fight witches from behind cover — their AI prioritizes throwing Splash Potion of Poison at close range.

---

### Warden

**Mechanics:** Most dangerous mob in the game. Never fight it.

**Melee attack:**
- Normal: 30 HP (15 hearts) — kills from full health in one hit without full netherite.
- Hard: 45 HP — one-shots through most armor sets.
- Disables shields for 5 seconds after each hit.
- Attack cooldown: 36 ticks (~1.8 seconds).

**Sonic Boom (ranged):**
- Normal: 10 HP (5 hearts). Hard: 15 HP.
- Bypasses ALL armor, shields, and armor enchantments including Protection.
- Only reduced by: Resistance status effect, wolf armor (on wolves), and witch magic resistance.
- Range: long. Can hit you through walls.
- 3-second cooldown.

**Warden HP: 500 HP (250 hearts).**

**Avoidance (mandatory):**
- Sneak at all times in Deep Dark biomes. Vibrations from movement summon the Warden.
- Do not sprint, jump, shoot projectiles, or place/break blocks carelessly near sculk sensors.
- If a Warden spawns: do not attack. Walk away slowly while sneaking.
- Despawn timer: Warden burrows and despawns after 60 consecutive seconds with no detected vibrations or player sniffing.
- Wool blocks absorb vibrations — place them to muffle your path through Ancient Cities.
- Sniffing: even a sneaking player within ~20 blocks can be sniffed out. Keep moving away when detected.
- Warden has no loot. No XP. Nothing justifies fighting it.

---

### Skeleton / Ranged Mob Arrows

**Mechanics:**
- Normal difficulty: 3.5–5 HP per arrow hit.
- Hard difficulty: 4–8 HP per arrow hit.
- Fire rate: 1 arrow every 3 seconds (Normal), every 2 seconds (Hard).
- Stray skeleton: fires Slowness-tipped arrows.
- Bogged skeleton: fires Poison-tipped arrows.

**Prevention:**
- Place a solid block between you and the skeleton (it will move to find a new angle).
- Advance while circle-strafing to close distance faster than it can aim.
- Use a shield to block incoming arrows from the front.
- Skeletons strafe to dodge your attacks in Java Edition — anticipate the dodge and lead your swing.

---

### Ender Dragon

**Dragon attacks:**
- Wing swipe: ~5 HP per hit (10 HP from direct head contact).
- Dragon breath cloud: 3 HP/second, magic damage type — bypasses armor but reduced by Protection enchantment.
- Dragon fireball: creates a lingering acid cloud equivalent to Harming II on impact. Do not stand on the impact zone.
- Melee charge at perch portal: highest melee damage phase.

**End crystals:** Explode when shot or hit. Stand 8+ blocks away when destroying them. Use bow from the ground.

**Prevention:**
- Destroy all End crystals before engaging the dragon to stop health regeneration.
- Keep moving at all times. The dragon cannot attack a fast-moving target consistently.
- Elytra lets you dodge all breath attacks.
- Avoid standing in purple cloud pools — the acid effect persists after the initial fireball.

---

### Wither Boss

**Attacks:**
- Black skull: 8 HP on Normal, blast power 1. Inflicts Wither II (10s Normal, 40s Hard).
- Blue skull: slower, extremely destructive to terrain. Can destroy obsidian.
- Spawn explosion: massive AoE on full-charge completion (~11 seconds after summoning). Stay 15+ blocks away during summoning.

**Half-health phase:** Gains "Wither Armor" — immune to all arrows and tridents. Switch to melee (netherite sword with Smite V).

**Survival requirements:**
- Full netherite armor with Protection IV.
- Milk buckets (3+): cure Wither effect immediately after skull hits.
- Potions: Regeneration II, Strength II, and/or Absorption.
- Golden apples: emergency healing (+4 absorption hearts).
- Fight underground in a narrow tunnel: limits skull spread, lets you close to melee quickly.

---

### Elder Guardian (Mining Fatigue)

**Not direct damage but lethal by proxy:** Elder Guardian inflicts Mining Fatigue III on all players within 50 blocks of an Ocean Monument. This reduces mining speed to near zero, trapping you in the structure.

- Effect duration: 5 minutes. Reapplied by any nearby Elder Guardian every 60 seconds.
- Cure: Milk bucket removes Mining Fatigue.
- Direct attack: Guardian laser 4–9 HP. Thorns-like retaliation when touched.

**Prevention:** Bring multiple milk buckets to Ocean Monuments. Kill Elder Guardians first before exploring.

---

### Blaze

**Attacks:**
- Fires 3 fire charges in rapid bursts.
- Each fire charge: 5 HP + sets you on fire.
- Melee: 6 HP on Normal.

**Prevention:**
- Fire Resistance potion: complete immunity to fire charge damage and fire.
- Mandatory in Nether Fortresses.
- Fight from cover behind nether brick pillars.
- Snowballs deal 3 HP to blazes each — cheap and effective.

---

### Falling Anvil

**Mechanics:** 2 HP per block fallen after the first block. Maximum damage: 40 HP (20 hearts). Triggered when the block below an anvil is removed.

**Prevention:**
- Never stand directly below a suspended anvil.
- When operating anvil machinery or redstone contraptions involving anvils, stand to the side.
- Helmet provides standard armor reduction but no special bonus against falling anvils (the 25% helmet bonus was removed in earlier versions).

---

### Ender Pearl Damage

**Mechanics:** Teleportation via ender pearl deals 5 HP on landing. Cannot be reduced by most means.

**Prevention:** Accept the 2.5-heart cost as the price for teleportation. Do not use ender pearls to escape drowning or lava if it drops you into a worse position.

---

### Thorns Enchantment (Counterattack)

**Mechanics:** Each armor piece with Thorns I–III has a 15% × level chance per piece to reflect 1–4 HP damage back to the attacker. Thorns III on all 4 pieces = 45% chance per piece per hit.

**For you as the attacker:** Fighting mobs or players with Thorns armor will drain your HP faster than expected, especially if attacking rapidly. Shield-tanking removes this risk as you are not taking hits.

---

### Summary: Carry List for Survival

These items collectively prevent the majority of deaths:

| Item | Deaths Prevented |
|---|---|
| Water bucket | Lava, fall, fire |
| Food (golden carrots, steak) | Starvation, enables regen |
| Milk bucket | Poison, Wither, all status effects |
| Fire Resistance potion | Lava, fire, magma, blazes |
| Shield | Creepers, skeletons, melee mobs |
| Feather Falling IV boots | Fall damage |
| Golden apple | Emergency 4 HP instant heal + absorption |
| Ender pearl | Escape from mobs, gaps |
| Totem of Undying (offhand) | Any fatal hit except void |

**Totem of Undying:** Activates automatically when held in the offhand when you would die. Restores 1 HP, grants Regeneration II (45s), Fire Resistance (40s), and Absorption II (5s). Cannot save from void damage.
