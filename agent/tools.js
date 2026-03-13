// tools.js — OpenAI-format tool definitions for Hermes native function calling
// Descriptions kept concise to fit within 8K context window

export const GAME_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Pathfind to coordinates via Baritone (10-60s). Use for long-distance travel.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'X coordinate' },
          y: { type: 'integer', description: 'Y coordinate (sea level=63)' },
          z: { type: 'integer', description: 'Z coordinate' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mine',
      description: 'Auto-find and mine blocks via Baritone. For nearby single blocks use break_block instead.',
      parameters: {
        type: 'object',
        properties: {
          blockName: { type: 'string', description: 'e.g. "oak_log", "iron_ore", "cobblestone"' },
          count: { type: 'integer', description: 'How many (default 1)' },
        },
        required: ['blockName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'craft',
      description: 'Craft an item. Need ingredients in inventory. 3x3 recipes need nearby crafting table.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "oak_planks", "crafting_table", "wooden_pickaxe", "furnace"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'smelt',
      description: 'Smelt in nearby furnace. Need raw item + fuel in inventory.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "raw_iron", "raw_beef"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attack',
      description: 'Attack nearest entity. Equip sword first for more damage.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Optional: "zombie", "pig", etc.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eat',
      description: 'Eat best food from hotbar. Eat when food < 14.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place',
      description: 'Place a block from inventory at crosshair or coordinates.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "crafting_table", "furnace", "torch"' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          z: { type: 'integer' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'equip',
      description: 'Select item in hotbar. Use before attacking/mining/placing.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "diamond_sword", "iron_pickaxe"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look',
      description: 'Look in direction. Yaw: 0=south,90=west,180=north,270=east. Pitch: -90=up,0=horizon,90=down.',
      parameters: {
        type: 'object',
        properties: {
          yaw: { type: 'number' },
          pitch: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'break_block',
      description: 'Mine the block you are looking at. Use look first to aim.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'walk',
      description: 'Walk forward for N ticks (20 ticks = ~1 second). Use after look.',
      parameters: {
        type: 'object',
        properties: {
          ticks: { type: 'integer', description: 'How many ticks (max 200)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chat',
      description: 'Send chat message or /command. Prefix # for Baritone commands.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'use_item',
      description: 'Right-click with held item (bow, shield, bucket, ender pearl, etc).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drop',
      description: 'Drop held item. Use -1 for whole stack.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'integer', description: 'Number to drop (-1 for all)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'swap_hands',
      description: 'Swap main hand and offhand items.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop',
      description: 'Cancel all current actions (Baritone, mining, walking).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'jump',
      description: 'Jump once.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sneak',
      description: 'Toggle sneaking. Prevents falling off edges.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sprint',
      description: 'Toggle sprinting. Faster but drains food.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Do nothing this tick. Use when waiting for Baritone/furnace.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_screen',
      description: 'Close any open GUI (inventory, crafting, furnace, chest).',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export function getToolNames() {
  return GAME_TOOLS.map(t => t.function.name);
}
