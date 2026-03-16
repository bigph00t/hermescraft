import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDiffDegrees,
  bearingFromDelta,
  classifySector,
  makeBlockMemoryKey,
  summarizeVisibleBlocks,
  summarizeSceneText,
} from '../lib/perception.js';

test('angleDiffDegrees wraps across 360 cleanly', () => {
  assert.equal(angleDiffDegrees(10, 350), 20);
  assert.equal(angleDiffDegrees(350, 10), -20);
});

test('bearingFromDelta returns cardinal labels', () => {
  assert.equal(bearingFromDelta(0, -10), 'north');
  assert.equal(bearingFromDelta(10, 0), 'east');
  assert.equal(bearingFromDelta(-10, 0), 'west');
});

test('classifySector buckets relative angles into left center right', () => {
  assert.equal(classifySector(-50), 'left');
  assert.equal(classifySector(0), 'center');
  assert.equal(classifySector(50), 'right');
});

test('makeBlockMemoryKey is stable and rounded', () => {
  assert.equal(makeBlockMemoryKey({ x: 10.4, y: 64.6, z: -2.2 }, 'oak_log'), 'oak_log@10,65,-2');
});

test('summarizeVisibleBlocks groups repeated block hits', () => {
  const summary = summarizeVisibleBlocks([
    { name: 'oak_log', distance: 4.2, sector: 'left' },
    { name: 'oak_log', distance: 6.1, sector: 'center' },
    { name: 'water', distance: 3.9, sector: 'right' },
  ]);

  assert.deepEqual(summary[0], {
    name: 'water',
    count: 1,
    nearest_distance: 3.9,
    sectors: ['right'],
  });

  assert.deepEqual(summary[1], {
    name: 'oak_log',
    count: 2,
    nearest_distance: 4.2,
    sectors: ['left', 'center'],
  });
});

test('summarizeSceneText mentions uncertainty and notable cues', () => {
  const text = summarizeSceneText({
    lookingAt: { name: 'oak_log' },
    visibleBlocks: [{ name: 'oak_log', distance: 4.2, sector: 'left' }],
    visibleEntities: [{ type: 'Alex', distance: 6, bearing: 'north' }],
    hazards: ['lava right 5m'],
    sounds: [{ type: 'mining', direction: 'east', distance: '8m' }],
    memoryHints: ['furnace behind you 6m'],
  });

  assert.match(text, /Looking at oak_log/);
  assert.match(text, /Visible entities: Alex 6m north/);
  assert.match(text, /Hazards: lava right 5m/);
  assert.match(text, /Unknown areas remain hidden/);
});
