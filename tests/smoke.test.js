// smoke.test.js — Comprehensive smoke test for all v2 modules
// Validates module imports, export shapes, and key integration contracts
// without a live Minecraft server. Pure Node.js ESM — no test framework.

// ── Test Runner ──

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    console.log(`  PASS  ${name}`)
    passed++
  } else {
    console.log(`  FAIL  ${name}`)
    failed++
  }
}

function section(title) {
  console.log(`\n── ${title} ──`)
}

// ── Section 1: Module Import Validation ──

section('Module Import Validation — mind/')

const mindIndex = await import('../mind/index.js')
assert('mind/index: isSkillRunning exported', typeof mindIndex.isSkillRunning === 'function')
assert('mind/index: initMind exported', typeof mindIndex.initMind === 'function')

const registry = await import('../mind/registry.js')
assert('mind/registry: dispatch exported', typeof registry.dispatch === 'function')
assert('mind/registry: listCommands exported', typeof registry.listCommands === 'function')

const prompt = await import('../mind/prompt.js')
assert('mind/prompt: buildSystemPrompt exported', typeof prompt.buildSystemPrompt === 'function')
assert('mind/prompt: buildUserMessage exported', typeof prompt.buildUserMessage === 'function')
assert('mind/prompt: buildStateText exported', typeof prompt.buildStateText === 'function')
assert('mind/prompt: getBuildContextForPrompt exported', typeof prompt.getBuildContextForPrompt === 'function')

const llm = await import('../mind/llm.js')
assert('mind/llm: clearConversation exported', typeof llm.clearConversation === 'function')
assert('mind/llm: getHistory exported', typeof llm.getHistory === 'function')
assert('mind/llm: queryLLM exported', typeof llm.queryLLM === 'function')
assert('mind/llm: trimHistoryGraduated exported', typeof llm.trimHistoryGraduated === 'function')

const config = await import('../mind/config.js')
assert('mind/config: loadAgentConfig exported', typeof config.loadAgentConfig === 'function')

const memory = await import('../mind/memory.js')
assert('mind/memory: initMemory exported', typeof memory.initMemory === 'function')
assert('mind/memory: loadMemory exported', typeof memory.loadMemory === 'function')
assert('mind/memory: saveMemory exported', typeof memory.saveMemory === 'function')
assert('mind/memory: recordDeath exported', typeof memory.recordDeath === 'function')
assert('mind/memory: getMemoryForPrompt exported', typeof memory.getMemoryForPrompt === 'function')
assert('mind/memory: addWorldKnowledge exported', typeof memory.addWorldKnowledge === 'function')
assert('mind/memory: writeSessionEntry exported', typeof memory.writeSessionEntry === 'function')
assert('mind/memory: periodicSave exported', typeof memory.periodicSave === 'function')

const social = await import('../mind/social.js')
assert('mind/social: initSocial exported', typeof social.initSocial === 'function')
assert('mind/social: trackPlayer exported', typeof social.trackPlayer === 'function')
assert('mind/social: getPlayersForPrompt exported', typeof social.getPlayersForPrompt === 'function')
assert('mind/social: getPartnerLastChat exported', typeof social.getPartnerLastChat === 'function')
assert('mind/social: savePlayers exported', typeof social.savePlayers === 'function')

const locations = await import('../mind/locations.js')
assert('mind/locations: initLocations exported', typeof locations.initLocations === 'function')
assert('mind/locations: setHome exported', typeof locations.setHome === 'function')
assert('mind/locations: getHome exported', typeof locations.getHome === 'function')
assert('mind/locations: saveLocation exported', typeof locations.saveLocation === 'function')
assert('mind/locations: getLocationsForPrompt exported', typeof locations.getLocationsForPrompt === 'function')
assert('mind/locations: saveLocations exported', typeof locations.saveLocations === 'function')

section('Module Import Validation — body/')

const interrupt = await import('../body/interrupt.js')
assert('body/interrupt: clearInterrupt exported', typeof interrupt.clearInterrupt === 'function')
assert('body/interrupt: isInterrupted exported', typeof interrupt.isInterrupted === 'function')
assert('body/interrupt: requestInterrupt exported', typeof interrupt.requestInterrupt === 'function')

const normalizer = await import('../body/normalizer.js')
assert('body/normalizer: normalizeItemName exported', typeof normalizer.normalizeItemName === 'function')
assert('body/normalizer: normalizeBlockName exported', typeof normalizer.normalizeBlockName === 'function')

const navigate = await import('../body/navigate.js')
assert('body/navigate: navigateTo exported', typeof navigate.navigateTo === 'function')
assert('body/navigate: navigateToBlock exported', typeof navigate.navigateToBlock === 'function')

