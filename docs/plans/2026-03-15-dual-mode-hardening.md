# HermesCraft Dual-Mode Hardening Implementation Plan

> For Hermes: use subagent-driven-development and strict TDD where practical. Prioritize launch-critical improvements that strengthen both companion mode and civilization mode.

Goal: Make HermesCraft clearly embody one core system with two scales of experience: a personal in-world companion and a multi-agent social civilization.

Architecture: Keep one underlying Mineflayer + Hermes agent stack, then strengthen it in three layers: fair embodied perception, richer social state/routing, and cleaner productization/docs for the two demo modes. Add lightweight testable helper modules around routing and perception so future iteration is safer.

Tech stack: Node.js ESM, Mineflayer, bash launcher/CLI, Hermes Agent, Markdown docs.

---

## Workstreams

1. Product framing
   - README and docs present one thesis: from companion to civilization.
   - Separate quickstart flows for Companion Mode and Civilization Mode.

2. Fair embodied perception
   - Add explicit scene/perception summaries from local visible state.
   - Avoid x-ray/resource omniscience in fair-play mode.
   - Improve screenshot command ergonomics and metadata for vision-assisted verification.

3. Social/simulation layer
   - Fix routing gaps.
   - Add richer social metadata/event summaries for demos and agent reasoning.
   - Improve command visibility and interruptibility.

4. Reliability
   - Harden launchers.
   - Add tests for routing/perception helpers.
   - Clean up setup/docs mismatches.

---

## Concrete implementation targets

### A. Routing and social state
- Extract chat routing helpers into `bot/lib/chat.js`
- Add tests in `bot/test/chat.test.js`
- Fix Elena/Mia drift and support current cast cleanly
- Add social event ledger + summary endpoint in `bot/server.js`
- Expose via `mc social`

### B. Perception and fairness
- Extract perception helpers into `bot/lib/perception.js`
- Add tests in `bot/test/perception.test.js`
- Add FOV-based visible block scanning and scene summary endpoint (`/scene`)
- Update `collect` and `find_blocks` fair-play behavior to use visible blocks instead of omniscient scans when fair-play is on
- Add screenshot metadata command (`mc screenshot_meta`) to pair screenshot with local state

### C. Launchers and setup
- Harden `civilization.sh` so agents do not launch against failed bot bodies
- Fix `hermescraft.sh` cleanup/trap behavior
- Improve `setup.sh` prerequisite checks and mode wording

### D. Docs and repo presentation
- Rewrite `README.md` around one system / two modes
- Add `docs/COMPANION_MODE.md`
- Add `docs/CIVILIZATION_MODE.md`
- Add `docs/DEMO_THREAD.md`

### E. Verification
- Add `npm test` script using Node’s built-in test runner
- Run shell syntax checks, Node syntax checks, and unit tests
- Review diffs, then commit with git identity `bigph00t <bigph00t@users.noreply.github.com>`
