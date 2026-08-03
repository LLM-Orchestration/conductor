# Conductor

Conductor is an LLM coordination framework designed to facilitate complex software engineering tasks by orchestrating multiple specialized AI agents. It represents the third iteration of a vision that began with **Morpheum** and **Overseer**.

## Philosophy

Conductor aims for extreme simplicity and high agency. Instead of complex, hardcoded JSON protocols and rigid guardrails, Conductor leverages Codex CLI and integrates it into a standard software development lifecycle using GitHub Actions and Issues.

## Key Features

- **Agentic Handoff**: Seamlessly transfer tasks between specialized personas.
- **Bootstrapping**: Designed to work on its own codebase from day one.
- **GitHub-Native**: Uses Issues for state tracking and Actions for execution.
- **Structured Observability**: Real-time visibility into agent internal states via a SvelteKit-based UI (`observability-ui/`) and high-fidelity JSON event parsing.
- **Orchestration Guardrails**: Built-in protections that keep the `conductor` persona focused on high-level planning and verification, preventing unauthorized source modification.
- **Rigorous E2E Standards**: Zero-pixel tolerance and deterministic Playwright testing using a Unified Step Pattern (see [E2E_GUIDE.md](E2E_GUIDE.md)).
- **Agent Agnostic**: Supports any CLI-based agent that can interact with a codebase.

## Codex Setup

Conductor invokes Codex CLI non-interactively with `codex exec --json`. The JSONL event stream is recorded as `CODEX_EVENT` data for real-time observability. The default model is `gpt-5.6-sol` with `xhigh` reasoning effort.

- For GitHub Actions, add an `OPENAI_API_KEY` repository secret. The official `openai/codex-action` installs the pinned CLI and exposes the key through its Responses API proxy before Conductor starts.
- Override the defaults with repository variables `CONDUCTOR_CODEX_MODEL` and `CONDUCTOR_CODEX_EFFORT` when needed.
- For local runs, install Codex CLI, run `codex login`, and optionally copy `.env.example` to `.env` to override model or effort.
- Conductor uses `danger-full-access` with approvals disabled because each turn already runs in a disposable GitHub-hosted VM and must use Git, GitHub CLI, and repository verification tools non-interactively.

The workflow pins Codex CLI `0.146.0`. Upgrade that version deliberately alongside invocation and JSONL fixture tests. Historical `GEMINI_EVENT` records remain renderable in the observability UI so old workflow runs do not disappear.

For personal repositories, [Parallel Codex Subscription Workers](SUBSCRIPTION_WORKERS.md) describes an opt-in private credential repository that runs multiple GitHub-hosted Codex CLI jobs against the owner's ChatGPT subscription. Subscription workers use an isolated permission profile and never use `danger-full-access`.

## Projects V2 Setup

The live shared board is the organization-owned project at:

- `https://github.com/orgs/LLM-Orchestration/projects/1`

Project moves do not trigger GitHub Actions directly. Conductor uses an org-project bridge:

1. An organization webhook or GitHub App observes `projects_v2_item`.
2. The bridge sends `repository_dispatch` with `event_type=project_in_progress`, including the source repository in the payload.
3. The workflow starts and activates `persona: conductor` on the target issue in any repository within the organization.

The bridge in this repository is deployed as a Firebase HTTPS function.

See [PROJECTS_V2_INTEGRATION.md](PROJECTS_V2_INTEGRATION.md) for the exact dispatch contract and setup details.

Current Firebase bridge project:

- `llm-orch-conductor-bridge`

The repository also includes a Firebase scheduled recovery function that triggers the existing `recover-orphaned-items.yml` workflow on staggered minutes.
During the transition, the GitHub workflow keeps its own native cron as well, so both schedulers can exercise the same recovery path.
You can exercise the same scanner without re-triggering work via `npm run recover:orphans:dry-run`.

## Licensing

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.
