# Phase 17: Memory Foundation - Research

**Researched:** 2026-03-23
**Domain:** SQLite event log with importance scoring and spatial tagging — persistent, bounded episodic memory
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SQLite via better-sqlite3 (synchronous API, zero-dependency native module)
- Stanford Generative Agents importance scoring: deaths=10, discoveries=8, combat=7, building=6, routine=2
- Every event carries (x, z, dimension) coordinates from bot position
- FIFO pruning with configurable max events (default 10,000)
- Event types: death, build, discovery, combat, craft, social, movement, observation
- Schema: id, timestamp, event_type, importance, x, z, dimension, description, metadata (JSON)

### Claude's Discretion
All implementation choices not listed above are at Claude's discretion. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEM-01 | Agent experiences persist across sessions — deaths, builds, discoveries, conversations stored in SQLite with timestamps and coordinates | better-sqlite3 synchronous DB, `initMemoryDB()` in start.js, `logEvent()` called from index.js death/action handlers |
| MEM-03 | Importance scoring (1-10) on events — significant moments scored higher and retrieved more often | Heuristic scoring table at write time; no LLM call needed for scoring; score stored in events.importance column |
| SPA-03 | What-where-when memory tagging — every experience tagged with coordinates for spatial queries | bot.entity.position from existing mind/spatial.js bot reference; (x, z, dimension) stored on every row; bounding-box SELECT enables spatial queries |
</phase_requirements>

---

## Summary

Phase 17 introduces the foundational persistent memory layer: a SQLite event log that survives session restarts, tags every event with spatial coordinates, and assigns importance scores so significant moments surface prominently in future queries. This is the architectural prerequisite for MEM-02 (RAG retrieval) and MEM-04 (reflection journals) in later phases.

The implementation is additive and low-risk. The existing `mind/memory.js` module handles L2/L3 memory (MEMORY.md + session JSONL). Phase 17 adds a new `mind/memoryDB.js` module alongside it — a new L4 layer using SQLite — without touching existing memory code paths. Integration points are exactly two lifecycle events: `recordDeath` calls (already in mind/memory.js and mind/index.js) and action dispatch handlers in mind/index.js. No body/ modules change. No prompt injection in this phase — that belongs to Phase 18 (MEM-02).

**Primary recommendation:** Create `mind/memoryDB.js` as a standalone SQLite wrapper with a clean `logEvent(bot, type, description, metadata)` API. Wire it into start.js init and index.js lifecycle hooks. Add FIFO pruning to a startup `PRAGMA` + a `deleteOldEvents` call. Smoke-test by verifying the `.db` file exists after import and the table schema is correct.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.8.0 | SQLite event log | Synchronous API matches the tick loop; zero infrastructure (single file); locked decision in CONTEXT.md and STATE.md |

### Verified
```bash
npm view better-sqlite3 version   # → 12.8.0 (verified 2026-03-23)
node --version                     # → v24.11.1 (compatible: engines says 20.x || 22.x || 23.x || 24.x || 25.x)
```

`better-sqlite3` is NOT currently in package.json or node_modules. It must be installed as part of Wave 0.

### ESM Import Pattern
better-sqlite3 uses CommonJS. In a project with `"type": "module"` in package.json, import it with:

```javascript
// Source: better-sqlite3 official README + npm registry
import Database from 'better-sqlite3'
```

This works because Node.js 24 supports `import` of CommonJS default exports via interop. The project already uses this pattern for other CJS deps. Confidence: HIGH (verified against Node 24 CJS/ESM interop docs).

**Installation:**
```bash
npm install better-sqlite3
```

No native build step required on Linux x64 — pre-built binaries are distributed via the npm package.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
mind/
+-- memoryDB.js        # NEW: SQLite event log (initMemoryDB, logEvent, queryRecent, queryNearby, pruneOldEvents)
+-- memory.js          # MODIFY: call logEvent() on recordDeath (import memoryDB)
+-- index.js           # MODIFY: call logEvent() in dispatch success handler + death handler
+-- prompt.js          # KEEP: unchanged in this phase (prompt injection is Phase 18)

data/
+-- <agent>/
    +-- memory.db      # NEW: SQLite file, created on first initMemoryDB call
    +-- MEMORY.md      # EXISTS: unchanged
    +-- stats.json     # EXISTS: unchanged
    +-- sessions/      # EXISTS: unchanged

