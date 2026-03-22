// tools.js — Stripped-down tool set for maximum speed
// Only core Minecraft actions. No fluff.

export const GAME_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Pathfind to coordinates.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer' },
          y: { type: 'integer' },
          z: { type: 'integer' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look_at_block',
      description: 'Walk to and face a block. Primary way to mine — look at a surface block, then break_block.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer' },
          y: { type: 'integer' },
          z: { type: 'integer' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'break_block',
      description: 'Mine the block at crosshair. Use look_at_block first.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'craft',
      description: 'Craft item. Need ingredients in inventory. 3x3 recipes need nearby crafting_table.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "oak_planks", "stick", "wooden_pickaxe"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attack',
      description: 'Attack nearest entity or specific target.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'e.g. "zombie", "pig"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eat',
      description: 'Eat food from hotbar.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'equip',
      description: 'Select item in hotbar.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "iron_sword", "stone_pickaxe"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place',
      description: 'Place block from inventory at coordinates or at crosshair. For building, always specify x,y,z.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "oak_planks", "cobblestone", "oak_door"' },
          x: { type: 'integer', description: 'Target X coordinate' },
          y: { type: 'integer', description: 'Target Y coordinate' },
          z: { type: 'integer', description: 'Target Z coordinate' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'interact_block',
      description: 'Right-click block (open chests, doors, crafting tables). Must be within 4 blocks.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer' },
          y: { type: 'integer' },
          z: { type: 'integer' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pickup_items',
      description: 'Walk around to collect dropped items nearby.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chat',
      description: 'Say something in game chat. Use to talk to players.',
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
      name: 'smelt',
      description: 'Smelt item in nearby furnace. Works for ores (raw_iron) and cooking (raw_beef, raw_chicken, raw_porkchop, potato).',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "raw_iron", "raw_beef", "raw_chicken"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop',
      description: 'Cancel current action (pathfinding, mining).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_screen',
      description: 'Close any open GUI.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recipes',
      description: 'Look up crafting recipe for an item.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "iron_pickaxe", "furnace"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wiki',
      description: 'Search Minecraft wiki.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notepad',
      description: 'Read or write persistent notepad.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'write'], description: 'read or write' },
          content: { type: 'string', description: 'Text to write (ignored on read)' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build',
      description: 'Build a structure from blueprints. Available: small-cabin, animal-pen, crop-farm. Specify where to place the origin corner.',
      parameters: {
        type: 'object',
        properties: {
          blueprint: { type: 'string', description: 'Blueprint name: "small-cabin", "animal-pen", "crop-farm"' },
          x: { type: 'integer', description: 'Origin X coordinate (front-left corner)' },
          y: { type: 'integer', description: 'Origin Y coordinate (ground level)' },
          z: { type: 'integer', description: 'Origin Z coordinate (front-left corner)' },
        },
        required: ['blueprint', 'x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_build',
      description: 'Cancel the current building project.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'farm',
      description: 'Start automated crop farming at coordinates. Tills soil and plants seeds. Build crop-farm blueprint first.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'Farm origin X (front-left corner)' },
          y: { type: 'integer', description: 'Farm origin Y (ground level)' },
          z: { type: 'integer', description: 'Farm origin Z (front-left corner)' },
          crop: { type: 'string', description: 'Crop type: "wheat_seeds", "beetroot_seeds", "carrot", "potato". Default: wheat_seeds' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'harvest',
      description: 'Harvest mature crops at farm coordinates. Use after crops have grown.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'Farm origin X' },
          y: { type: 'integer', description: 'Farm origin Y' },
          z: { type: 'integer', description: 'Farm origin Z' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'breed',
      description: 'Breed animals. Equips food and feeds 2 nearby animals. Cows=wheat, chickens=seeds, pigs=carrots, sheep=wheat.',
      parameters: {
        type: 'object',
        properties: {
          animal: { type: 'string', description: 'e.g. "cow", "chicken", "pig", "sheep"' },
        },
        required: ['animal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fish',
      description: 'Cast fishing rod and wait for a bite (up to 30s). Need fishing_rod in inventory. Auto-equips rod.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_chat',
      description: 'Read recent chat messages.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_blocks',
      description: 'Scan the area for a specific block type on the surface. Returns up to 5 nearest with coordinates.',
      parameters: {
        type: 'object',
        properties: {
          block_type: { type: 'string', description: 'Block to find, e.g. "oak_log", "iron_ore", "wheat"' },
          radius: { type: 'integer', description: 'Search radius 1-100 (default 50)' },
        },
        required: ['block_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_home',
      description: 'Teleport to your saved home location. Fast travel back to base.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Home name (default: "home")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_home',
      description: 'Save current location as home. Use at your base so you can teleport back.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Home name (default: "home")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'share_location',
      description: 'Mark a named location and share coordinates with everyone. Use when you find something interesting.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Location name, e.g. "iron cave", "good fishing spot"' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_skills',
      description: 'Check your skill levels — foraging, mining, farming, excavation, fighting. See what abilities you have unlocked.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'use_ability',
      description: 'Activate a special ability if ready. Treecapitator (fell whole tree), Speed Mine (fast mining), Terraform (fast digging). Equip the right tool first. Has a cooldown — will tell you when ready.',
      parameters: {
        type: 'object',
        properties: {
          ability_name: { type: 'string', enum: ['treecapitator', 'speed_mine', 'terraform'], description: 'Ability to activate' },
        },
        required: ['ability_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_shops',
      description: 'Search for player shops selling or buying a specific item. See prices and locations.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Item to search for, e.g. "oak_log", "iron_ingot"' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_shop',
      description: 'Final step to create a chest shop. BEFORE calling this: 1) place a chest, 2) equip the item to sell, 3) right-click the chest. Then call create_shop with the price. Skipping steps will fail silently.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number', description: 'Price per item' },
          item: { type: 'string', description: 'Item to sell, e.g. "oak_log"' },
        },
        required: ['price', 'item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_context',
      description: 'Save a persistent context document. Survives all memory wipes. Use for plans, task lists, notes.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'e.g. "plan.md", "tasks.md". Only .md/.txt/.json allowed.' },
          content: { type: 'string', description: 'Document content (max 8000 chars)' },
        },
        required: ['filename', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_context',
      description: 'Delete a persistent context document.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename to delete' },
        },
        required: ['filename'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_task',
      description: 'Create a plan with subtasks. Replaces any existing plan. Use for complex multi-step goals.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Overall goal (e.g. "build a house")' },
          subtasks: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ordered list of subtasks (e.g. ["gather 20 oak_log", "craft planks", "build walls"])',
          },
        },
        required: ['goal', 'subtasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update subtask status. Mark done, failed, or in-progress. Use index from your task plan.',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Subtask index (0-based)' },
          status: { type: 'string', enum: ['done', 'failed', 'in-progress', 'blocked'], description: 'New status' },
          note: { type: 'string', description: 'Optional note about result or failure reason' },
          expected_outcome: { type: 'string', description: 'What should be true after this subtask (e.g. "have wooden_pickaxe in inventory"). Used for automatic review.' },
        },
        required: ['index', 'status'],
      },
    },
  },
];

// Inject 'reason' field for viewer-facing explanation
for (const tool of GAME_TOOLS) {
  const props = tool.function.parameters.properties || {};
  props.reason = { type: 'string', description: 'Brief reason (5 words max)' };
  tool.function.parameters.properties = props;
}

export function getToolNames() {
  return GAME_TOOLS.map(t => t.function.name);
}