const dig = await import('../body/dig.js')
assert('body/dig: digBlock exported', typeof dig.digBlock === 'function')

const place = await import('../body/place.js')
assert('body/place: placeBlock exported', typeof place.placeBlock === 'function')
assert('body/place: placeBlockOnTop exported', typeof place.placeBlockOnTop === 'function')
assert('body/place: FACE exported as object', place.FACE !== null && typeof place.FACE === 'object')

const crafter = await import('../body/crafter.js')
assert('body/crafter: solveCraft exported', typeof crafter.solveCraft === 'function')

const modes = await import('../body/modes.js')
assert('body/modes: initModes exported', typeof modes.initModes === 'function')

section('Module Import Validation — body/skills/')

const gather = await import('../body/skills/gather.js')
assert('body/skills/gather: gather exported', typeof gather.gather === 'function')

const mine = await import('../body/skills/mine.js')
assert('body/skills/mine: mine exported', typeof mine.mine === 'function')

const craft = await import('../body/skills/craft.js')
assert('body/skills/craft: craft exported', typeof craft.craft === 'function')

const smelt = await import('../body/skills/smelt.js')
assert('body/skills/smelt: smelt exported', typeof smelt.smelt === 'function')

const combat = await import('../body/skills/combat.js')
assert('body/skills/combat: attackTarget exported', typeof combat.attackTarget === 'function')
assert('body/skills/combat: combatLoop exported', typeof combat.combatLoop === 'function')
assert('body/skills/combat: HOSTILE_MOBS is Set', combat.HOSTILE_MOBS instanceof Set)
assert('body/skills/combat: HOSTILE_MOBS non-empty', combat.HOSTILE_MOBS.size > 0)

const inventory = await import('../body/skills/inventory.js')
assert('body/skills/inventory: equipBestArmor exported', typeof inventory.equipBestArmor === 'function')
assert('body/skills/inventory: eatIfHungry exported', typeof inventory.eatIfHungry === 'function')

const build = await import('../body/skills/build.js')
assert('body/skills/build: initBuild exported', typeof build.initBuild === 'function')
assert('body/skills/build: listBlueprints exported', typeof build.listBlueprints === 'function')
assert('body/skills/build: getActiveBuild exported', typeof build.getActiveBuild === 'function')
assert('body/skills/build: getBuildProgress exported', typeof build.getBuildProgress === 'function')
assert('body/skills/build: build exported', typeof build.build === 'function')

const chest = await import('../body/skills/chest.js')
assert('body/skills/chest: initChestMemory exported', typeof chest.initChestMemory === 'function')
assert('body/skills/chest: getChestMemory exported', typeof chest.getChestMemory === 'function')
assert('body/skills/chest: rememberChest exported', typeof chest.rememberChest === 'function')
assert('body/skills/chest: findChest exported', typeof chest.findChest === 'function')
assert('body/skills/chest: depositToChest exported', typeof chest.depositToChest === 'function')
assert('body/skills/chest: withdrawFromChest exported', typeof chest.withdrawFromChest === 'function')

// ── Section 2: Registry Completeness ──

section('Registry Completeness')

const commands = registry.listCommands()
assert('registry has 12 commands', commands.length === 12)

const expectedCmds = ['gather', 'mine', 'craft', 'smelt', 'navigate', 'chat', 'idle', 'combat', 'deposit', 'withdraw', 'build', 'design']
for (const cmd of expectedCmds) {
  assert(`registry has !${cmd}`, commands.includes(cmd))
}

// ── Section 3: System Prompt Completeness ──

section('System Prompt Completeness')

const mockBot = {
  username: 'smoke_test',
  entity: { position: { x: 0, y: 64, z: 0 } },
  inventory: { items: () => [] },
  time: { timeOfDay: 6000 },
  entities: {},
  health: 20,
  food: 20,
}

const sysPrompt = prompt.buildSystemPrompt(mockBot)
assert('buildSystemPrompt returns a string', typeof sysPrompt === 'string')
assert('system prompt is non-empty', sysPrompt.length > 100)

const promptCmds = ['gather', 'mine', 'craft', 'smelt', 'navigate', 'chat', 'build', 'design', 'sethome', 'combat', 'idle', 'deposit', 'withdraw']
for (const cmd of promptCmds) {
  assert(`system prompt mentions !${cmd}`, sysPrompt.includes(`!${cmd}`))
}

// ── Section 4: Normalizer Correctness ──

section('Normalizer Correctness')

