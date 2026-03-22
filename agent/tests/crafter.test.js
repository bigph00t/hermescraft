// crafter.test.js — Tests for CRAFT-01: BFS recipe chain solver
// Run with: node --test agent/tests/crafter.test.js

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { initCrafter, solveCraft } from '../crafter.js'

before(() => {
  initCrafter()
})

describe('CRAFT-01: solveCraft BFS recipe chain solver', () => {

  it('resolves wooden_pickaxe from empty inventory into 3 steps (oak_planks -> stick -> wooden_pickaxe)', () => {
    const result = solveCraft('wooden_pickaxe', {})
    assert.equal(result.steps.length, 3, `Expected 3 steps, got ${result.steps.length}: ${result.steps.map(s => s.item).join(' -> ')}`)
    assert.equal(result.steps[0].item, 'oak_planks', 'First step should be oak_planks')
    assert.equal(result.steps[1].item, 'stick', 'Second step should be stick')
    assert.equal(result.steps[2].item, 'wooden_pickaxe', 'Third step should be wooden_pickaxe')
  })

  it('wooden_pickaxe final step has needsTable=true (3x3 recipe)', () => {
    const result = solveCraft('wooden_pickaxe', {})
    const finalStep = result.steps[result.steps.length - 1]
    assert.equal(finalStep.needsTable, true, 'wooden_pickaxe requires crafting table')
  })

  it('oak_planks step has needsTable=false (2x2 recipe)', () => {
    const result = solveCraft('wooden_pickaxe', {})
    const planksStep = result.steps.find(s => s.item === 'oak_planks')
    assert.ok(planksStep, 'planks step should exist')
    assert.equal(planksStep.needsTable, false, 'oak_planks from log is a shapeless recipe, no table needed')
  })

  it('solveCraft with oak_log in inventory resolves to planks step with no missing', () => {
    const result = solveCraft('oak_planks', { oak_log: 4 })
    assert.equal(result.steps.length, 1, 'should have exactly 1 step')
    assert.equal(result.steps[0].item, 'oak_planks')
    assert.equal(result.missing.length, 0, 'should have no missing items when logs are available')
  })

  it('solveCraft with sufficient ingredients (oak_planks + stick) returns only 1 step', () => {
    const result = solveCraft('wooden_pickaxe', { oak_planks: 10, stick: 4 })
    assert.equal(result.steps.length, 1, `Expected 1 step when ingredients available, got ${result.steps.length}`)
    assert.equal(result.steps[0].item, 'wooden_pickaxe', 'Only final craft step should remain')
  })

  it('solveCraft with unknown item returns empty steps and item in missing', () => {
    const result = solveCraft('nonexistent_item_xyz', {})
    assert.equal(result.steps.length, 0, 'Unknown item should return empty steps')
    assert.ok(result.missing.length > 0, 'Unknown item should be in missing list')
  })

  it('solveCraft with raw material (oak_log) and no inventory returns empty steps and item in missing', () => {
    const result = solveCraft('oak_log', {})
    assert.equal(result.steps.length, 0, 'Raw material with no recipes should return empty steps')
    assert.ok(result.missing.includes('oak_log'), 'oak_log should be in missing list')
  })

  it('solveCraft stick from oak_planks returns 1 step', () => {
    const result = solveCraft('stick', { oak_planks: 10 })
    assert.equal(result.steps.length, 1, 'Expected 1 step when planks available')
    assert.equal(result.steps[0].item, 'stick')
    assert.equal(result.missing.length, 0)
  })

  it('steps include action, item, count, ingredients, needsTable fields', () => {
    const result = solveCraft('oak_planks', { oak_log: 1 })
    assert.equal(result.steps.length, 1)
    const step = result.steps[0]
    assert.equal(step.action, 'craft', 'step.action must be "craft"')
    assert.ok(typeof step.item === 'string', 'step.item must be a string')
    assert.ok(typeof step.count === 'number', 'step.count must be a number')
    assert.ok(Array.isArray(step.ingredients), 'step.ingredients must be an array')
    assert.ok(typeof step.needsTable === 'boolean', 'step.needsTable must be boolean')
  })

  it('ingredients use normalized item names (no minecraft: prefix)', () => {
    const result = solveCraft('wooden_pickaxe', {})
    for (const step of result.steps) {
      for (const ing of step.ingredients) {
        assert.ok(!ing.item.includes(':'), `ingredient "${ing.item}" must not include namespace prefix`)
        assert.equal(ing.item, ing.item.toLowerCase(), `ingredient "${ing.item}" must be lowercase`)
      }
    }
  })

  it('uses spruce_planks variant when spruce_planks in inventory but not oak_planks', () => {
    const result = solveCraft('stick', { spruce_planks: 10 })
    // Should succeed using spruce_planks
    assert.equal(result.missing.length, 0, 'should resolve using spruce_planks')
    const stickStep = result.steps.find(s => s.item === 'stick')
    assert.ok(stickStep, 'stick step must exist')
    // Check that the ingredient is spruce_planks
    const hasSpruceIngredient = stickStep.ingredients.some(i => i.item === 'spruce_planks')
    assert.ok(hasSpruceIngredient, 'stick step should use spruce_planks from inventory')
  })

  it('solveCraft result has steps and missing properties', () => {
    const result = solveCraft('oak_planks', {})
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'steps'), 'result must have steps')
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'missing'), 'result must have missing')
    assert.ok(Array.isArray(result.steps), 'steps must be array')
    assert.ok(Array.isArray(result.missing), 'missing must be array')
  })

})
