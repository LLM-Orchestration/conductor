# AGENTS

- All reusable scripts and automation in this repository must be accessible through `npm run ...` entry points.
- **ABSOLUTE REQUIREMENT**: All End-to-End (E2E) testing MUST strictly adhere to the standards defined in [E2E_GUIDE.md](./E2E_GUIDE.md). No exceptions.
- **Mandatory Helper**: Every E2E test MUST use the `TestStepHelper` for all test steps.
- **Visual Verification**: Every test step MUST include a visual verification via `toHaveScreenshot()`. This is an ABSOLUTE REQUIREMENT to ensure "Zero-Pixel Tolerance".
- **Codex CLI Output**: Codex CLI is invoked non-interactively with `codex exec --json`. Conductor parses the JSONL stream and emits `CODEX_EVENT` for observability. Historical `GEMINI_EVENT` logs remain supported by the UI.
- **Subscription Credentials**: Personal subscription workers must use the generated `conductor-worker` permission profile. Never place `CODEX_HOME` under a writable temporary root or combine subscription auth with `danger-full-access`.

## Coding Standards

- **Boolean Complexity**: Boolean expressions MUST be limited to at most two logical operations (`&&`, `||`). Expressions that are more complex must be broken down into intermediate variables or refactored for clarity. This is enforced by a custom lint script.
- **API Efficiency**: Minimize use of high-cost GraphQL calls. Prefer `gh api` (REST) for metadata. **NEVER** scan projects with `gh project item-list --limit 1000`; use direct item IDs or targeted queries instead.
