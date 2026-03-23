// buildPlanner.js — Build planning module: plan, decompose sections, audit materials, persist plans

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

// ── Module State ──

let _buildsDir = ''

// ── Internal Helpers ──

// buildSpecPrompt(description) — system prompt asking LLM to generate overall build spec JSON
function buildSpecPrompt(description) {
  return `You are a Minecraft build planner. Given a building description, generate a JSON spec for the build.

Return ONLY valid JSON with this exact structure:
{
  "style": "description of architectural style",
  "materials": {
    "primary": "main_block_name",
    "secondary": "secondary_block_name",
    "accent": "accent_block_name"
  },
  "dimensions": {
    "width": number,
    "height": number,
    "depth": number
  }
}

Constraints:
- Max footprint: 30x30 (width and depth each <= 30)
- Max height: 15
- Use valid Minecraft 1.21.1 block names (e.g. stone_bricks, oak_planks, glass_pane, cobblestone)
- No coordinate arrays — only style, materials, dimensions

Building to plan: ${description}`
}

// extractJSON(raw) — strip <think> blocks, try direct parse, then regex fallback
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null
  // Strip <think> tags
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  // Try direct parse
  try {
    return JSON.parse(stripped)
  } catch {}
  // Regex fallback — find first { ... }
  const match = stripped.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {}
  }
  return null
}

// countBlocks(blueprint) — count non-'.' non-' ' characters across all layer grids
function countBlocks(blueprint) {
  if (!blueprint?.layers) return 0
  let count = 0
  for (const layer of blueprint.layers) {
    for (const row of (layer.grid || [])) {
      for (const char of row) {
        if (char !== '.' && char !== ' ') count++
      }
    }
  }
  return count
}

// ── Init ──

export function initBuildPlanner(config) {
  _buildsDir = join(config.dataDir, 'builds')
  if (!existsSync(_buildsDir)) {
    mkdirSync(_buildsDir, { recursive: true })
  }
}

// ── Persistence ──

// saveBuildPlan(plan) — atomic write: tmp then renameSync
export function saveBuildPlan(plan) {
  if (!_buildsDir) return
  const filePath = join(_buildsDir, `${plan.id}.json`)
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  renameSync(tmp, filePath)
}

