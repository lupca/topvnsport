#!/usr/bin/env bash
set -euo pipefail

test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

# Load only the side-effect-free helper from deploy_prod.sh.
eval "$(sed -n '/^upsert_env_var() {/,/^}$/p' deploy_prod.sh)"

existing="$test_dir/existing.env"
printf '%s\n' \
  'FIRST=one' \
  'FERNET_KEY=old' \
  'SECOND=two' \
  'THIRD=three' > "$existing"
upsert_env_var "$existing" FERNET_KEY 'abc=/+=='
upsert_env_var "$existing" FERNET_KEY 'abc=/+=='
upsert_env_var "$existing" EMPTY_KEY ''

expected="$test_dir/expected.env"
printf '%s\n' \
  'FIRST=one' \
  'FERNET_KEY=abc=/+==' \
  'SECOND=two' \
  'THIRD=three' > "$expected"
cmp -s "$existing" "$expected"

appended="$test_dir/appended.env"
printf '%s\n' 'FIRST=one' 'SECOND=two' > "$appended"
upsert_env_var "$appended" FERNET_KEY 'new-value'
upsert_env_var "$appended" FERNET_KEY 'new-value'
test "$(grep -c '^FERNET_KEY=' "$appended")" -eq 1
test "$(tail -n 1 "$appended")" = 'FERNET_KEY=new-value'

echo "deploy env upsert tests passed"
