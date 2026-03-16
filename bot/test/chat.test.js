import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnownNames,
  parseMessageRouting,
  isMessageForMe,
  broadcastMentionsMe,
  stripMentionPrefix,
  applySocialEvent,
  summarizeSocialGraph,
} from '../lib/chat.js';

test('known names include current cast and nearby names', () => {
  const known = buildKnownNames('HermesBot', ['Alex', 'Elena']);
  assert.ok(known.includes('elena'));
  assert.ok(known.includes('marcus'));
  assert.ok(known.includes('alex'));
  assert.ok(known.includes('hermesbot'));
});

test('parseMessageRouting handles direct and group messages', () => {
  const known = buildKnownNames('HermesBot', ['Alex']);
  assert.deepEqual(parseMessageRouting('Elena: come here', { knownNames: known }), {
    targets: ['elena'],
    body: 'come here',
    isBroadcast: false,
    channel: 'direct',
  });

  assert.deepEqual(parseMessageRouting('Marcus,Elena: regroup', { knownNames: known }), {
    targets: ['marcus', 'elena'],
    body: 'regroup',
    isBroadcast: false,
    channel: 'group_dm',
  });
});

test('parseMessageRouting falls back to public when prefix is not a valid name', () => {
  const known = buildKnownNames('HermesBot');
  const routed = parseMessageRouting('Hello: world', { knownNames: known });
  assert.equal(routed.isBroadcast, true);
  assert.equal(routed.channel, 'public');
  assert.equal(routed.body, 'Hello: world');

  const mixed = parseMessageRouting('Hello,Elena: regroup', { knownNames: known });
  assert.equal(mixed.isBroadcast, true);
  assert.equal(mixed.channel, 'public');
  assert.equal(mixed.body, 'Hello,Elena: regroup');
});

test('mention parsing strips prefix cleanly', () => {
  assert.equal(broadcastMentionsMe('Hermes, build a house', 'HermesBot'), 'hermes');
  assert.equal(stripMentionPrefix('Hermes, build a house', 'hermes'), 'build a house');
});

test('isMessageForMe respects direct targets and bot aliases', () => {
  const direct = { targets: ['elena'], isBroadcast: false };
  const alias = { targets: ['hermes'], isBroadcast: false };
  assert.equal(isMessageForMe(direct, 'Elena'), true);
  assert.equal(isMessageForMe(alias, 'Elena'), true);
});

test('social graph tracks heard, sent, and completed command events', () => {
  const graph = {};
  applySocialEvent(graph, { actor: 'alex', kind: 'heard', channel: 'public', command: true, time: Date.now(), message: 'hermes follow me' });
  applySocialEvent(graph, { actor: 'alex', kind: 'sent', channel: 'direct', time: Date.now(), message: 'on my way' });
  applySocialEvent(graph, { actor: 'alex', kind: 'completed_command', channel: 'direct', time: Date.now() });

  const summary = summarizeSocialGraph(graph, { limit: 1 })[0];
  assert.equal(summary.name, 'alex');
  assert.equal(summary.heard_public, 1);
  assert.equal(summary.sent_private, 1);
  assert.equal(summary.commands_given, 1);
  assert.equal(summary.commands_completed, 1);
});
