#!/bin/bash
# test-agent-contract.sh — Verify backend agent implements correct API contract
# Usage: ./scripts/test-agent-contract.sh <AGENT_URL>
# Example: ./scripts/test-agent-contract.sh http://localhost:4000

set -euo pipefail

AGENT_URL="${1:-}"
PASS=0
FAIL=0

if [[ -z "$AGENT_URL" ]]; then
  echo "Usage: $0 <AGENT_URL>"
  echo "Example: $0 http://localhost:4000"
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

green() { echo -e "\033[32m✓ $*\033[0m"; }
red()   { echo -e "\033[31m✗ $*\033[0m"; }
blue()  { echo -e "\033[34m► $*\033[0m"; }

pass() { green "$1"; ((PASS++)) || true; }
fail() { red "$1"; ((FAIL++)) || true; }

check() {
  local label="$1"
  local condition="$2"
  if eval "$condition" &>/dev/null; then
    pass "$label"
  else
    fail "$label"
  fi
}

# ── Test 1: Agent reachable ───────────────────────────────────────────────────

echo ""
blue "Test 1: Agent reachable"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"query":"test","conversationId":"test-000","history":[]}' || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Agent returned HTTP 200"
else
  fail "Agent returned HTTP $HTTP_CODE (expected 200)"
  echo "  → Cannot continue — agent not reachable or returned error"
  exit 1
fi

# ── Test 2: Single entity search (relation: false) ────────────────────────────

echo ""
blue "Test 2: Single entity search (relation: false)"

RESP2=$(curl -s --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"query":"tìm người","conversationId":"test-001","history":[]}')

check "Response has data field"           "echo '$RESP2' | jq -e '.data' > /dev/null"
check "data.relation is boolean"          "echo '$RESP2' | jq -e '.data.relation | type == \"boolean\"' > /dev/null"
check "data.relation == false"            "echo '$RESP2' | jq -e '.data.relation == false' > /dev/null"
check "data.candidates is array"          "echo '$RESP2' | jq -e '.data.candidates | type == \"array\"' > /dev/null"
check "candidates not empty"             "echo '$RESP2' | jq -e '.data.candidates | length > 0' > /dev/null"

# Validate first candidate fields
check "candidates[0] has id"             "echo '$RESP2' | jq -e '.data.candidates[0].id | type == \"string\"' > /dev/null"
check "candidates[0] has name"           "echo '$RESP2' | jq -e '.data.candidates[0].name | type == \"string\"' > /dev/null"
check "candidates[0] has label"          "echo '$RESP2' | jq -e '.data.candidates[0].label | type == \"string\"' > /dev/null"
check "candidates[0] has text"           "echo '$RESP2' | jq -e '.data.candidates[0].text | type == \"string\"' > /dev/null"
check "candidates[0] has properties obj" "echo '$RESP2' | jq -e '.data.candidates[0].properties | type == \"object\"' > /dev/null"

# ── Test 3: Relation query (relation: true) ───────────────────────────────────

echo ""
blue "Test 3: Relation query (relation: true)"

RESP3=$(curl -s --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"query":"tìm người có quan hệ với nhau","conversationId":"test-002","history":[]}')

check "Response has data field"             "echo '$RESP3' | jq -e '.data' > /dev/null"
check "data.relation == true"              "echo '$RESP3' | jq -e '.data.relation == true' > /dev/null"
check "data.candidates is array"           "echo '$RESP3' | jq -e '.data.candidates | type == \"array\"' > /dev/null"
check "candidates not empty"              "echo '$RESP3' | jq -e '.data.candidates | length > 0' > /dev/null"

# Validate first relation block fields
check "candidates[0] has e1"              "echo '$RESP3' | jq -e '.data.candidates[0].e1 | type == \"object\"' > /dev/null"
check "candidates[0] has e2"              "echo '$RESP3' | jq -e '.data.candidates[0].e2 | type == \"object\"' > /dev/null"
check "candidates[0] has via (string)"    "echo '$RESP3' | jq -e '.data.candidates[0].via | type == \"string\"' > /dev/null"
check "candidates[0] has distance (num)"  "echo '$RESP3' | jq -e '.data.candidates[0].distance | type == \"number\"' > /dev/null"
check "candidates[0].target is e1 or e2" "echo '$RESP3' | jq -e '[\"e1\",\"e2\"] | contains([\"$( echo \"$RESP3\" | jq -r '.data.candidates[0].target')\"])' > /dev/null"
check "e1 has name"                       "echo '$RESP3' | jq -e '.data.candidates[0].e1.name | type == \"string\"' > /dev/null"
check "e2 has name"                       "echo '$RESP3' | jq -e '.data.candidates[0].e2.name | type == \"string\"' > /dev/null"

# ── Test 4: Handles empty history ─────────────────────────────────────────────

echo ""
blue "Test 4: Handles edge cases"

RESP4=$(curl -s -o /dev/null -w "%{http_code}" --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"query":"","image":null,"conversationId":"test-003","history":[]}' || echo "000")
check "Accepts empty query + null image"  "[[ '$RESP4' == '200' ]]"

RESP5=$(curl -s -o /dev/null -w "%{http_code}" --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "tìm người",
    "conversationId": "test-004",
    "history": [
      {"role":"user","content":"xin chào"},
      {"role":"assistant","content":"Chào bạn!"}
    ]
  }' || echo "000")
check "Accepts non-empty history[]"       "[[ '$RESP5' == '200' ]]"

# ── Test 5: Timeout check (agent must respond < 30s) ─────────────────────────

echo ""
blue "Test 5: Response time"

START_TIME=$(date +%s%3N)
curl -s -o /dev/null --max-time 35 \
  -X POST "$AGENT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"query":"tìm người","conversationId":"test-005","history":[]}' || true
END_TIME=$(date +%s%3N)
ELAPSED=$(( END_TIME - START_TIME ))

if (( ELAPSED < 30000 )); then
  pass "Response in ${ELAPSED}ms (< 30s timeout)"
else
  fail "Response in ${ELAPSED}ms (exceeds 30s timeout — chatbot-temp will cancel)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
echo "Result: $PASS/$TOTAL tests passed"

if (( FAIL == 0 )); then
  green "All tests passed — agent contract is valid"
  exit 0
else
  red "$FAIL test(s) failed — fix before integrating"
  exit 1
fi
