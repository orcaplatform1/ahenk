#!/usr/bin/env bash
# Kullanım: bash tests/e2e/run.sh [api|ui|all]  Önkoşul: test API :4100, test web :3104 ve ahenk_test.
cd "$(dirname "$0")"; A=${AHENK_TEST_ARTIFACTS:-/root/ahenk-test-artifacts}; M=${1:-all}
mkdir -p "$A/uploads"; [ -L /root/ahenk-test/uploads ] || { rm -rf /root/ahenk-test/uploads; ln -s "$A/uploads" /root/ahenk-test/uploads; }
redis-cli -n 5 flushdb >/dev/null; : > "$A/outbox.log"; : > "$A/coverage.jsonl"
if [ "$M" != ui ]; then node --test --test-concurrency=1 --test-timeout=600000 --test-reporter=tap --test-reporter-destination="$A/api.tap" api/*.test.js ; fi
if [ "$M" != api ]; then NODE_PATH=$PWD/node_modules PLAYWRIGHT_JSON_OUTPUT_NAME=$A/ui-results.json npx playwright test --config=ui/playwright.config.js --reporter=json >/dev/null; fi
