#!/usr/bin/env bash
set -euo pipefail

# This script tests handoff.sh failure modes by mocking the 'gh' and 'git' commands.

# Create a temporary directory for our test environment
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Set up environment for handoff.sh
export PATH="$TEST_DIR:$PATH"
export GITHUB_EVENT_PATH="$TEST_DIR/event.json"
export GITHUB_REPOSITORY="LLM-Orchestration/conductor"

# Unset variables that might bleed through from the environment
unset issue_number
unset target_repo
unset project_number
unset project_url
unset issue_node_id
unset project_item_id
unset CONDUCTOR_PERSONA
unset CONDUCTOR_LAST_COMMENT_URL

# Mock sleep to speed up tests
cat > "$TEST_DIR/sleep" <<EOF
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TEST_DIR/sleep"

# Create a dummy git mock
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "branch --show-current")
    echo "test-branch"
    exit 0
    ;;
  "push origin "*)
    if [ -f "$TEST_DIR/mock_push_fail" ]; then
      exit 1
    fi
    exit 0
    ;;
  "status --porcelain"*)
    if [ -f "$TEST_DIR/mock_uncommitted" ]; then
      cat "$TEST_DIR/mock_uncommitted"
    fi
    exit 0
    ;;
  "rev-parse --verify origin/main")
    if [ -f "$TEST_DIR/mock_no_origin_main" ]; then
      exit 1
    fi
    exit 0
    ;;
  "rev-parse --verify origin/test-branch")
    if [ -f "$TEST_DIR/mock_no_origin_branch" ]; then
      exit 1
    fi
    exit 0
    ;;
  "rev-list --count origin/main..origin/test-branch")
    cat "$TEST_DIR/mock_commit_count" 2>/dev/null || echo "0"
    exit 0
    ;;
  *)
    # For any other command, just return 0 to avoid errors
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/git"

# Create a dummy event.json with project info
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
    "issue_node_id": "I_123"
  }
}
EOF

# Create a dummy comment on stdin
echo "Handoff comment" > "$TEST_DIR/comment.md"

# Helper to setup GH mock
setup_gh_mock() {
  cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
# Record the call
echo "gh \$*" >> "$TEST_DIR/gh_calls"

case "\$*" in
  "label list"*)
    if [ -f "$TEST_DIR/mock_label_exists" ]; then
      if echo "\$*" | grep -q -- "--jq"; then
        echo "branch: test-branch"
      else
        echo '[{"name": "branch: test-branch"}]'
      fi
    else
      echo '[]'
    fi
    ;;
  "label create"*)
    exit 0
  ;;
  "api"*"repos/LLM-Orchestration/conductor/labels"*)
    if [ -f "$TEST_DIR/mock_label_exists" ]; then
      echo "branch: test-branch"
    else
      echo ""
    fi
    ;;
  "api"*"repos/LLM-Orchestration/conductor/issues/123"*)
    if echo "\$*" | grep -q -- ".html_url"; then
      echo "https://github.com/LLM-Orchestration/conductor/issues/123"
    elif echo "\$*" | grep -q -- ".labels\[\].name"; then
      echo "persona: coder"
      echo "branch: test-branch"
    else
      echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: test-branch"}], "html_url": "https://github.com/LLM-Orchestration/conductor/issues/123"}'
    fi
    ;;
  "api"*"graphql"*)
    if [ -f "$TEST_DIR/mock_project_item_missing" ]; then
      if echo "\$*" | grep -q -- "--jq"; then
        echo ""
      else
        echo '{"data":{"organization":{"projectV2":{"items":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}}'
      fi
    elif [ -f "$TEST_DIR/mock_issue_projectitems_missing" ] && echo "\$*" | grep -q "projectItems"; then
      echo ""
    elif echo "\$*" | grep -q "projectV2"; then
      echo '{"data":{"organization":{"projectV2":{"items":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[{"id":"ITEM_123","content":{"id":"I_123"}}]}}}}}'
    elif echo "\$*" | grep -q "projectItems" || echo "\$*" | grep -q "query"; then
      if echo "\$*" | grep -q "ProjectV2Item"; then
        echo "coder"
      else
        echo "ITEM_123"
      fi
    else
      echo "coder"
    fi
    ;;
  "project view"*)
    echo '"PVT_kwDOA123"'
    ;;
  "project field-list"*)
    echo '{"fields": [{"name": "Persona", "id": "F_P", "options": [{"name": "coder", "id": "O_C"}, {"name": "conductor", "id": "O_CON"}]}]}'
    ;;
  *)
    exit 0
    ;;
esac
EOF
  chmod +x "$TEST_DIR/gh"
}

setup_gh_mock

# Test 1: Fail because project item is not found
echo "Running Test 1: Fail because project item is not found..."
touch "$TEST_DIR/mock_project_item_missing"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Could not find project item for issue 123 in project 1 (owner: LLM-Orchestration)" "$TEST_DIR/stderr"; then
    echo "Success: Test 1 passed"
  else
    echo "Error: Test 1 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_project_item_missing"

