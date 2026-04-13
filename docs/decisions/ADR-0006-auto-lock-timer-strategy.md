# ADR-0006: Auto-lock timer strategy

**Date:** 2026-04-13
**Status:** Accepted

## Context

Auto-lock fires after N minutes of user inactivity, clearing the in-memory encryption key. Two implementation strategies were considered:

1. **Strategy A**: one `setTimeout`, cleared and reset on every activity event (`clearTimeout` + `setTimeout`).
2. **Strategy B**: one `setInterval` firing every second, checking `Date.now() - lastActivityAt > timeoutMs`.

## Decision

Strategy A: `clearTimeout` + `setTimeout` per activity event.

## Consequences

- Simpler code: two operations per activity event, no persistent interval.
- Minimal CPU usage when idle: no interval ticking every second.
- No countdown UI possible without refactoring. Strategy B would naturally support a "locks in 2:30" display.
- Refactor to Strategy B is straightforward if a countdown UI is added in a future phase (P-05 or later).
- Timer accuracy depends on browser throttling of background tabs. When the tab is hidden, the timer continues but may fire late. This is the safe default: locking while hidden is better than not locking.

## Alternatives rejected

- **Strategy B**: adds a persistent interval and a `lastActivityAt` timestamp. More code, more CPU usage, and the countdown UI that motivates it is not in scope for any current task.
