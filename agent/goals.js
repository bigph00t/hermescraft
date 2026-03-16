// goals.js — 7-phase Ender Dragon strategy

let agentMode = 'phased';
let agentGoal = null;

export function initGoalSystem(agentConfig) {
  agentMode = agentConfig.mode || 'phased';
  agentGoal = agentConfig.goal || null;
}

function getItemName(i) {
  return (i.item || i.name || '').replace('minecraft:', '');
}

function hasItems(inventory, ...items) {
  if (!inventory) return false;
  return items.every(name =>
    inventory.some(i => getItemName(i).includes(name) && i.count > 0)
  );
}

function countItem(inventory, name) {
  if (!inventory) return 0;
  return inventory
    .filter(i => getItemName(i).includes(name))
    .reduce((sum, i) => sum + i.count, 0);
}

const OPEN_PHASE = {
  id: 0,
  name: 'Open World',
  description: 'Explore, survive, build, and respond to the world around you.',
  objectives: [],
  tips: [],
  completionCheck: () => false,
  progress: () => 0,
};

function getDirectedPhase() {
  return {
    id: 0,
    name: 'Player Goal',
    description: agentGoal || 'Follow player instructions.',
    objectives: agentGoal ? [agentGoal] : [],
    tips: [],
    completionCheck: () => false,
    progress: () => 0,
  };
}

