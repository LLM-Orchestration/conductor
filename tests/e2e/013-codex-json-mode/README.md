# Codex JSONL Observability

Verify that Codex CLI JSONL events are parsed and rendered as a readable workflow timeline.

## User opens the Conductor log parser

![User opens the Conductor log parser](./screenshots/000-debug-page-loaded.png)

### Verifications
- [x] Debug log input is ready

---

## User inspects a Codex CLI JSONL run

![User inspects a Codex CLI JSONL run](./screenshots/001-codex-events-rendered.png)

### Verifications
- [x] Thread and turn lifecycle are visible
- [x] Agent markdown is rendered
- [x] Command result and file change are visible
- [x] Token usage is visible

---