start.js               # MODIFY: call initMemoryDB(config) in startup sequence
```

### Pattern 1: Module-Level SQLite Singleton

**What:** Module-level `let db = null` initialized once by `initMemoryDB(config)`. All functions read from module-level `db`. Mirrors the existing pattern in `memory.js`, `social.js`, `locations.js`.

**When to use:** Any SQLite module in this codebase — matches `init<Subsystem>` convention.

```javascript
// Source: better-sqlite3 docs + existing mind/ module patterns
// mind/memoryDB.js
import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

let db = null
let DB_PATH = ''

export function initMemoryDB(config) {
  if (!existsSync(config.dataDir)) mkdirSync(config.dataDir, { recursive: true })
  DB_PATH = join(config.dataDir, 'memory.db')
  db = new Database(DB_PATH)

  // WAL mode for crash safety (single writer, fast)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent       TEXT    NOT NULL,
      ts          INTEGER NOT NULL,
      event_type  TEXT    NOT NULL,
      importance  INTEGER NOT NULL DEFAULT 2,
      x           REAL,
      z           REAL,
      dimension   TEXT    DEFAULT 'overworld',
      description TEXT    NOT NULL,
      metadata    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_ts ON events(agent, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_type ON events(agent, event_type);
    CREATE INDEX IF NOT EXISTS idx_importance ON events(importance DESC);
  `)
}
```

### Pattern 2: Synchronous logEvent with Importance Scoring

**What:** All event writes are synchronous (no async, no await) using `db.prepare().run()`. Importance assigned by type using a lookup table — no LLM call.

**When to use:** Every event that needs to persist. Called from lifecycle hooks in index.js and memory.js.

```javascript
// Importance score table — Stanford Generative Agents pattern (locked in CONTEXT.md)
const IMPORTANCE = {
  death:       10,
  discovery:    8,
  combat:       7,
  build:        6,
  social:       5,
  craft:        4,
  observation:  3,
  movement:     2,
  routine:      2,
}

const insertStmt = db.prepare(`
  INSERT INTO events (agent, ts, event_type, importance, x, z, dimension, description, metadata)
  VALUES (@agent, @ts, @event_type, @importance, @x, @z, @dimension, @description, @metadata)
`)

export function logEvent(bot, eventType, description, metadata = null) {
  if (!db) return   // graceful no-op before init
  const pos = bot?.entity?.position
  insertStmt.run({
    agent:       bot?.username || 'unknown',
    ts:          Date.now(),
    event_type:  eventType,
    importance:  IMPORTANCE[eventType] ?? 2,
    x:           pos ? Math.round(pos.x) : null,
    z:           pos ? Math.round(pos.z) : null,
    dimension:   bot?.game?.dimension || 'overworld',
    description,
    metadata:    metadata ? JSON.stringify(metadata) : null,
  })
}
```

### Pattern 3: FIFO Pruning at Init

**What:** On `initMemoryDB`, after schema creation, prune events exceeding the cap by deleting the oldest rows. Runs once at startup. Never runs per-tick.

**When to use:** Startup only. `MAX_EVENTS` defaults to 10,000 per agent.

```javascript
export function pruneOldEvents(agentName, maxEvents = 10000) {
  if (!db) return
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM events WHERE agent = ?').get(agentName)
  if (countRow.cnt > maxEvents) {
    // Delete oldest (lowest id) beyond the cap
    db.prepare(`
      DELETE FROM events WHERE agent = ? AND id NOT IN (
        SELECT id FROM events WHERE agent = ? ORDER BY ts DESC LIMIT ?
      )
    `).run(agentName, agentName, maxEvents)
  }
}
```

### Pattern 4: Spatial Query

**What:** Bounding-box SELECT by x/z coordinate range. Used later (Phase 18+) for "what do I know about this location?" queries.

```javascript
export function queryNearby(agentName, x, z, radius = 50, limit = 10) {
  if (!db) return []
  return db.prepare(`
    SELECT id, ts, event_type, importance, x, z, dimension, description
    FROM events
    WHERE agent = ?
      AND x BETWEEN ? AND ?
      AND z BETWEEN ? AND ?
    ORDER BY importance DESC, ts DESC
    LIMIT ?
  `).all(agentName, x - radius, x + radius, z - radius, z + radius, limit)
}
```

### Pattern 5: Recency Query

**What:** Get last N events by recency, used for prompt injection (Phase 18) and smoke testing.

```javascript
export function queryRecent(agentName, limit = 20) {
  if (!db) return []
  return db.prepare(`
    SELECT id, ts, event_type, importance, x, z, dimension, description
    FROM events
    WHERE agent = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(agentName, limit)
}
```

### Anti-Patterns to Avoid

- **Do NOT use `better-sqlite3/legacy` or `node-sqlite3`**: Different APIs, async callbacks, not the locked decision.
- **Do NOT call `logEvent` in the 300ms body tick**: Only call from mind/ lifecycle hooks. Keep body/ free of mind/ imports (established Mind+Body boundary).
- **Do NOT use `db.run()` (that is the node-sqlite3 API)**: better-sqlite3 uses `stmt.run()` on prepared statements.
- **Do NOT add vector search to this module**: Vector search is already in knowledgeStore.js. This phase is BM25-free and vector-free — just SQLite row insertion and simple SQL queries.
- **Do NOT open the database before `initMemoryDB` is called**: `logEvent` has a guard (`if (!db) return`) for safety during module load.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded event log | Manual JSONL + line-count + truncate | better-sqlite3 DELETE + AUTOINCREMENT | FIFO via SQL DELETE is atomic and crash-safe; JSONL truncation can corrupt mid-write |
| Importance scoring | LLM call per event | Heuristic lookup table (locked) | LLM scoring adds 500ms+ latency per event; heuristics are sufficient and fast |
| Concurrent write safety | Mutex / file lock | WAL mode + single-process | better-sqlite3 is single-process; WAL handles crash safety without coordination |
| Schema migration | Version file + manual migration | `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` | Idempotent DDL — safe to run on every startup, handles first-run and upgrades |

**Key insight:** SQLite with better-sqlite3 eliminates every custom file-management problem: bounded size (DELETE), crash safety (WAL), atomic writes (implicit transaction per `stmt.run()`), and concurrent read/write (WAL reader/writer isolation) — all with a simpler API than manual JSONL management.

---

## Common Pitfalls

### Pitfall 1: better-sqlite3 Not Installed
**What goes wrong:** `import Database from 'better-sqlite3'` throws `Cannot find package 'better-sqlite3'`. The package is not in package.json or node_modules (confirmed by inspection).
**Why it happens:** It was identified as the right choice in research but never installed.
**How to avoid:** Wave 0 task must run `npm install better-sqlite3` before any other task runs.
**Warning signs:** `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'better-sqlite3'` at startup.

### Pitfall 2: Calling logEvent Before initMemoryDB
**What goes wrong:** `logEvent()` throws `Cannot read properties of null (reading 'prepare')`.
**Why it happens:** `start.js` calls `initMemoryDB` in step 3; if any import-time code calls `logEvent`, `db` is still null.
**How to avoid:** The `if (!db) return` guard in `logEvent` catches this silently. Do not remove this guard.
**Warning signs:** Silent no-ops in smoke tests where events should be logged but the DB is empty.

### Pitfall 3: Dimension Detection
**What goes wrong:** All events log `dimension: 'overworld'` even in the Nether.
**Why it happens:** `bot.game.dimension` may not be populated until after spawn in some Mineflayer versions.
**How to avoid:** Use `bot?.game?.dimension || 'overworld'` — the fallback is correct for most use. No dimension correction needed in this phase since agents are on RunPod with no live server testing anyway.
**Warning signs:** Every event has `dimension = 'overworld'` regardless of location (acceptable for now).

### Pitfall 4: FIFO Pruning Deletes Wrong Agent's Rows
**What goes wrong:** With two agents (luna, max) sharing a machine, pruning luna's DB accidentally over-prunes because the `COUNT(*)` doesn't filter by agent.
**How to avoid:** The `pruneOldEvents(agentName, maxEvents)` function filters by `agent = ?` in all queries. Per CONTEXT.md, `data/<agent>/memory.db` is per-agent — each agent has its own file. This pitfall doesn't apply if the per-agent DB path pattern is followed.
**Warning signs:** luna's DB contains max's events (sign that per-agent path was misconfigured).

### Pitfall 5: Unbounded Metadata JSON
**What goes wrong:** Passing large objects as `metadata` (e.g., full inventory list, 64-item chest contents) bloats the DB and slows queries.
**Why it happens:** `logEvent` accepts any object as metadata and JSON-stringifies it.
**How to avoid:** Keep `metadata` small — coordinates, item counts, mob names. Cap metadata at 500 chars in the `logEvent` implementation: `metadata: metadata ? JSON.stringify(metadata).slice(0, 500) : null`.
**Warning signs:** `memory.db` file size growing faster than expected; `description` and `metadata` rows exceeding 1KB.

---

## Code Examples

### Integration: start.js init sequence

```javascript
// start.js — add after existing initMemory(config) call (step 3)
import { initMemoryDB } from './mind/memoryDB.js'

// ...
initMemory(config)
loadMemory()
initMemoryDB(config)   // NEW: SQLite event log
// ...
```

### Integration: recordDeath in memory.js

```javascript
// mind/memory.js — add to recordDeath (import logEvent at top of file)
// Note: memory.js doesn't have bot reference — logEvent accepts null bot safely
import { logEvent } from './memoryDB.js'

export function recordDeath(deathMessage) {
  // ... existing code ...
  logEvent(null, 'death', `Died: ${msg}`, { deathNumber: stats.totalDeaths })
  // ...
}
```

**Important note:** `recordDeath` in memory.js does not have `bot` access. Pass `null` as bot — `logEvent` handles null safely (`pos` will be null, `x/z` will be null for death events). Spatial tagging for deaths requires a different integration point. See "Death with position" below.

### Integration: death with position in index.js

```javascript
// mind/index.js — in the death handler (already has bot reference)
import { logEvent } from './memoryDB.js'

// After bot.on('death', ...) fires:
logEvent(bot, 'death', `Died: ${deathMessage}`, { cause: deathMessage })
```

### Integration: action dispatch success in index.js

```javascript
// mind/index.js — in dispatch success handler
// Map command names to event types
const COMMAND_EVENT_TYPE = {
  build: 'build', design: 'build',
  mine: 'discovery', gather: 'discovery',
  combat: 'combat',
  craft: 'craft',
  chat: 'social',
  navigate: 'movement',
}

if (result.success) {
  const evtType = COMMAND_EVENT_TYPE[command] || 'observation'
  const desc = `${command} ${JSON.stringify(args).slice(0, 100)} succeeded`
  logEvent(bot, evtType, desc, { command, args })
}
```

### Smoke test additions

```javascript
// tests/smoke.test.js — add new section
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

section('memoryDB — SQLite event log')

const tmpDir = mkdtempSync(join(tmpdir(), 'memdb-test-'))
try {
  const { initMemoryDB, logEvent, queryRecent, queryNearby } = await import('../mind/memoryDB.js')
  const fakeConfig = { dataDir: tmpDir, name: 'test-agent' }
  initMemoryDB(fakeConfig)

  const fakeBot = { username: 'test-agent', entity: { position: { x: 100, y: 64, z: -200 } }, game: { dimension: 'overworld' } }
  logEvent(fakeBot, 'death', 'Fell into lava at coords 100,64,-200', { cause: 'lava' })
  logEvent(fakeBot, 'build', 'Completed cottage build', null)

  const rows = queryRecent('test-agent', 5)
  assert('memoryDB: events persisted to SQLite', rows.length === 2)
  assert('memoryDB: death importance=10', rows.find(r => r.event_type === 'death')?.importance === 10)
  assert('memoryDB: build importance=6', rows.find(r => r.event_type === 'build')?.importance === 6)
  assert('memoryDB: spatial coords stored', rows[1].x === 100 && rows[1].z === -200)

  const nearby = queryNearby('test-agent', 100, -200, 50)
  assert('memoryDB: spatial query returns nearby events', nearby.length >= 1)
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat MEMORY.md with `shift()` caps | SQLite event log with FIFO DELETE | Phase 17 (new) | No more manual array management; SQL queries replace manual array scanning; cross-session durability built-in |
| No coordinate tagging on memories | (x, z, dimension) on every event | Phase 17 (new) | Enables MrSteve-style spatial queries; "what happened near this location?" becomes a simple SQL range query |
| Heuristic importance not tracked | `importance` column (1-10) per event | Phase 17 (new) | Enables importance-weighted retrieval in Phase 18; death events surface before routine actions |
| JSONL session transcripts only | SQLite + JSONL (both retained) | Phase 17 (adds SQLite) | JSONL stays for human-readable audit; SQLite for machine retrieval; no removal of existing patterns |

**Deprecated/outdated:**
- None in this phase. Existing MEMORY.md, stats.json, and session JSONL patterns are all preserved. Phase 17 only adds SQLite alongside, not replacing anything.

---

## Open Questions

1. **Death event spatial tagging**
   - What we know: `recordDeath` in `memory.js` has no `bot` reference. `index.js` death handler has `bot`.
   - What's unclear: Which file should be the canonical logEvent call for deaths — memory.js (no position) or index.js (has position)?
   - Recommendation: Log from index.js where `bot` is available. Pass `null` to the memory.js `recordDeath` call's logEvent, or skip the memoryDB call in memory.js entirely and do it only in index.js with full position data.

2. **Dimension string format in Mineflayer**
   - What we know: `bot.game.dimension` exists but format may vary (e.g., `'minecraft:overworld'` vs `'overworld'`).
   - What's unclear: Exact string Mineflayer returns without a live server to test against.
   - Recommendation: Normalize at write time: `(bot?.game?.dimension || 'overworld').replace('minecraft:', '')`. Safe regardless of format.

3. **Bot username vs config.name as agent column**
   - What we know: `bot.username` is the MC username; `config.name` is the agent name (e.g., `luna`). These may differ.
   - What's unclear: Which to use as the `agent` column for consistent per-agent filtering.
   - Recommendation: Use `config.name` (passed to initMemoryDB via config). Store it as module-level `_agentName`. The `agent` column then equals config.name consistently, not MC username.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `better-sqlite3` (npm) | memoryDB.js | Not installed | 12.8.0 (registry) | None — must install |
| Node.js 20+ | better-sqlite3 engines | Yes | v24.11.1 | — |
| SQLite (embedded) | better-sqlite3 | Yes (bundled in package) | 3.x bundled | — |
| Linux x64 | Pre-built binaries | Yes | x64 confirmed | `npm rebuild` if needed |

**Missing dependencies with no fallback:**
- `better-sqlite3` — must be installed in Wave 0 (`npm install better-sqlite3`) before any implementation task

**Missing dependencies with fallback:**
- None

---

## Module Design: mind/memoryDB.js

Complete exported API for Phase 17:

| Export | Signature | Called From |
|--------|-----------|------------|
| `initMemoryDB` | `(config) => void` | `start.js` step 3 |
| `logEvent` | `(bot, eventType, description, metadata?) => void` | `mind/index.js` dispatch handlers, death handler |
| `queryRecent` | `(agentName, limit?) => rows[]` | Smoke tests; Phase 18 prompt injection |
| `queryNearby` | `(agentName, x, z, radius?, limit?) => rows[]` | Phase 18 spatial query tool |
| `pruneOldEvents` | `(agentName, maxEvents?) => void` | Called at end of `initMemoryDB` |

Internal only (not exported): `db`, `IMPORTANCE`, `insertStmt`.

The module follows the `init<Subsystem>` naming convention from CLAUDE.md. Module-level state via `let db = null`. No default exports — named exports only.

---

## Integration Map: Where logEvent Gets Called

| Call Site | File | Event Type | Has bot? | Notes |
|-----------|------|------------|---------|-------|
| Death handler | `mind/index.js` | `death` | Yes | Primary; has full position. `importance=10` |
| Build/design complete | `mind/index.js` | `build` | Yes | In dispatch success for `build`, `design` commands |
| Mine/gather complete | `mind/index.js` | `discovery` | Yes | In dispatch success for `mine`, `gather` |
| Combat complete | `mind/index.js` | `combat` | Yes | In dispatch success for `combat` |
| Craft complete | `mind/index.js` | `craft` | Yes | In dispatch success for `craft` |
| Chat sent | `mind/index.js` | `social` | Yes | Low importance=5; optional to reduce noise |
| Navigation complete | `mind/index.js` | `movement` | Yes | Low importance=2; optional |

**Recommendation:** Start with high-value events only (death, build, discovery, combat, craft). Skip movement and social in Phase 17 to avoid log noise. Movement and social can be added in Phase 18 once the retrieval pipeline exists to make them useful.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `mind/memory.js`, `mind/index.js`, `mind/knowledgeStore.js`, `start.js`, `package.json`
- `.planning/phases/17-memory-foundation/17-CONTEXT.md` — locked decisions (schema, scoring, pruning cap)
- `.planning/research/STACK.md` — better-sqlite3 12.8.0 confirmed, ESM import pattern, schema pattern
- `.planning/research/ARCHITECTURE.md` — module structure, init pattern, data flow
- `.planning/research/FEATURES.md` — Stanford Generative Agents importance scoring, MrSteve spatial tagging
- `.planning/research/PITFALLS.md` — unbounded memory bloat, per-agent directory pattern, pitfall catalogue
- `npm view better-sqlite3 version` — confirmed 12.8.0, Node 24.x compatible (verified 2026-03-23)

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — appendFileSync synchronous write pattern rationale, per-agent dir enforcement
- `.planning/STATE.md` — v2.3 decisions, confirmed better-sqlite3 and importance scores

### Tertiary (LOW confidence)
- None — all critical claims verified from codebase or registry

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — better-sqlite3 12.8.0 confirmed installed via npm view; Node 24 compatible
- Architecture: HIGH — module patterns verified from direct codebase reads across 6 files
- Pitfalls: HIGH — sourced from existing PITFALLS.md (verified via research) + codebase inspection
- Integration points: HIGH — exact function names and call sites verified from mind/index.js and memory.js source

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable libraries; SQLite API is mature and unchanging)
