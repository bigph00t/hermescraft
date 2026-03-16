export const CURRENT_CAST = ['steve', 'reed', 'moss', 'flint', 'ember'];
export const LEGACY_CAST = ['marcus', 'sarah', 'jin', 'dave', 'lisa', 'tommy', 'elena', 'mia', 'genghis', 'cleopatra', 'tesla', 'pirate', 'monk', 'goblin'];

export function buildKnownNames(myName = '', nearbyNames = []) {
  return [...new Set([
    ...CURRENT_CAST,
    ...LEGACY_CAST,
    'hermesbot',
    'hermes',
    'bot',
    'all',
    (myName || '').toLowerCase(),
    ...nearbyNames.map((name) => String(name || '').toLowerCase()).filter(Boolean),
  ].filter(Boolean))];
}

export function parseMessageRouting(message, { knownNames = [] } = {}) {
  const trimmed = String(message || '').trim();
  if (!trimmed) return { targets: [], body: '', isBroadcast: true, channel: 'public' };

  const allMatch = trimmed.match(/^all\s*[:]\s*(.*)/i);
  if (allMatch) {
    return { targets: [], body: allMatch[1].trim(), isBroadcast: true, channel: 'broadcast' };
  }

  const routeMatch = trimmed.match(/^([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)*)\s*[:]\s*(.*)/);
  if (routeMatch) {
    const namesPart = routeMatch[1];
    const body = routeMatch[2].trim();
    const targets = namesPart.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
    const hasValidTarget = targets.length > 0 && targets.every((t) => knownNames.includes(t));
    if (hasValidTarget && body.length > 0) {
      return {
        targets,
        body,
        isBroadcast: false,
        channel: targets.length > 1 ? 'group_dm' : 'direct',
      };
    }
  }

  return { targets: [], body: trimmed, isBroadcast: true, channel: 'public' };
}

export function isMessageForMe(routing, myName, aliases = ['bot', 'hermes']) {
  if (routing.isBroadcast) return true;
  const self = String(myName || '').toLowerCase();
  const names = new Set([self, ...aliases.map((a) => String(a).toLowerCase())]);
  return routing.targets.some((target) => names.has(String(target).toLowerCase()));
}

export function broadcastMentionsMe(messageBody, myName) {
  const lower = String(messageBody || '').toLowerCase().trim();
  const self = String(myName || '').toLowerCase();
  if (self && lower.startsWith(self)) return self;
  if (lower.startsWith('hermes')) return 'hermes';
  if (lower.startsWith('bot')) return 'bot';
  return null;
}

export function stripMentionPrefix(messageBody, matchedName) {
  return String(messageBody || '').trim().slice(String(matchedName || '').length).replace(/^[,!.:\s]+/, '').trim();
}

export function ensureSocialNode(graph, name) {
  const key = String(name || '').toLowerCase();
  if (!key) return null;
  if (!graph[key]) {
    graph[key] = {
      name: key,
      heard_public: 0,
      heard_private: 0,
      sent_public: 0,
      sent_private: 0,
      commands_given: 0,
      commands_completed: 0,
      last_message: null,
      last_channel: null,
      last_seen_at: null,
    };
  }
  return graph[key];
}

export function applySocialEvent(graph, event) {
  const actor = ensureSocialNode(graph, event.actor);
  if (!actor) return graph;
  actor.last_seen_at = event.time;
  actor.last_message = event.message || actor.last_message;
  actor.last_channel = event.channel || actor.last_channel;

  if (event.kind === 'heard') {
    if (event.channel === 'direct' || event.channel === 'group_dm') actor.heard_private += 1;
    else actor.heard_public += 1;
    if (event.command) actor.commands_given += 1;
  }

  if (event.kind === 'sent') {
    if (event.channel === 'direct' || event.channel === 'group_dm') actor.sent_private += 1;
    else actor.sent_public += 1;
  }

  if (event.kind === 'completed_command') {
    actor.commands_completed += 1;
  }

  return graph;
}

export function summarizeSocialGraph(graph, { limit = 8 } = {}) {
  return Object.values(graph)
    .sort((a, b) => (b.last_seen_at || 0) - (a.last_seen_at || 0))
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      heard_public: entry.heard_public,
      heard_private: entry.heard_private,
      sent_public: entry.sent_public,
      sent_private: entry.sent_private,
      commands_given: entry.commands_given,
      commands_completed: entry.commands_completed,
      last_channel: entry.last_channel,
      last_message: entry.last_message,
      last_seen_seconds_ago: entry.last_seen_at ? Math.max(0, Math.round((Date.now() - entry.last_seen_at) / 1000)) : null,
    }));
}
