// tools.js — OpenAI-format tool definitions for Hermes native function calling
// Each tool maps to a game action the agent can execute via the HermesBridge mod

export const GAME_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Pathfind to specific coordinates using Baritone. Takes 10-60 seconds depending on distance. Use for traveling to known locations or exploring in a direction. The agent will automatically find a path and walk there.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'Target X coordinate' },
          y: { type: 'integer', description: 'Target Y coordinate (altitude, sea level is 63)' },
          z: { type: 'integer', description: 'Target Z coordinate' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mine',
      description: 'Use Baritone to automatically find and mine a specific block type. Pathfinds to the nearest matching block and mines it. Great for gathering resources like logs, ores, and stone. If you need to mine a block right in front of you, use break_block instead.',
      parameters: {
        type: 'object',
        properties: {
          blockName: { type: 'string', description: 'Block type to mine, e.g. "oak_log", "iron_ore", "cobblestone", "diamond_ore"' },
          count: { type: 'integer', description: 'Number of blocks to mine (default: 1)' },
        },
        required: ['blockName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'craft',
      description: 'Craft an item from ingredients in your inventory. For recipes requiring a 3x3 grid (tools, armor, etc.), you must be near a placed crafting table. Simple recipes (planks, sticks) work from inventory. Check your inventory for ingredients first.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Item to craft, e.g. "planks", "sticks", "crafting_table", "wooden_pickaxe", "iron_sword", "furnace"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'smelt',
      description: 'Smelt an item in a nearby furnace. Requires a furnace within 5 blocks, the raw item in inventory, and fuel (coal, charcoal, wood). Automatically loads fuel and input. Use for raw_iron -> iron_ingot, raw_gold -> gold_ingot, raw food -> cooked food.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Raw item to smelt, e.g. "raw_iron", "raw_gold", "raw_beef", "raw_chicken"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attack',
      description: 'Attack the nearest entity. Useful for combat (zombies, skeletons, spiders) and hunting animals (pig, cow, chicken, sheep) for food. Equip a sword first for more damage. You can optionally specify a target type to only attack that kind of entity.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Optional: entity type to target, e.g. "zombie", "skeleton", "pig", "cow". If omitted, attacks nearest entity.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eat',
      description: 'Eat food from your hotbar to restore hunger. Automatically selects the best food item available. Takes about 2 seconds (40 ticks). Make sure you have food in your inventory. Eat when food bar drops below 14 to maintain sprint ability.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place',
      description: 'Place a block from your inventory. The block is placed at your crosshair target or at specified coordinates. Use for building shelter, placing crafting tables, furnaces, torches, etc.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Block to place, e.g. "crafting_table", "furnace", "torch", "cobblestone", "dirt"' },
          x: { type: 'integer', description: 'Optional: X coordinate to place at' },
          y: { type: 'integer', description: 'Optional: Y coordinate to place at' },
          z: { type: 'integer', description: 'Optional: Z coordinate to place at' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'equip',
      description: 'Select an item in your hotbar. Use before attacking (equip sword), mining (equip pickaxe), or placing blocks. The item must already be in your hotbar slots 0-8.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Item to equip/select, e.g. "diamond_sword", "iron_pickaxe", "torch"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look',
      description: 'Look in a specific direction by setting yaw and pitch. Yaw: 0=south, 90=west, 180=north, 270=east. Pitch: -90=up, 0=horizon, 90=down. Use before break_block to aim at a specific block.',
      parameters: {
        type: 'object',
        properties: {
          yaw: { type: 'number', description: 'Horizontal rotation in degrees (0=south, 90=west, 180=north, 270=east)' },
          pitch: { type: 'number', description: 'Vertical rotation in degrees (-90=up, 0=horizon, 90=down)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'break_block',
      description: 'Mine/break the block you are currently looking at. Sustained action that takes multiple ticks depending on block hardness and tool. Use look first to aim at the target block. Good for punching trees (oak_log), mining single blocks nearby. Faster than Baritone mine for blocks right in front of you.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'walk',
      description: 'Walk forward in the direction you are facing for a number of ticks. 20 ticks = ~1 second of walking. Use after look to walk toward something. Good for short-distance movement without Baritone pathfinding.',
      parameters: {
        type: 'object',
        properties: {
          ticks: { type: 'integer', description: 'How many ticks to walk (20 ticks = ~1 second, max 200)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chat',
      description: 'Send a chat message or command. Prefix with / for game commands (e.g. "/time set day"). Messages without / are sent as public chat. Also used for Baritone commands (prefix with #).',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message or command to send' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'use_item',
      description: 'Use/activate the currently held item. Use for: right-clicking with a bow (to draw), using a shield, eating specific food, using flint_and_steel, using a bucket, throwing ender pearls.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drop',
      description: 'Drop the currently selected item. Use to discard unwanted items or free inventory space.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'integer', description: 'Number to drop. Use -1 for entire stack.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'swap_hands',
      description: 'Swap items between main hand and offhand. Useful for putting a shield in offhand while keeping sword in main hand.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop',
      description: 'Stop all current actions. Cancels Baritone pathfinding, sustained actions (mining, walking, eating), and releases all held keys. Use when you need to change plans or abort a failing action.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'jump',
      description: 'Jump once. Only works when standing on the ground. Use to get over 1-block obstacles or reach higher blocks.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sneak',
      description: 'Toggle sneaking on/off. While sneaking you move slowly but won\'t fall off edges. Essential for building bridges over gaps or placing blocks on edges.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true to start sneaking, false to stop' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sprint',
      description: 'Toggle sprinting on/off. Sprinting doubles movement speed but drains food faster. Requires food bar above 6. Use for long-distance running or fleeing danger.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true to start sprinting, false to stop' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Do nothing this tick. Use when waiting for something to finish (furnace smelting, Baritone pathing) or when no action is needed right now.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_screen',
      description: 'Close any open GUI screen (inventory, crafting table, furnace, chest). Use after crafting or smelting to return to gameplay.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export function getToolNames() {
  return GAME_TOOLS.map(t => t.function.name);
}
