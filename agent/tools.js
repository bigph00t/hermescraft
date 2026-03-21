// tools.js — Stripped-down tool set for maximum speed
// Only core Minecraft actions. No fluff.

export const GAME_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'mine',
      description: 'Pathfind to and mine a block type (10s). Use for any resource gathering.',
      parameters: {
        type: 'object',
        properties: {
          blockName: { type: 'string', description: 'e.g. "oak_log", "iron_ore"' },
        },
        required: ['blockName'],
      },
    },
  },
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
      description: 'Walk to and face a block. Use before break_block for targeted mining.',
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
      description: 'Smelt item in nearby furnace.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'e.g. "raw_iron", "beef"' },
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
      name: 'read_chat',
      description: 'Read recent chat messages.',
      parameters: { type: 'object', properties: {} },
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