# Test 1b: Fall back to scanning project contents when Issue.projectItems is empty
echo "Running Test 1b: Use project content scan when reverse issue lookup is empty..."
touch "$TEST_DIR/mock_issue_projectitems_missing"
rm -f "$TEST_DIR/gh_calls"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" > "$TEST_DIR/stdout" 2> "$TEST_DIR/stderr"; then
  if grep -q "Issue projectItems lookup did not find the item; scanning project content for issue node I_123" "$TEST_DIR/stdout" &&
     grep -q "Project V2 update verified: Persona is now 'coder'" "$TEST_DIR/stdout"; then
    echo "Success: Test 1b passed"
  else
    echo "Error: Test 1b failed with wrong output"
    cat "$TEST_DIR/stdout"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
else
  echo "Error: Test 1b failed (handoff.sh exited with non-zero)"
  cat "$TEST_DIR/stdout"
  cat "$TEST_DIR/stderr"
  exit 1
fi
rm "$TEST_DIR/mock_issue_projectitems_missing"

# Test 2: PUSH FAILURE
echo "Running Test 2: PUSH FAILURE..."
touch "$TEST_DIR/mock_push_fail"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to push failure"
  exit 1
else
  if grep -q "PUSH FAILURE: Failed to push to origin/test-branch" "$TEST_DIR/stderr"; then
    echo "Success: Test 2 passed"
  else
    echo "Error: Test 2 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_push_fail"

# Test 3: NUMBER OF COMMITS MISMATCH FAILURE
echo "Running Test 3: NUMBER OF COMMITS MISMATCH FAILURE..."
echo "2" > "$TEST_DIR/mock_commit_count"
if bash scripts/handoff.sh coder 1 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to commit mismatch"
  exit 1
else
  if grep -q "NUMBER OF COMMITS MISMATCH FAILURE: Expected 1 commits but found 2" "$TEST_DIR/stderr"; then
    echo "Success: Test 3 passed"
  else
    echo "Error: Test 3 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_commit_count"

# Test 4: OPEN FILES STILL IN VM
echo "Running Test 4: OPEN FILES STILL IN VM..."
echo "M modified_file.ts" > "$TEST_DIR/mock_uncommitted"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to uncommitted changes"
  exit 1
else
  if grep -q "OPEN FILES STILL IN VM: You have uncommitted changes" "$TEST_DIR/stderr"; then
    echo "Success: Test 4 passed"
  else
    echo "Error: Test 4 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_uncommitted"

# Test 5: MISSING origin/main
echo "Running Test 5: MISSING origin/main..."
touch "$TEST_DIR/mock_no_origin_main"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to missing origin/main"
  exit 1
else
  if grep -q "ERROR: Could not find origin/main to verify commit count." "$TEST_DIR/stderr"; then
    echo "Success: Test 5 passed"
  else
    echo "Error: Test 5 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_no_origin_main"

# Test 6: Mandatory COMMIT_COUNT for all targets
echo "Running Test 6: Mandatory COMMIT_COUNT for human target..."
if bash scripts/handoff.sh human < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to missing COMMIT_COUNT"
  exit 1
else
  if grep -q "Usage: npm run handoff -- TARGET COMMIT_COUNT < comment.md" "$TEST_DIR/stderr"; then
    echo "Success: Test 6 passed"
  else
    echo "Error: Test 6 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 7: move-to-human-review.sh validation
echo "Running Test 7: move-to-human-review.sh validation (commit mismatch)..."
echo "2" > "$TEST_DIR/mock_commit_count"
if bash scripts/move-to-human-review.sh 1 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: move-to-human-review.sh should have failed due to commit mismatch"
  exit 1
else
  if grep -q "NUMBER OF COMMITS MISMATCH FAILURE: Expected 1 commits but found 2" "$TEST_DIR/stderr"; then
    echo "Success: Test 7 passed"
  else
    echo "Error: Test 7 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm "$TEST_DIR/mock_commit_count"

# Test 8: Label creation when missing
echo "Running Test 8: Label creation when missing..."
rm -f "$TEST_DIR/mock_label_exists"
rm -f "$TEST_DIR/gh_calls"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md"; then
  if grep -E "gh api repos/.*/labels -X POST" "$TEST_DIR/gh_calls" >/dev/null; then
    echo "Success: Test 8 passed"
  else
    echo "Error: Test 8 failed (label creation NOT triggered)"
    cat "$TEST_DIR/gh_calls"
    exit 1
  fi
else
  echo "Error: Test 8 failed (handoff.sh exited with non-zero)"
  exit 1
fi

# Test 9: No label creation when already exists
echo "Running Test 9: No label creation when already exists..."
touch "$TEST_DIR/mock_label_exists"
rm -f "$TEST_DIR/gh_calls"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" > /dev/null 2>&1; then
  if grep -E "gh api repos/.*/labels -X POST" "$TEST_DIR/gh_calls" >/dev/null; then
    echo "Error: Test 9 failed (label creation triggered but label exists)"
    exit 1
  else
    echo "Success: Test 9 passed"
  fi
else
  echo "Error: Test 9 failed (handoff.sh exited with non-zero)"
  exit 1
fi

echo "All handoff validation tests passed!"
exit 0