// Block normalization — iron_ore and gold_ore must stay as-is (they ARE valid blocks)
assert('normalizeBlockName iron_ore => iron_ore', normalizer.normalizeBlockName('iron_ore') === 'iron_ore')
assert('normalizeBlockName gold_ore => gold_ore', normalizer.normalizeBlockName('gold_ore') === 'gold_ore')

// Item normalization — iron_ore/gold_ore should map to raw_* (item-only aliases)
assert('normalizeItemName iron_ore => raw_iron', normalizer.normalizeItemName('iron_ore') === 'raw_iron')
assert('normalizeItemName gold_ore => raw_gold', normalizer.normalizeItemName('gold_ore') === 'raw_gold')

// Common aliases work for both
assert('normalizeItemName sticks => stick', normalizer.normalizeItemName('sticks') === 'stick')
assert('normalizeBlockName cobble => cobblestone', normalizer.normalizeBlockName('cobble') === 'cobblestone')
assert('normalizeItemName wood => oak_log', normalizer.normalizeItemName('wood') === 'oak_log')
assert('normalizeBlockName planks => oak_planks', normalizer.normalizeBlockName('planks') === 'oak_planks')

// Minecraft: prefix stripping
assert('normalizeItemName minecraft:stick => stick', normalizer.normalizeItemName('minecraft:stick') === 'stick')

// Case insensitive
assert('normalizeItemName OAK_LOG => oak_log', normalizer.normalizeItemName('OAK_LOG') === 'oak_log')

// Falsy input
assert('normalizeItemName empty string => empty string', normalizer.normalizeItemName('') === '')

// ── Section 5: Crafter Solver Sanity ──

section('Crafter Solver Sanity')

// With empty inventory, crafting a stick requires planks (missing)
const result1 = crafter.solveCraft('stick', {})
assert('solveCraft stick w/empty inv returns object', result1 && typeof result1 === 'object')
assert('solveCraft stick w/empty inv has steps array', Array.isArray(result1.steps))
assert('solveCraft stick w/empty inv has missing array', Array.isArray(result1.missing))
assert('solveCraft stick w/empty inv has missing items', result1.missing.length > 0)

// With planks in inventory, crafting sticks should succeed
const result2 = crafter.solveCraft('stick', { 'oak_planks': 4 })
assert('solveCraft stick w/planks has steps', result2.steps.length > 0)
assert('solveCraft stick w/planks no missing', result2.missing.length === 0)

// Steps have expected shape
if (result2.steps.length > 0) {
  const step = result2.steps[0]
  assert('solveCraft step has action field', step.action === 'craft')
  assert('solveCraft step has item field', typeof step.item === 'string')
  assert('solveCraft step has count field', typeof step.count === 'number')
  assert('solveCraft step has ingredients array', Array.isArray(step.ingredients))
  assert('solveCraft step has needsTable boolean', typeof step.needsTable === 'boolean')
}

// ── Section 6: LLM Module Exports ──

section('LLM Module Exports')

assert('llm: clearConversation is a function', typeof llm.clearConversation === 'function')
assert('llm: getHistory is a function', typeof llm.getHistory === 'function')
assert('llm: queryLLM is a function', typeof llm.queryLLM === 'function')
assert('llm: trimHistoryGraduated is a function', typeof llm.trimHistoryGraduated === 'function')

// Test that clearConversation and getHistory work together
llm.clearConversation()
const histBefore = llm.getHistory()
assert('llm: getHistory returns array', Array.isArray(histBefore))
assert('llm: getHistory empty after clearConversation', histBefore.length === 0)

// ── Section 7: Interrupt Module ──

section('Interrupt Module Behavior')

const fakeBot = { interrupt_code: false }
assert('isInterrupted false initially', interrupt.isInterrupted(fakeBot) === false)

interrupt.requestInterrupt(fakeBot)
assert('isInterrupted true after requestInterrupt', interrupt.isInterrupted(fakeBot) === true)

interrupt.clearInterrupt(fakeBot)
assert('isInterrupted false after clearInterrupt', interrupt.isInterrupted(fakeBot) === false)

// Double-clear is safe
interrupt.clearInterrupt(fakeBot)
assert('isInterrupted false after double clear', interrupt.isInterrupted(fakeBot) === false)

// requestInterrupt sets flag regardless of prior state
interrupt.requestInterrupt(fakeBot)
interrupt.requestInterrupt(fakeBot)
assert('isInterrupted true after double request', interrupt.isInterrupted(fakeBot) === true)
interrupt.clearInterrupt(fakeBot)

// ── Section 8: Blueprint Loading ──

