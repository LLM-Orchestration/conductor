# Parallel Codex Subscription Workers

This optional mode runs Conductor in a private GitHub Actions repository using the owner's existing Codex CLI ChatGPT login. The public Conductor workflow continues to use the official API-key proxy.

## Enroll

Codex must use file-backed authentication so the enrollment script can upload the credential without printing it:

```toml
# ~/.codex/config.toml
cli_auth_credentials_store = "file"
```

```bash
codex login --device-auth
npm run codex:subscription:enroll -- anicolao/conductor-credentials
```

The enrollment command creates the repository as private when necessary, installs the worker workflow, uploads `CODEX_AUTH_JSON`, and stores the current GitHub token for access to the owner's repositories. It also sets `CONDUCTOR_REF` to the checked-out Conductor branch so an unmerged worker can be tested.

Run two subscription-backed Codex instances in parallel:

```bash
gh workflow run conductor-subscription.yml --repo anicolao/conductor-credentials
gh run list --repo anicolao/conductor-credentials --workflow conductor-subscription.yml
```

## Dispatch work

The GitHub App or bridge sends `repository_dispatch` to the private credential repository instead of the public Conductor repository. The payload remains the existing `project_in_progress` payload; it contains target repository and issue metadata but no credentials.

Each job receives a separate `CODEX_HOME` snapshot under the runner's home directory. Credential homes beneath `RUNNER_TEMP`, `/tmp`, or another command-writable temporary root are rejected because that broader write grant can defeat a narrower credential deny rule. Jobs do not share a concurrency group, so multiple workers can run simultaneously. A trusted final step writes `auth.json` back only if Codex refreshed it. Concurrent refreshes use last-successful-writer semantics; re-run enrollment if `codex login status` eventually reports an expired login.

## Credential boundary

The worker generates a Codex permission profile that writes the target workspace, permits public network access, and denies command access to the entire credential directory. Subscription jobs never pass `--sandbox danger-full-access`; `--strict-config` makes an invalid profile fail closed.

The committed smoke workflow verifies this boundary with `codex sandbox` before making a model request. Keep the credential repository private, do not enable jobs from forks, and do not replace the generated profile with `danger-full-access`.
