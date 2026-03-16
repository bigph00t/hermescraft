export function angleDiffDegrees(a, b) {
  let diff = ((a - b + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

export function normalizeDegrees(angle) {
  return ((angle % 360) + 360) % 360;
}

export function yawPitchToDir(yaw, pitch = 0) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: -sy * cp,
    y: sp,
    z: -cy * cp,
  };
}

export function bearingFromDelta(dx, dz) {
  const angle = normalizeDegrees((Math.atan2(dx, -dz) * 180) / Math.PI);
  if (angle >= 337.5 || angle < 22.5) return 'north';
  if (angle < 67.5) return 'northeast';
  if (angle < 112.5) return 'east';
  if (angle < 157.5) return 'southeast';
  if (angle < 202.5) return 'south';
  if (angle < 247.5) return 'southwest';
  if (angle < 292.5) return 'west';
  return 'northwest';
}

export function classifySector(relativeAngle) {
  if (relativeAngle < -35) return 'left';
  if (relativeAngle > 35) return 'right';
  return 'center';
}

export function makeBlockMemoryKey(position, name) {
  return `${name}@${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)}`;
}

export function summarizeVisibleBlocks(blocks, limit = 8) {
  const grouped = new Map();
  for (const block of blocks) {
    const current = grouped.get(block.name) || { name: block.name, count: 0, nearestDistance: Infinity, sectors: new Set() };
    current.count += 1;
    current.nearestDistance = Math.min(current.nearestDistance, block.distance);
    current.sectors.add(block.sector);
    grouped.set(block.name, current);
  }

  return [...grouped.values()]
    .sort((a, b) => a.nearestDistance - b.nearestDistance)
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      nearest_distance: Math.round(entry.nearestDistance * 10) / 10,
      sectors: [...entry.sectors],
    }));
}

export function summarizeSceneText({ lookingAt, visibleBlocks = [], visibleEntities = [], hazards = [], sounds = [], memoryHints = [] }) {
  const parts = [];

  if (lookingAt?.name) {
    parts.push(`Looking at ${lookingAt.name}.`);
  }

  const blockSummary = summarizeVisibleBlocks(visibleBlocks, 6);
  if (blockSummary.length > 0) {
    const blocksText = blockSummary
      .map((entry) => `${entry.name} ${entry.nearest_distance}m ${entry.sectors.join('/')}`)
      .join(', ');
    parts.push(`Visible blocks: ${blocksText}.`);
  } else {
    parts.push('No notable visible blocks in view.');
  }

  if (visibleEntities.length > 0) {
    const entText = visibleEntities
      .slice(0, 5)
      .map((entity) => `${entity.type} ${entity.distance}m ${entity.bearing}`)
      .join(', ');
    parts.push(`Visible entities: ${entText}.`);
  }

  if (hazards.length > 0) {
    parts.push(`Hazards: ${hazards.slice(0, 5).join(', ')}.`);
  }

  if (sounds.length > 0) {
    const soundText = sounds.slice(-3).map((sound) => `${sound.type} ${sound.direction} ${sound.distance}`).join(', ');
    parts.push(`Recent sounds: ${soundText}.`);
  }

  if (memoryHints.length > 0) {
    parts.push(`Remembered nearby: ${memoryHints.slice(0, 4).join(', ')}.`);
  }

  parts.push('Unknown areas remain hidden behind terrain and outside the current view cone.');
  return parts.join(' ');
}