// loadBuildPlan(planId) — read + JSON.parse, return null on error
export function loadBuildPlan(planId) {
  if (!_buildsDir) return null
  const filePath = join(_buildsDir, `${planId}.json`)
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

// listBuildPlans() — list all plan JSON files (excluding section files)
export function listBuildPlans() {
  if (!_buildsDir || !existsSync(_buildsDir)) return []
  try {
    return readdirSync(_buildsDir)
      .filter(f => f.endsWith('.json') && !f.includes('-section-'))
      .map(f => {
        try {
          return JSON.parse(readFileSync(join(_buildsDir, f), 'utf-8'))
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

// getActivePlan() — find first plan with status 'active'
export function getActivePlan() {
  return listBuildPlans().find(p => p.status === 'active') || null
}

// ── Section Decomposition ──

// decomposeSections(spec) — deterministic layout from spec dimensions
// Each section gets { id, offsetX, offsetY, offsetZ, maxW, maxD, maxH }
export function decomposeSections(spec) {
  const { width, height, depth } = spec.dimensions
  const sections = []

  // Foundation — full footprint, 1 tall
  sections.push({
    id: 'foundation',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    maxW: width,
    maxD: depth,
    maxH: 1,
  })

  // Wall height = height - 2 (above foundation, below roof)
  const wallH = Math.max(1, height - 2)

  // Helper: split a wall section if it exceeds 10 on any axis
  function addWall(id, offsetX, offsetY, offsetZ, maxW, maxD) {
    // If both dimensions fit within 10, add single section
    if (maxW <= 10 && maxD <= 10) {
      sections.push({ id, offsetX, offsetY, offsetZ, maxW, maxD, maxH: Math.min(wallH, 8) })
      return
    }
    // Split along the larger dimension
    if (maxW > maxD) {
      const half = Math.ceil(maxW / 2)
      sections.push({ id: `${id}_a`, offsetX, offsetY, offsetZ, maxW: half, maxD, maxH: Math.min(wallH, 8) })
      sections.push({ id: `${id}_b`, offsetX: offsetX + half, offsetY, offsetZ, maxW: maxW - half, maxD, maxH: Math.min(wallH, 8) })
    } else {
      const half = Math.ceil(maxD / 2)
      sections.push({ id: `${id}_a`, offsetX, offsetY, offsetZ, maxW, maxD: half, maxH: Math.min(wallH, 8) })
      sections.push({ id: `${id}_b`, offsetX, offsetY, offsetZ: offsetZ + half, maxW, maxD: maxD - half, maxH: Math.min(wallH, 8) })
    }
  }

  // North wall — along x axis, z=0 face
  addWall('north_wall', 0, 1, 0, width, 1)
  // South wall — along x axis, z=depth-1 face
  addWall('south_wall', 0, 1, depth - 1, width, 1)
  // East wall — along z axis, x=width-1 face (interior z range: 1 to depth-2)
  addWall('east_wall', width - 1, 1, 1, 1, Math.max(1, depth - 2))
  // West wall — along z axis, x=0 face (interior z range: 1 to depth-2)
  addWall('west_wall', 0, 1, 1, 1, Math.max(1, depth - 2))

  // Roof — full footprint, 1 tall
  sections.push({
    id: 'roof',
    offsetX: 0,
    offsetY: height - 1,
    offsetZ: 0,
    maxW: width,
    maxD: depth,
    maxH: 1,
  })

  return sections
}

// ── Material Audit ──

// auditMaterials(inventory, plan) — compare needed blocks vs inventory array
// inventory: [{ name, count }]
// Updates plan.materialAudit in place
export function auditMaterials(inventory, plan) {
  const needed = {}

  for (const section of (plan.sections || [])) {
    if (section.status === 'done') continue
    if (!section.blueprintFile) continue

    // Load section blueprint
    let bp = null
    try {
      const filePath = existsSync(section.blueprintFile)
        ? section.blueprintFile
        : join(_buildsDir, section.blueprintFile)
      bp = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      // Section blueprint not available yet
      continue
    }

    if (!bp?.palette || !bp?.layers) continue

    // Resolve palette chars to block names — use first preferred, else 'cobblestone'
    for (const [char, entry] of Object.entries(bp.palette)) {
      const preferred = Array.isArray(entry?.preferred) ? entry.preferred : []
      // Find first preferred block available in inventory
      let resolvedBlock = null
      for (const blockName of preferred) {
        if (inventory.some(item => item.name === blockName && item.count > 0)) {
          resolvedBlock = blockName
          break
        }
      }
      // Fallback to first preferred, then cobblestone
      if (!resolvedBlock) resolvedBlock = preferred[0] || 'cobblestone'

      // Count occurrences of this char across all layers
      let charCount = 0
      for (const layer of (bp.layers || [])) {
        for (const row of (layer.grid || [])) {
          for (const c of row) {
            if (c === char) charCount++
          }
        }
      }

      if (charCount > 0) {
        needed[resolvedBlock] = (needed[resolvedBlock] || 0) + charCount
      }
    }
  }

  // Build have map from inventory
  const have = {}
  for (const item of (inventory || [])) {
    if (item.name && item.count > 0) {
      have[item.name] = (have[item.name] || 0) + item.count
    }
  }

  // Compute gap
  const gap = {}
  for (const [block, count] of Object.entries(needed)) {
    const deficit = count - (have[block] || 0)
    if (deficit > 0) gap[block] = deficit
  }

  const audit = {
    needed,
    have,
    gap,
    ready: Object.keys(gap).length === 0,
  }

  // Update plan in place
  plan.materialAudit = audit
  return audit
}

// ── Build Plan Creation ──

// planBuild(description, queryLLMFn, buildDesignPromptFn, validateBlueprintFn, botPosition) — async
export async function planBuild(description, queryLLMFn, buildDesignPromptFn, validateBlueprintFn, botPosition) {
  if (!_buildsDir) return { success: false, reason: 'buildPlanner not initialized — call initBuildPlanner first' }

  const planId = randomUUID().slice(0, 8)

  try {
    // Step 1: Generate overall spec via LLM
    const specRaw = await queryLLMFn(buildSpecPrompt(description), 'Generate the build spec JSON now.')
    if (!specRaw) return { success: false, reason: 'LLM returned empty response for build spec' }

    // Step 2: Extract JSON from response
    const spec = extractJSON(specRaw)
    if (!spec) return { success: false, reason: 'Could not parse JSON from build spec LLM response' }
    if (!spec.dimensions?.width || !spec.dimensions?.height || !spec.dimensions?.depth) {
      return { success: false, reason: 'Build spec missing required dimensions.width/height/depth' }
    }

    // Step 3: Decompose into sections
    const sectionLayouts = decomposeSections(spec)

    // Step 4: Generate blueprint for each section
    const sections = []
    let totalEstimatedBlocks = 0

    for (const layout of sectionLayouts) {
      const sectionDesc = `${layout.id.replace(/_/g, ' ')} section of a ${spec.dimensions.width}x${spec.dimensions.height}x${spec.dimensions.depth} ${spec.style}. ` +
        `Size: ${layout.maxW} wide x ${layout.maxH} tall x ${layout.maxD} deep. ` +
        `Primary material: ${spec.materials?.primary || 'stone_bricks'}, secondary: ${spec.materials?.secondary || 'oak_planks'}`

      let bpJson = null
      let blockCount = 0
      let blueprintFileRel = `${planId}-section-${layout.id}.json`
      let blueprintFileFull = join(_buildsDir, blueprintFileRel)

      try {
        const bpRaw = await queryLLMFn(buildDesignPromptFn(sectionDesc, []), 'Generate the section blueprint JSON now.')
        if (bpRaw) {
          // Extract JSON from response
          const extracted = extractJSON(bpRaw)
          if (extracted) {
            bpJson = JSON.stringify(extracted)
            // Validate blueprint
            const validation = validateBlueprintFn(bpJson)
            if (validation.valid) {
              blockCount = countBlocks(validation.blueprint)
              // Write section blueprint to disk
              const tmp = blueprintFileFull + '.tmp'
              writeFileSync(tmp, bpJson, 'utf-8')
              renameSync(tmp, blueprintFileFull)
            } else {
              // Blueprint invalid — write raw extracted JSON anyway for partial recovery
              const tmp = blueprintFileFull + '.tmp'
              writeFileSync(tmp, bpJson, 'utf-8')
              renameSync(tmp, blueprintFileFull)
            }
          }
        }
      } catch (err) {
        // Section blueprint generation failed — record with empty blueprint path
        blueprintFileRel = ''
        blueprintFileFull = ''
      }

      totalEstimatedBlocks += blockCount

      sections.push({
        id: layout.id,
        status: 'pending',
        blueprintFile: blueprintFileRel,
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
        offsetZ: layout.offsetZ,
        completedIndex: 0,
        blockCount,
        claimedBy: null,
        repairAttempts: 0,
      })
    }

    // Step 5: Assemble plan object
    const plan = {
      id: planId,
      description,
      createdAt: new Date().toISOString(),
      origin: botPosition || { x: 0, y: 64, z: 0 },
      status: 'active',
      spec,
      materialAudit: null,
      sections,
      totalEstimatedBlocks,
    }

    // Step 6: Persist plan
    saveBuildPlan(plan)

    return {
      success: true,
      planId,
      sections: sections.map(s => s.id),
      totalBlocks: totalEstimatedBlocks,
    }
  } catch (err) {
    return { success: false, reason: `planBuild failed: ${err.message}` }
  }
}

// ── Prompt Injection ──

// getBuildPlanForPrompt() — format active plan status for prompt injection
export function getBuildPlanForPrompt() {
  const plan = getActivePlan()
  if (!plan) return ''

  const lines = [`ACTIVE BUILD PLAN: ${plan.description} (id: ${plan.id})`]

  // Section progress
  const doneSections = plan.sections.filter(s => s.status === 'done').length
  const totalSections = plan.sections.length
  lines.push(`Progress: ${doneSections}/${totalSections} sections complete`)

  // Material audit
  if (plan.materialAudit?.gap && Object.keys(plan.materialAudit.gap).length > 0) {
    const gapParts = Object.entries(plan.materialAudit.gap)
      .map(([block, count]) => `${block}*${count}`)
      .join(', ')
    lines.push(`MISSING MATERIALS: ${gapParts}`)
  } else {
    // Find next pending section
    const nextSection = plan.sections.find(s => s.status === 'pending' || s.status === 'active')
    if (nextSection) {
      lines.push(`Next: ${nextSection.id}. Use !build to continue.`)
    } else {
      lines.push('All sections complete.')
    }
  }

  return lines.join('\n')
}

// ── Multi-Agent Section Claiming ──

// claimBuildSection(agentName, planId) — claim the next available pending section for this agent
// Handles stale claims (>10 min) by treating them as expired — Pitfall 5 (crash recovery)
// Returns the claimed section object, or null if no available section or plan not found
export function claimBuildSection(agentName, planId) {
  const plan = loadBuildPlan(planId)
  if (!plan) return null

  const TEN_MIN = 10 * 60 * 1000

  const section = plan.sections.find(s => {
    if (s.status !== 'pending') return false
    if (s.claimedBy === null || s.claimedBy === agentName) return true
    // Allow claiming if existing claim is stale (agent crashed)
    if (s.claimedBy !== null && s.claimedAt) {
      const age = Date.now() - new Date(s.claimedAt).getTime()
      if (age > TEN_MIN) return true
    }
    return false
  })

  if (!section) return null

  section.claimedBy = agentName
  section.claimedAt = new Date().toISOString()
  saveBuildPlan(plan)

  return section
}

// releaseSection(agentName, planId, sectionId) — release a section claim back to null
export function releaseSection(agentName, planId, sectionId) {
  const plan = loadBuildPlan(planId)
  if (!plan) return

  const section = plan.sections.find(s => s.id === sectionId && s.claimedBy === agentName)
  if (!section) return

  section.claimedBy = null
  section.claimedAt = null
  saveBuildPlan(plan)
}

// ── Expected Block Map ──

// buildExpectedBlockMap(blueprint, originX, originY, originZ) — Map<"x,y,z", blockName>
export function buildExpectedBlockMap(blueprint, originX, originY, originZ) {
  const map = new Map()
  if (!blueprint?.layers || !blueprint?.palette) return map

  // Resolve palette — use first preferred block from each entry
  const resolvedPalette = {}
  for (const [char, entry] of Object.entries(blueprint.palette)) {
    const preferred = Array.isArray(entry?.preferred) ? entry.preferred : []
    resolvedPalette[char] = preferred[0] || 'cobblestone'
  }

  // Iterate layers (bottom to top) then rows then cols
  const sortedLayers = [...blueprint.layers].sort((a, b) => a.y - b.y)

  for (const layer of sortedLayers) {
    for (let row = 0; row < (layer.grid || []).length; row++) {
      const line = layer.grid[row]
      for (let col = 0; col < line.length; col++) {
        const char = line[col]
        if (char === '.' || char === ' ') continue
        if (!resolvedPalette[char]) continue
        const x = originX + col
        const y = originY + layer.y
        const z = originZ + row
        map.set(`${x},${y},${z}`, resolvedPalette[char])
      }
    }
  }

  return map
}
