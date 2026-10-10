const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');

const script = path.resolve(__dirname, '../.github/actions/dispatch-docs/dispatch.sh');

function dispatch(overrides = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-docs-test-'));
  const argsFile = path.join(temp, 'args');
  fs.writeFileSync(path.join(temp, 'gh'), `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$DOCS_TEST_CALL_ARGS"
exit "$DOCS_TEST_EXIT_CODE"
`, {mode: 0o700});
  try {
    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        GH_TOKEN: 'synthetic-test-token',
        SOURCE_REPOSITORY: 'cvillarr23/fantasy-browser-worker',
        SOURCE_SHA: 'abc123',
        DOCS_TEST_CALL_ARGS: argsFile,
        DOCS_TEST_EXIT_CODE: '0',
        ...overrides,
      },
    });
    return {...result, args: fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trimEnd().split('\n') : null};
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

test('dispatches the caller repository and SHA without logging the token', () => {
  const result = dispatch();
  assert.equal(result.status, 0);
  assert.deepEqual(result.args, [
    'api', '--method', 'POST', 'repos/cvillarr23/fantasy-project/dispatches',
    '-f', 'event_type=docs-updated',
    '-f', 'client_payload[repository]=cvillarr23/fantasy-browser-worker',
    '-f', 'client_payload[sha]=abc123',
  ]);
  assert.equal(result.stdout + result.stderr, '');
});

test('rejects a missing secret before making an API request', () => {
  const result = dispatch({GH_TOKEN: ''});
  assert.equal(result.status, 1);
  assert.equal(result.args, null);
  assert.match(result.stdout, /Set DOCS_SITE_DISPATCH_TOKEN/);
});

test('fails the caller step when GitHub rejects the dispatch', () => {
  const result = dispatch({DOCS_TEST_EXIT_CODE: '22'});
  assert.equal(result.status, 22);
});
