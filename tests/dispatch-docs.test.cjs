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
  const stdinFile = path.join(temp, 'stdin');
  fs.writeFileSync(path.join(temp, 'curl'), `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$DOCS_TEST_CALL_ARGS"
cat > "$DOCS_TEST_CALL_STDIN"
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
        DOCS_TEST_CALL_STDIN: stdinFile,
        DOCS_TEST_EXIT_CODE: '0',
        ...overrides,
      },
    });
    return {
      ...result,
      args: fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trimEnd().split('\n') : null,
      stdin: fs.existsSync(stdinFile) ? fs.readFileSync(stdinFile, 'utf8') : null,
    };
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

test('dispatches the caller repository and SHA without logging the token', () => {
  const result = dispatch();
  assert.equal(result.status, 0);
  assert.equal(result.args.at(-1), 'https://api.github.com/repos/cvillarr23/fantasy-project/dispatches');
  assert.ok(result.args.includes('POST'));
  const body = JSON.parse(result.args[result.args.indexOf('--data') + 1]);
  assert.deepEqual(body, {
    event_type: 'docs-updated',
    client_payload: {repository: 'cvillarr23/fantasy-browser-worker', sha: 'abc123'},
  });
  // The token only travels on stdin, never in the visible arguments.
  assert.equal(result.stdin, 'header = "Authorization: Bearer synthetic-test-token"\n');
  assert.ok(!result.args.some((arg) => arg.includes('synthetic-test-token')));
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