section('Blueprint Loading')

const blueprints = build.listBlueprints()
assert('listBlueprints returns array', Array.isArray(blueprints))
assert('at least 1 blueprint exists', blueprints.length >= 1)

for (const bp of blueprints) {
  assert(`blueprint "${bp.name}" has name string`, typeof bp.name === 'string' && bp.name.length > 0)
  assert(`blueprint "${bp.name}" has description string`, typeof bp.description === 'string')
  assert(`blueprint "${bp.name}" has size.x number`, bp.size && typeof bp.size.x === 'number')
  assert(`blueprint "${bp.name}" has size.y number`, bp.size && typeof bp.size.y === 'number')
  assert(`blueprint "${bp.name}" has size.z number`, bp.size && typeof bp.size.z === 'number')
}

// getActiveBuild starts null (no config loaded)
const activeBuild = build.getActiveBuild()
assert('getActiveBuild returns null or object', activeBuild === null || typeof activeBuild === 'object')

// getBuildProgress returns string
const progress = build.getBuildProgress()
assert('getBuildProgress returns string', typeof progress === 'string')

// ── Section 9: Chest Memory ──

section('Chest Memory')

const chestMemory = chest.getChestMemory()
assert('getChestMemory returns array', Array.isArray(chestMemory))

// ── Section 10: PLACE.FACE constant ──

section('Place Module Constants')

assert('FACE is a non-null object', place.FACE !== null && typeof place.FACE === 'object')
assert('FACE has at least 1 key', Object.keys(place.FACE).length >= 1)

// ── Section 11: scan.js — 3D area block scanner ──

section('scan.js — scanArea')

const scan = await import('../body/skills/scan.js')
assert('body/skills/scan: scanArea exported', typeof scan.scanArea === 'function')

// Build a mock bot whose blockAt returns predictable blocks
const scanBot = {
  blockAt(vec3) {
    // 2x2x2 cube at (0,0,0)-(1,1,1): all stone except (0,0,0) = air
    if (vec3.x === 0 && vec3.y === 0 && vec3.z === 0) return { name: 'air' }
    return { name: 'stone' }
  },
}

const r1 = scan.scanArea(scanBot, 0, 0, 0, 1, 1, 1)
assert('scanArea success: true', r1.success === true)
assert('scanArea volume: 8', r1.volume === 8)
assert('scanArea blocks is object', r1.blocks && typeof r1.blocks === 'object')
assert('scanArea air count = 1', r1.blocks['air'] === 1)
assert('scanArea stone count = 7', r1.blocks['stone'] === 7)
assert('scanArea total excludes air/unloaded', r1.total === 7)

// Coordinate normalization (x1 > x2 still works)
const r2 = scan.scanArea(scanBot, 1, 1, 1, 0, 0, 0)
assert('scanArea coord normalization: volume 8', r2.volume === 8)
assert('scanArea coord normalization: stone = 7', r2.blocks['stone'] === 7)

// NaN coordinate returns invalid_coordinates
const r3 = scan.scanArea(scanBot, NaN, 0, 0, 1, 1, 1)
assert('scanArea NaN coord: success false', r3.success === false)
assert('scanArea NaN coord: reason invalid_coordinates', r3.reason === 'invalid_coordinates')

// Volume > 32768 returns scan_too_large
const r4 = scan.scanArea(scanBot, 0, 0, 0, 33, 33, 33)
assert('scanArea oversized: success false', r4.success === false)
assert('scanArea oversized: reason scan_too_large', r4.reason === 'scan_too_large')

// Unloaded chunk (blockAt returns null) counted as "unloaded"
const unloadedBot = { blockAt(_v) { return null } }
const r5 = scan.scanArea(unloadedBot, 0, 0, 0, 0, 0, 0)
assert('scanArea unloaded: success true', r5.success === true)
assert('scanArea unloaded: has unloaded key', r5.blocks['unloaded'] === 1)
assert('scanArea unloaded: total is 0 (air/unloaded excluded)', r5.total === 0)

// ── Section 12: build.js — updatePalette ──

section('build.js — updatePalette')

assert('body/skills/build: updatePalette exported', typeof build.updatePalette === 'function')

// No active build → failure
const upNoActive = build.updatePalette('stone', 'cobblestone')
assert('updatePalette no active build: success false', upNoActive.success === false)
assert('updatePalette no active build: reason no_active_build', upNoActive.reason === 'no_active_build')

// ── Final Summary ──

console.log(`\n${'='.repeat(40)}`)
console.log(`SMOKE TEST: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(40)}`)
process.exit(failed > 0 ? 1 : 0)
