#!/usr/bin/env bash
# Shared utilities for handoff and human review scripts.

resolve_github_context() {
  # Input variables (can be pre-set):
  # issue_number, target_repo, project_number, project_url, issue_node_id

  if [ -z "${issue_number:-}" ]; then
    if [ -z "${GITHUB_EVENT_PATH:-}" ]; then
      echo "issue number must be supplied with --issue-number or via GITHUB_EVENT_PATH" >&2
      exit 1
    fi

    issue_number="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const num = event.issue?.number || event.client_payload?.issue_number;
  if (!num) process.exit(1);
  process.stdout.write(String(num));
} catch (e) {
  process.exit(1);
}
")" || {
      echo "Could not determine issue number" >&2
      exit 1
    }
  fi

  if [ -z "${target_repo:-}" ]; then
    if [ -n "${GITHUB_REPOSITORY:-}" ]; then
      target_repo="$GITHUB_REPOSITORY"
    elif [ -n "${GITHUB_EVENT_PATH:-}" ]; then
      target_repo="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repo = event.client_payload?.repository || '';
  if (!repo) process.exit(1);
  process.stdout.write(repo);
} catch (e) {
  process.exit(1);
}
")" || {
        echo "Could not determine target repository" >&2
        exit 1
      }
    else
      echo "target repository must be supplied with --repo or via environment" >&2
      exit 1
    fi
  fi

  if [ -z "${project_number:-}" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
    project_number="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  process.stdout.write(String(event.client_payload?.project_number || ''));
} catch (e) {}
")"
  fi

  if [ -z "${project_url:-}" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
    project_url="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  process.stdout.write(event.client_payload?.project_url || '');
} catch (e) {}
")"
  fi

  if [ -z "${issue_node_id:-}" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
    issue_node_id="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  process.stdout.write(event.issue?.node_id || event.client_payload?.issue_node_id || '');
} catch (e) {}
")"
  fi

  if [ -z "${project_item_id:-}" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
    project_item_id="$(node -e "
const fs = require('fs');
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  process.stdout.write(event.client_payload?.project_item_id || '');
} catch (e) {}
")"
  fi

  export issue_number target_repo project_number project_url issue_node_id project_item_id
}

validate_git_state() {
  local claimed_commits="$1"
  
  branch_name="$(git branch --show-current)"
  if [ -z "$branch_name" ]; then
    echo "Could not determine current branch" >&2
    exit 1
  fi

  # Auto-push
  echo "Attempting to push changes to origin/$branch_name..."
  if ! git push origin "$branch_name"; then
    echo "PUSH FAILURE: Failed to push to origin/$branch_name. Please check for merge conflicts, network issues, or permissions. Ensure you have committed your changes." >&2
    exit 1
  fi

  # Validation: Check commit count on origin
  if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
    echo "ERROR: Could not find origin/main to verify commit count." >&2
    exit 1
  fi

  if ! git rev-parse --verify "origin/$branch_name" >/dev/null 2>&1; then
    echo "ERROR: Could not find origin/$branch_name to verify commit count." >&2
    exit 1
  fi

  actual_commits=$(git rev-list --count "origin/main..origin/$branch_name")
  if [ "$actual_commits" -ne "$claimed_commits" ]; then
    echo "NUMBER OF COMMITS MISMATCH FAILURE: Expected $claimed_commits commits but found $actual_commits on origin/$branch_name (relative to origin/main). Please commit your changes, push them (or let the script try), and re-attempt handoff with the correct count." >&2
    exit 1
  fi

  # Validation: Check for uncommitted changes
  uncommitted_changes=$(git status --porcelain)
  if [ -n "$uncommitted_changes" ]; then
    echo "OPEN FILES STILL IN VM: You have uncommitted changes. Please commit or stash them before handoff." >&2
    echo "Uncommitted files:" >&2
    echo "$uncommitted_changes" >&2
    exit 1
  fi

  export branch_name
}

strip_local_media_markers() {
  local body_file="$1"
  local tmp_file

  tmp_file="$(mktemp)"
  sed \
    -e 's/ <!-- CONDUCTOR_MEDIA_PATH: [^>]* -->//g' \
    -e 's/ @\/tmp\/gemini-media-[^ ]*//g' \
    -e 's/ @\/tmp\/codex-media-[^ ]*//g' \
    "$body_file" > "$tmp_file"
  mv "$tmp_file" "$body_file"
}

find_project_item_id_by_issue_content() {
  local owner_kind
  local owner_query
  local after=""
  local response
  local item_id
  local page_info
  local end_cursor
  local -a graphql_args

  if [ -z "${issue_node_id:-}" ]; then
    return 0
  fi

  owner_kind="$(node -e "
const url = process.argv[1] || '';
const match = url.match(/github\.com\/(orgs|users)\//);
process.stdout.write(match ? match[1] : '');
" "$project_url")"

  case "$owner_kind" in
    orgs)
      owner_query='organization(login: $owner)'
      ;;
    users)
      owner_query='user(login: $owner)'
      ;;
    *)
      return 0
      ;;
  esac

  while :; do
    graphql_args=(-f owner="$project_owner" -F number="$project_number" -f query="
      query(\$owner: String!, \$number: Int!, \$after: String) {
        $owner_query {
          projectV2(number: \$number) {
            items(first: 100, after: \$after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                content {
                  ... on Issue {
                    id
                  }
                }
              }
            }
          }
        }
      }")
    if [ -n "$after" ]; then
      graphql_args+=(-f after="$after")
    fi

    response="$(gh api graphql "${graphql_args[@]}")"

    item_id="$(printf '%s' "$response" | node -e "