const PHASES = [
  {
    id: 1,
    name: 'First Night',
    description: 'Survive the first night. Get wood, make tools, build shelter.',
    objectives: [
      'Punch a tree to get wood logs',
      'Craft planks and sticks',
      'Craft a crafting table',
      'Craft a wooden pickaxe',
      'Craft a wooden sword',
      'Mine cobblestone (at least 10)',
      'Craft stone tools (pickaxe, sword, axe)',
      'Craft a furnace',
      'Build or dig a shelter before nightfall',
      'Place torches if possible',
    ],
    tips: [
      'Start by looking around — find the nearest tree',
      'Use break_block to punch trees — look at a log block first with look action, then break it',
      'Craft planks first: 1 log = 4 planks. Use the exact wood type from your inventory.',
      'Upgrade to stone tools ASAP — they are much faster',
      'If it is getting dark, dig into a hillside for quick shelter',
      'Coal ore appears at the surface — mine it for torches',
      'Kill animals during the day for food',
    ],
    completionCheck(state) {
      const inv = state.inventory || [];
      const hasStonePick = hasItems(inv, 'stone_pickaxe');
      const hasFurnace = hasItems(inv, 'furnace') ||
        (state.nearbyBlocks || []).some(b => String(b.block || b.name || b || '').includes('furnace'));
      const hasCobble = countItem(inv, 'cobblestone') >= 10;
      return hasStonePick && hasFurnace && hasCobble;
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (countItem(inv, 'log') + countItem(inv, 'planks') > 0) score += 10;
      if (hasItems(inv, 'crafting_table')) score += 10;
      if (hasItems(inv, 'wooden_pickaxe')) score += 10;
      if (hasItems(inv, 'wooden_sword')) score += 5;
      if (hasItems(inv, 'stone_pickaxe')) score += 15;
      if (hasItems(inv, 'stone_sword')) score += 10;
      if (countItem(inv, 'cobblestone') >= 10) score += 10;
      if (hasItems(inv, 'furnace') ||
        (state.nearbyBlocks || []).some(b => String(b.block || b.name || b || '').includes('furnace'))) score += 15;
      if (countItem(inv, 'torch') > 0) score += 5;
      if (countItem(inv, 'coal') > 0) score += 5;
      if (countItem(inv, 'beef') + countItem(inv, 'chicken') + countItem(inv, 'porkchop') + countItem(inv, 'mutton') + countItem(inv, 'cooked') > 0) score += 5;
      return Math.min(100, score);
    },
  },
  {
    id: 2,
    name: 'Iron Age',
    description: 'Mine iron, smelt gear, get a shield and full iron tools.',
    objectives: [
      'Mine coal if not already stocked',
      'Find and mine iron ore (at least 20)',
      'Smelt iron ingots',
      'Craft iron pickaxe, iron sword, iron axe',
      'Craft a shield',
      'Craft iron armor (at least chestplate + helmet)',
      'Craft a bucket',
      'Secure food supply (cook meat, start farming)',
    ],
    tips: [
      'Iron spawns between Y=0 and Y=64, most common around Y=16',
      'You need a stone pickaxe or better to mine iron ore',
      'Smelt raw iron in the furnace with coal/charcoal',
      'Shield requires 1 iron ingot + 6 planks — blocks skeleton arrows',
      'A bucket of water is essential for nether portal building',
      'Bring torches when mining — mark your path',
    ],
    completionCheck(state) {
      const inv = state.inventory || [];
      return hasItems(inv, 'iron_pickaxe') &&
        hasItems(inv, 'iron_sword') &&
        hasItems(inv, 'shield') &&
        countItem(inv, 'iron_ingot') >= 3;
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (countItem(inv, 'raw_iron') + countItem(inv, 'iron_ingot') > 0) score += 15;
      if (countItem(inv, 'iron_ingot') >= 10) score += 15;
      if (hasItems(inv, 'iron_pickaxe')) score += 20;
      if (hasItems(inv, 'iron_sword')) score += 15;
      if (hasItems(inv, 'shield')) score += 15;
      if (hasItems(inv, 'iron_chestplate') || hasItems(inv, 'iron_helmet')) score += 10;
      if (hasItems(inv, 'bucket')) score += 5;
      if (countItem(inv, 'coal') >= 10) score += 5;
      return Math.min(100, score);
    },
  },
  {
    id: 3,
    name: 'Diamonds',
    description: 'Mine down to diamond level, get diamond gear.',
    objectives: [
      'Mine down to Y=-59 (deepslate level)',
      'Find diamond ore (need at least 5 diamonds)',
      'Craft diamond pickaxe (required for obsidian)',
      'Craft diamond sword',
      'Craft diamond armor pieces if extra diamonds available',
      'Collect obsidian (at least 10 for portal)',
      'Bring water bucket for lava encounters',
    ],
    tips: [
      'Diamonds spawn at Y=-64 to Y=16, most common around Y=-59',
      'Strip mine at Y=-59: dig 2-high tunnels with 2-block gaps',
      'ALWAYS carry a water bucket — lava is everywhere at diamond level',
      'Iron pickaxe can mine diamonds but diamond pick is needed for obsidian',
      'Obsidian needs a diamond pickaxe and takes 9.4 seconds to mine',
      'To get obsidian: find a lava pool underground or on surface, place water bucket next to lava source blocks — water converts lava to obsidian, then mine with diamond pickaxe',
      'Lava pools are common at Y=0 to Y=-50 and sometimes on the surface',
      'You need 10 obsidian for a nether portal (minimum frame)',
    ],
    completionCheck(state) {
      const inv = state.inventory || [];
      return hasItems(inv, 'diamond_pickaxe') &&
        hasItems(inv, 'diamond_sword') &&
        countItem(inv, 'obsidian') >= 10;
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      const pos = state.position;
      if (pos && pos.y < 0) score += 10;
      if (pos && pos.y < -40) score += 10;
      if (countItem(inv, 'diamond') > 0) score += 15;
      if (countItem(inv, 'diamond') >= 5) score += 10;
      if (hasItems(inv, 'diamond_pickaxe')) score += 20;
      if (hasItems(inv, 'diamond_sword')) score += 15;
      if (countItem(inv, 'obsidian') >= 10) score += 15;
      if (hasItems(inv, 'bucket')) score += 5;
      return Math.min(100, score);
    },
  },
  {
    id: 4,
    name: 'Nether',
    description: 'Build a nether portal and enter the Nether.',
    objectives: [
      'Build a nether portal frame (obsidian 4x5)',
      'Light the portal with flint and steel',
      'Enter the Nether',
      'Establish a safe base near the portal',
      'Gather food and supplies before entering',
    ],
    tips: [
      'Portal frame: 4 wide, 5 tall (10 obsidian minimum with corners empty)',
      'Craft flint and steel: 1 iron ingot + 1 flint (from gravel)',
      'Bring extra food, blocks, and iron gear into the Nether',
      'The Nether is dangerous — ghasts, blazes, piglins everywhere',
      'Mark your portal location so you can find it again',
      'Cobblestone is ghast-proof — use it for shelter',
    ],
    completionCheck(state) {
      return state.dimension && state.dimension.includes('nether');
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (countItem(inv, 'obsidian') >= 10) score += 30;
      if (hasItems(inv, 'flint_and_steel')) score += 20;
      else if (hasItems(inv, 'flint')) score += 10;
      if (state.dimension && state.dimension.includes('nether')) score = 100;
      return Math.min(100, score);
    },
  },
  {
    id: 5,
    name: 'Blaze Rods',
    description: 'Find a Nether Fortress and collect blaze rods.',
    objectives: [
      'Explore the Nether to find a fortress',
      'Locate blaze spawners',
      'Kill blazes and collect 7+ blaze rods',
      'Craft blaze powder from rods',
      'Stay alive — fire resistance potions help',
    ],
    tips: [
      'Nether fortresses generate along the Z axis — travel east/west to find one',
      'Fortresses are made of dark nether bricks',
      'Blazes spawn near blaze spawners in the fortress',
      'Blazes shoot fireballs — use a shield and hit between attacks',
      'You need at least 7 blaze rods (12 to be safe)',
      'Snowballs deal 3 damage to blazes (7 kills one)',
      'Block yourself in and fight blazes through a 1-block gap if struggling',
    ],
    completionCheck(state) {
      const inv = state.inventory || [];
      return countItem(inv, 'blaze_rod') + countItem(inv, 'blaze_powder') >= 7;
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (state.dimension && state.dimension.includes('nether')) score += 10;
      const blazeCount = countItem(inv, 'blaze_rod') + countItem(inv, 'blaze_powder');
      score += Math.min(70, blazeCount * 10);
      if ((state.nearbyBlocks || []).some(b => String(b.block || b.name || b || '').includes('nether_brick'))) score += 20;
      return Math.min(100, score);
    },
  },
  {
    id: 6,
    name: 'Ender Pearls',
    description: 'Hunt endermen, craft Eyes of Ender, prepare for the End.',
    objectives: [
      'Return to the Overworld',
      'Hunt endermen for ender pearls (need 12+)',
      'Craft blaze powder from blaze rods',
      'Craft 12+ Eyes of Ender',
      'Throw Eyes of Ender to locate stronghold',
      'Bring the best gear: diamond sword, armor, bow, food',
    ],
    tips: [
      'Endermen spawn in the overworld at night and in the End',
      'Look at their feet (not their face) to avoid aggro when not ready',
      'Endermen are weak to water — fight near water for safety',
      'Craft Eye of Ender: 1 blaze powder + 1 ender pearl',
      'Throw Eyes in the air — they float toward the stronghold',
      'Bring beds to the End — they explode near the dragon (high damage)',
      'Stock up on food, arrows, blocks, and healing potions',
    ],
    completionCheck(state) {
      const inv = state.inventory || [];
      return countItem(inv, 'ender_eye') >= 12;
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (state.dimension && !state.dimension.includes('nether')) score += 10;
      const pearls = countItem(inv, 'ender_pearl');
      score += Math.min(40, pearls * (40 / 12));
      const eyes = countItem(inv, 'ender_eye');
      score += Math.min(50, eyes * (50 / 12));
      return Math.min(100, Math.round(score));
    },
  },
  {
    id: 7,
    name: 'Dragon Fight',
    description: 'Find the stronghold, activate the End portal, defeat the Ender Dragon!',
    objectives: [
      'Use Eyes of Ender to find the stronghold',
      'Locate the End portal room',
      'Fill all portal frames with Eyes of Ender',
      'Enter the End',
      'Destroy the end crystals on obsidian towers',
      'Attack the Ender Dragon when it swoops down',
      'KILL THE DRAGON!',
    ],
    tips: [
      'The End portal is in a stronghold underground — dig down when Eyes hover',
      'Fill all 12 portal frames — some may already have Eyes',
      'Bring: diamond sword, bow+64 arrows, iron/diamond armor, 64 food, beds, blocks',
      'Destroy end crystals first — they heal the dragon',
      'Shoot crystals on top of towers with a bow',
      'Caged crystals need to be destroyed by climbing up and breaking the cage',
      'When the dragon perches on the fountain, hit it with your sword',
      'Beds explode in the End — place and click for massive damage to the dragon',
      'If you die, your stuff stays in the End — gear up and go back',
    ],
    completionCheck(state) {
      // Dragon defeated — hard to detect, but XP jump or achievement
      return false; // Must be manually detected
    },
    progress(state) {
      let score = 0;
      const inv = state.inventory || [];
      if (countItem(inv, 'ender_eye') >= 12) score += 20;
      if (state.dimension && state.dimension.includes('end')) score += 30;
      // Hard to track dragon HP from here — rely on LLM reasoning
      return Math.min(100, score);
    },
  },
];

