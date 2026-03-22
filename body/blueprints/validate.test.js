// validate.test.js — Test suite for blueprint validation module

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validateBlueprint } from './validate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0

function assert(name, condition, detail) {
  if (condition) {
    console.log('  PASS:', name)
    passed++
  } else {
    console.error('  FAIL:', name, detail ? ('— ' + detail) : '')
    failed++
  }
}

// ── 1. JSON parse errors ──
console.log('\n[1] Invalid JSON rejection')
{
  const r = validateBlueprint('not valid json {{{')
  assert('returns valid:false', r.valid === false)
  assert('errors is array', Array.isArray(r.errors))
  assert('error mentions JSON', r.errors.some(e => e.toLowerCase().includes('json')))
}

// ── 2. Missing required fields ──
console.log('\n[2] Missing required fields')
{
  const r = validateBlueprint(JSON.stringify({}))
  assert('returns valid:false', r.valid === false)
  assert('reports missing name', r.errors.some(e => e.toLowerCase().includes('name')))
  assert('reports missing palette', r.errors.some(e => e.toLowerCase().includes('palette')))
  assert('reports missing layers', r.errors.some(e => e.toLowerCase().includes('layers')))
}

// ── 3. Empty palette ──
console.log('\n[3] Empty palette')
{
  const r = validateBlueprint(JSON.stringify({ name: 'x', palette: {}, layers: [{ y: 0, grid: ['A'] }] }))
  assert('returns valid:false', r.valid === false)
  assert('reports palette error', r.errors.some(e => e.toLowerCase().includes('palette')))
}

// ── 4. Bad block name in palette ──
console.log('\n[4] Unknown block name in palette preferred[0]')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['not_a_real_block_xyz'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['A'] }]
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert('mentions the unknown block', r.errors.some(e => e.includes('not_a_real_block_xyz')))
}

// ── 5. Valid block name in palette ──
console.log('\n[5] Valid block name in palette')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['A'] }]
  }
  const r = validateBlueprint(JSON.stringify(bp))
  // Should not error on block name — may error on other things but not block name
  const blockErr = r.errors ? r.errors.filter(e => e.includes('unknown block')) : []
  assert('no unknown block error for cobblestone', blockErr.length === 0)
}

// ── 6. Layer y ordering ──
console.log('\n[6] Non-ascending layer y order')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [
      { y: 1, grid: ['A'] },
      { y: 0, grid: ['A'] }
    ]
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert('mentions layer ordering', r.errors.some(e => e.toLowerCase().includes('layer') || e.toLowerCase().includes('not after') || e.toLowerCase().includes('order')))
}

// ── 7. Grid row length mismatch ──
console.log('\n[7] Grid row length mismatch')
{
  const bp = {
    name: 'test',
    size: { x: 3, y: 1, z: 1 },
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['AA'] }]  // row length 2, but size.x = 3
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert('mentions row length', r.errors.some(e => e.toLowerCase().includes('length') || e.toLowerCase().includes('row')))
}

// ── 8. Grid row count mismatch ──
console.log('\n[8] Grid row count mismatch')
{
  const bp = {
    name: 'test',
    size: { x: 1, y: 1, z: 3 },
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['A'] }]  // 1 row but size.z = 3
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert('mentions row count', r.errors.some(e => e.toLowerCase().includes('rows') || e.toLowerCase().includes('row')))
}

// ── 9. Unknown palette key in grid ──
console.log('\n[9] Unknown palette key in grid')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['AB'] }]  // B not in palette
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert("mentions key 'B'", r.errors.some(e => e.includes('B') || e.toLowerCase().includes('palette key')))
}

// ── 10. Dots and spaces are allowed (air/skip) ──
console.log('\n[10] Dots and spaces are valid (air)')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['.A .'] }]
  }
  // size is inferred: x=4, z=1
  const r = validateBlueprint(JSON.stringify(bp))
  // Dots and spaces should not cause unknown-palette-key errors
  const dotErr = r.errors ? r.errors.filter(e => e.includes("'.'") || e.includes("' '")) : []
  assert('no error for dots or spaces', dotErr.length === 0)
}

// ── 11. Size inference from layers ──
console.log('\n[11] Size inferred from grid when size is missing')
{
  const bp = {
    name: 'test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['AAA', 'AAA'] }]  // x=3, z=2 inferred
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('valid result', r.valid === true, r.errors ? r.errors.join('; ') : '')
  assert('blueprint has inferred size', r.blueprint?.size?.x === 3 && r.blueprint?.size?.z === 2)
}

// ── 12. Collect ALL errors (not just first) ──
console.log('\n[12] Multiple errors reported together')
{
  const bp = {
    name: 'test',
    size: { x: 2, y: 2, z: 2 },
    palette: {
      A: { preferred: ['not_real_block_1'], tag: 'wall' },
      B: { preferred: ['not_real_block_2'], tag: 'floor' }
    },
    layers: [
      { y: 1, grid: ['AB', 'AB'] },
      { y: 0, grid: ['AB', 'AB'] }  // wrong order
    ]
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('returns valid:false', r.valid === false)
  assert('has multiple errors', r.errors.length >= 2, 'errors: ' + JSON.stringify(r.errors))
}

// ── 13. All 12 existing blueprints pass ──
console.log('\n[13] All 12 existing blueprints accept without error')
{
  const bpDir = __dirname
  const files = readdirSync(bpDir).filter(f => f.endsWith('.json'))
  assert('12 blueprint files found', files.length >= 12, `found ${files.length}`)

  for (const f of files) {
    const jsonStr = readFileSync(join(bpDir, f), 'utf-8')
    const r = validateBlueprint(jsonStr)
    assert(`${f} valid`, r.valid === true, r.errors ? r.errors.join('; ') : '')
  }
}

// ── 14. Returns parsed blueprint on success ──
console.log('\n[14] Returns parsed blueprint object on success')
{
  const bp = {
    name: 'test_bp',
    description: 'a test',
    palette: { A: { preferred: ['cobblestone'], tag: 'wall' } },
    layers: [{ y: 0, grid: ['AAA', 'AAA', 'AAA'] }]
  }
  const r = validateBlueprint(JSON.stringify(bp))
  assert('valid:true', r.valid === true, r.errors ? r.errors.join('; ') : '')
  assert('blueprint returned', r.blueprint !== undefined)
  assert('name matches', r.blueprint?.name === 'test_bp')
}

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('TESTS FAILED')
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED')
}
