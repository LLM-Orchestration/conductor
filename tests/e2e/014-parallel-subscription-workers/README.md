# Parallel Codex Subscription Workers

Verify that concurrent subscription-backed Codex CLI runs remain individually visible and reviewable.

## User opens the Conductor log parser for subscription workers

![User opens the Conductor log parser for subscription workers](./screenshots/000-debug-page-loaded.png)

### Verifications
- [x] Debug log input is ready

---

## User reviews two subscription-backed Codex workers

![User reviews two subscription-backed Codex workers](./screenshots/001-parallel-workers-rendered.png)

### Verifications
- [x] Subscription authentication mode is explicit
- [x] Both worker threads are independently visible
- [x] Both workers report successful completion

---