export function getPhases() {
  return PHASES;
}

export function getCurrentPhase(state) {
  if (agentMode === 'open_ended') return OPEN_PHASE;
  if (agentMode === 'directed') return getDirectedPhase();
  for (const phase of PHASES) {
    if (!phase.completionCheck(state)) {
      return phase;
    }
  }
  return PHASES[PHASES.length - 1]; // Dragon fight
}

export function getPhaseProgress(state) {
  const phase = getCurrentPhase(state);
  return {
    phase,
    progress: phase.progress ? phase.progress(state) : 0,
  };
}

export function checkPhaseTransition(prevPhase, state) {
  const current = getCurrentPhase(state);
  if (current.id !== prevPhase.id) {
    return { transitioned: true, from: prevPhase, to: current };
  }
  return { transitioned: false };
}

// ── Progress Detail — itemized breakdown for LLM prompt ──

export function getProgressDetail(phase, state) {
  if (agentMode !== 'phased') return null;
  const inv = state.inventory || [];
  const completed = [];
  const remaining = [];

  if (phase.id === 1) {
    // First Night
    if (countItem(inv, 'log') + countItem(inv, 'planks') > 0) completed.push('wood');
    else remaining.push('get wood');
    if (hasItems(inv, 'crafting_table')) completed.push('crafting table');
    else remaining.push('craft crafting table');
    if (hasItems(inv, 'wooden_pickaxe') || hasItems(inv, 'stone_pickaxe')) completed.push('pickaxe');
    else remaining.push('craft pickaxe');
    if (hasItems(inv, 'stone_pickaxe')) completed.push('stone tools');
    else remaining.push('upgrade to stone tools');
    if (countItem(inv, 'cobblestone') >= 10) completed.push('cobblestone');
    else remaining.push(`mine cobblestone (${countItem(inv, 'cobblestone')}/10)`);
    if (hasItems(inv, 'furnace') || (state.nearbyBlocks || []).some(b => String(b.block || b.name || b || '').includes('furnace')))
      completed.push('furnace');
    else remaining.push('craft furnace');
  } else if (phase.id === 2) {
    // Iron Age
    if (countItem(inv, 'iron_ingot') > 0 || countItem(inv, 'raw_iron') > 0) completed.push('iron ore');
    else remaining.push('mine iron ore');
    if (countItem(inv, 'iron_ingot') >= 10) completed.push('10+ iron ingots');
    else remaining.push(`smelt iron (${countItem(inv, 'iron_ingot')} ingots)`);
    if (hasItems(inv, 'iron_pickaxe')) completed.push('iron pickaxe');
    else remaining.push('craft iron pickaxe');
    if (hasItems(inv, 'iron_sword')) completed.push('iron sword');
    else remaining.push('craft iron sword');
    if (hasItems(inv, 'shield')) completed.push('shield');
    else remaining.push('craft shield');
  } else if (phase.id === 3) {
    // Diamonds
    const pos = state.position;
    if (pos && pos.y < 0) completed.push('deep mining');
    else remaining.push('mine down to Y=-59');
    if (countItem(inv, 'diamond') > 0) completed.push(`diamonds (${countItem(inv, 'diamond')})`);
    else remaining.push('find diamonds');
    if (hasItems(inv, 'diamond_pickaxe')) completed.push('diamond pickaxe');
    else remaining.push('craft diamond pickaxe');
    if (hasItems(inv, 'diamond_sword')) completed.push('diamond sword');
    else remaining.push('craft diamond sword');
    if (countItem(inv, 'obsidian') >= 10) completed.push('obsidian');
    else remaining.push(`mine obsidian (${countItem(inv, 'obsidian')}/10)`);
  } else if (phase.id === 4) {
    // Nether
    if (countItem(inv, 'obsidian') >= 10) completed.push('obsidian');
    else remaining.push('get 10 obsidian');
    if (hasItems(inv, 'flint_and_steel')) completed.push('flint and steel');
    else if (hasItems(inv, 'flint')) remaining.push('craft flint and steel (have flint)');
    else remaining.push('craft flint and steel');
    if (state.dimension?.includes('nether')) completed.push('in the Nether!');
    else remaining.push('build and enter portal');
  } else if (phase.id === 5) {
    // Blaze Rods
    const blazeCount = countItem(inv, 'blaze_rod') + countItem(inv, 'blaze_powder');
    if (blazeCount > 0) completed.push(`blaze rods/powder (${blazeCount})`);
    else remaining.push('find fortress and kill blazes');
    if (blazeCount >= 7) completed.push('enough blaze rods');
    else remaining.push(`need ${7 - blazeCount} more blaze rods`);
  } else if (phase.id === 6) {
    // Ender Pearls
    const pearls = countItem(inv, 'ender_pearl');
    const eyes = countItem(inv, 'ender_eye');
    if (pearls > 0) completed.push(`ender pearls (${pearls})`);
    if (eyes > 0) completed.push(`eyes of ender (${eyes})`);
    if (eyes < 12) remaining.push(`craft ${12 - eyes} more eyes of ender`);
  } else if (phase.id === 7) {
    // Dragon Fight
    if (countItem(inv, 'ender_eye') >= 12) completed.push('12 eyes of ender');
    if (state.dimension?.includes('end')) completed.push('in The End!');
    else remaining.push('find stronghold and enter End portal');
    remaining.push('destroy end crystals', 'kill the Ender Dragon');
  }

  return { completed, remaining };
}

// ── Configurable Goal System ──

let activeGoalName = 'Defeat the Ender Dragon';
let customGoal = null;

export function setGoal(goalText) {
  if (goalText.startsWith('GOAL:')) {
    goalText = goalText.slice(5).trim();
  }
  activeGoalName = goalText;
  customGoal = goalText;
}

export function getGoalName() {
  if (agentMode === 'open_ended') return 'Open-Ended Survival';
  if (agentMode === 'directed') return agentGoal || 'Player Goal';
  if (customGoal) return customGoal;
  return activeGoalName;
}

export function isCustomGoal() {
  return customGoal !== null;
}

export function getAgentMode() { return agentMode; }
