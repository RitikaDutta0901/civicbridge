#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:5173}"
api_pid=""
web_pid=""

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  [ -z "$api_pid" ] || kill "$api_pid" 2>/dev/null || true
  [ -z "$web_pid" ] || kill "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT

wait_for_url() {
  local url="$1"
  for _ in $(seq 1 30); do
    curl --silent --fail "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

printf '%s\n' 'CivicBridge runtime validation'
printf 'API: %s\nWeb: %s\n\n' "$API_URL" "$WEB_URL"

if ! wait_for_url "$API_URL/api/health"; then
  printf 'API is not running; starting it for validation...\n'
  (cd "$ROOT/backend" && npm start >/tmp/civicbridge-api-validation.log 2>&1) &
  api_pid=$!
  wait_for_url "$API_URL/api/health" ||
    fail "API could not start; see /tmp/civicbridge-api-validation.log"
fi

health="$(curl --fail --silent --show-error "$API_URL/api/health")" ||
  fail "API is not reachable at $API_URL"
printf 'PASS: API health: %s\n' "$health"

if ! printf '%s' "$health" | grep -q '"database":"connected"'; then
  fail "API is not connected to PostgreSQL"
fi

(cd "$ROOT/backend" && npm test) ||
  fail "Backend integration tests failed"
printf 'PASS: backend integration tests\n'

(cd "$ROOT/backend" && npm run prisma:validate) ||
  fail "Prisma validation failed"
printf 'PASS: Prisma schema validation\n'

(cd "$ROOT/frontend" && npm run build) ||
  fail "Frontend build failed"
printf 'PASS: frontend production build\n'

if ! wait_for_url "$WEB_URL/"; then
  printf 'Frontend is not running; starting it for validation...\n'
  (cd "$ROOT/frontend" && npm run dev -- --host 127.0.0.1 >/tmp/civicbridge-web-validation.log 2>&1) &
  web_pid=$!
  wait_for_url "$WEB_URL/" ||
    fail "Frontend could not start; see /tmp/civicbridge-web-validation.log"
fi

chrome=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    chrome="$(command -v "$candidate")"
    break
  fi
done

[ -n "$chrome" ] || fail "No system Chrome/Chromium executable was found"

dom_file="$(mktemp)"
trap 'rm -f "$dom_file"; cleanup' EXIT
"$chrome" --headless --no-sandbox --disable-gpu --dump-dom "$WEB_URL/" >"$dom_file" 2>/dev/null ||
  fail "Chrome could not render $WEB_URL/"

grep -q 'CivicBridge' "$dom_file" ||
  fail "Rendered page did not contain CivicBridge content"
printf 'PASS: system Chrome rendered the frontend\n'

printf '\nALL RUNTIME CHECKS PASSED\n'