const fs = require('fs');
const issueNodeId = process.argv[1];
const body = JSON.parse(fs.readFileSync(0, 'utf8'));
const project = body.data?.organization?.projectV2 || body.data?.user?.projectV2;
const item = project?.items?.nodes?.find((node) => node.content?.id === issueNodeId);
if (item?.id) process.stdout.write(item.id);
" "$issue_node_id")"

    if [ -n "$item_id" ]; then
      echo "$item_id"
      return 0
    fi

    page_info="$(printf '%s' "$response" | node -e "
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(0, 'utf8'));
const project = body.data?.organization?.projectV2 || body.data?.user?.projectV2;
const pageInfo = project?.items?.pageInfo;
if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
  process.stdout.write(`${pageInfo.endCursor}`);
}
")"

    end_cursor="$page_info"
    if [ -z "$end_cursor" ]; then
      break
    fi

    after="$end_cursor"
  done
}

update_project_v2_field() {
  local field_name="$1"
  local option_name="$2"
  local verification_jq_path="$3" # e.g., ".status" or ".persona"
  local target_value_for_verification="${4:-$option_name}"

  if [ -z "${project_number:-}" ]; then
    return 0
  fi

  project_owner="$(node -e "
const url = process.argv[1] || '';
const match = url.match(/github\.com\/(orgs|users)\/([^\/]+)\/projects/);
process.stdout.write(match ? match[2] : '');
" "$project_url")"

  if [ -z "$project_owner" ]; then
    echo "Error: project_number provided but project_owner could not be determined from project_url" >&2
    exit 1
  fi

  item_id="${project_item_id:-}"

  if [ -z "$item_id" ]; then
    echo "Finding project item for issue $issue_number in repository $target_repo in project $project_number"
    # Prefer the issue's projectItems connection when GitHub exposes it.
    item_id=$(gh api graphql -f id="$issue_node_id" -f query='
      query($id: ID!) {
        node(id: $id) {
          ... on Issue {
            projectItems(first: 10) {
              nodes {
                id
                project {
                  number
                }
              }
            }
          }
        }
      }' --jq ".data.node.projectItems.nodes[] | select(.project.number == $project_number) | .id" | head -n 1)
  fi

  if [ -z "$item_id" ] || [ "$item_id" == "null" ]; then
    echo "Issue projectItems lookup did not find the item; scanning project content for issue node $issue_node_id"
    item_id="$(find_project_item_id_by_issue_content)"
  fi

  if [ -z "$item_id" ] || [ "$item_id" == "null" ]; then
    echo "Error: Could not find project item for issue $issue_number in project $project_number (owner: $project_owner)" >&2
    exit 1
  fi

  project_id=$(gh project view "$project_number" --owner "$project_owner" --format json --jq '.id')
  
  if [ -z "$project_id" ] || [ "$project_id" == "null" ]; then
    echo "Error: Could not resolve project ID for project $project_number" >&2
    exit 1
  fi

  echo "Resolving $field_name field and option IDs..."
  fields_json=$(gh project field-list "$project_number" --owner "$project_owner" --format json)
  field_id=$(echo "$fields_json" | jq -r ".fields[] | select(.name == \"$field_name\") | .id" | head -n 1)
  
  if [ -z "$field_id" ] || [ "$field_id" == "null" ]; then
    echo "Error: Could not find '$field_name' field in project $project_number" >&2
    exit 1
  fi

  option_id=$(echo "$fields_json" | jq -r ".fields[] | select(.name == \"$field_name\") | .options[] | select(.name == \"$option_name\") | .id" | head -n 1)
  
  if [ -z "$option_id" ] || [ "$option_id" == "null" ]; then
    echo "Error: Could not find option ID for '$option_name' in '$field_name' field" >&2
    exit 1
  fi

  echo "Updating Project V2 item $item_id $field_name to $option_name ($option_id)"
  gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id" > /dev/null

  # Verify Project V2 update with targeted GraphQL readback
  echo "Verifying Project V2 $field_name update via targeted readback..."
  project_verified=0
  for i in 1 2 3 4 5; do
    current_val=$(gh api graphql -f id="$item_id" -f query='
      query($id: ID!) {
        node(id: $id) {
          ... on ProjectV2Item {
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }' --jq ".data.node.fieldValues.nodes[] | select(.field.name == \"$field_name\") | .name" 2>/dev/null | head -n 1 || true)
    
    if [ "$current_val" == "$target_value_for_verification" ]; then
      project_verified=1
      echo "Project V2 update verified: $field_name is now '$target_value_for_verification'"
      break
    fi
    
    echo "Attempt $i: Project V2 $field_name is '${current_val:-<unset>}', waiting for '$target_value_for_verification'..."
    sleep 2
  done

  if [ "$project_verified" -ne 1 ]; then
    echo "Error: Failed to verify Project V2 $field_name update to '$target_value_for_verification' for item $item_id" >&2
    exit 1
  fi
}
