---
status: partial
phase: 05-tool-primitives
source: [05-VERIFICATION.md]
started: 2026-03-21T00:00:00.000Z
updated: 2026-03-21T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Smart place with main-inventory item
expected: clickSlot(SWAP) equips item from slot 9-35 to hotbar, block places on first attempt
result: [pending]

### 2. chest_deposit live transfer
expected: GenericContainerScreenHandler opens, shift-click transfers items to chest, response shows transferred count
result: [pending]

### 3. chest_withdraw live transfer
expected: Items move from chest to player inventory, chests.json updates
result: [pending]

### 4. Sustained action timeout recovery
expected: After timeout, next action dispatches within a few ticks without permanent stuck state
result: [pending]

### 5. Normalization in live craft
expected: Agent calls craft("sticks"), normalizer converts to "stick", craft succeeds
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
