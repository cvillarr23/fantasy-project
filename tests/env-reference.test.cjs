const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '../scripts/env-reference.mjs');
const load = () => import(script);

function checkouts(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-reference-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const repo of ['fantasy-core-pipeline', 'fantasy-browser-worker', 'fantasy-web-ui', 'fantasy-infra']) {
    fs.mkdirSync(path.join(root, repo), { recursive: true });
  }
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const entry = (name, repos, extra = {}) => ({ name, repos, secret: false, description: 'd', required: 'no', default: null, ...extra });

test('finds each way the services read a variable', async (t) => {
  const { scan } = await load();
  const root = checkouts(t, {
    'fantasy-core-pipeline/src/a.py': [
      'import os',
      'A = os.getenv("CORE_GETENV", "x")',
      'B = os.environ.get(\'CORE_ENVIRON_GET\')',
      'C = os.environ["CORE_ENVIRON_INDEX"]',
      'os.environ["CORE_WRITTEN"] = "1"',
      'D = _require_env("CORE_REQUIRED")',
    ].join('\n'),
    'fantasy-core-pipeline/tests/test_a.py': 'os.getenv("CORE_TEST_ONLY")',
    'fantasy-browser-worker/src/b.js': [
      'const a = process.env.WORKER_DOT;',
      'const b = process.env["WORKER_INDEX"];',
      'const { WORKER_DESTRUCTURED, WORKER_RENAMED: renamed } = process.env;',
      'process.env.WORKER_WRITTEN = "1";',
    ].join('\n'),
    'fantasy-browser-worker/scripts/start-vnc.sh': 'PORT="${VNC_TEST_PORT:-5900}"\necho "$OTHER"',
    'fantasy-web-ui/vite.config.ts': 'const t = process.env.UI_PROXY ?? ""',
    'fantasy-web-ui/src/c.ts': 'const d = import.meta.env.DEV ? import.meta.env.VITE_UI_VALUE : ""',
    'fantasy-web-ui/src/c.test.ts': 'process.env.UI_TEST_ONLY',
    'fantasy-web-ui/nginx.conf.template': 'proxy_pass http://${UI_UPSTREAM}$request_uri;',
  });
  const { repos } = scan(root);
  assert.deepEqual(Object.keys(repos.core.reads).sort(), ['CORE_ENVIRON_GET', 'CORE_ENVIRON_INDEX', 'CORE_GETENV', 'CORE_REQUIRED']);
  assert.deepEqual(Object.keys(repos.worker.reads).sort(), ['VNC_TEST_PORT', 'WORKER_DESTRUCTURED', 'WORKER_DOT', 'WORKER_INDEX', 'WORKER_RENAMED']);
  assert.deepEqual(Object.keys(repos.ui.reads).sort(), ['UI_PROXY', 'UI_UPSTREAM', 'VITE_UI_VALUE']);
  assert.deepEqual(repos.core.reads.CORE_GETENV, [{ file: 'src/a.py', line: 2 }]);
});

test('reads what infra sets, including envFrom ConfigMaps and ExternalSecrets', async (t) => {
  const { scanInfra } = await load();
  const root = checkouts(t, {
    'fantasy-infra/base/app.yaml': `
apiVersion: apps/v1
kind: Deployment
metadata: {name: app}
spec:
  template:
    spec:
      initContainers:
        - name: init
          env: [{name: INIT_VALUE, value: "1"}]
      containers:
        - name: app
          env:
            - {name: PLAIN, value: "x"}
            - name: FROM_SECRET
              valueFrom: {secretKeyRef: {name: creds, key: k}}
          envFrom:
            - configMapRef: {name: settings}
            - secretRef: {name: tokens}
---
apiVersion: v1
kind: ConfigMap
metadata: {name: settings}
data: {FROM_CONFIGMAP: "y"}
`,
    'fantasy-infra/overlays/production/externalsecrets.yaml': `
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: {name: tokens}
spec:
  target: {name: tokens}
  data:
    - {secretKey: FROM_EXTERNAL_SECRET, remoteRef: {key: fantasy/x}}
`,
  });
  const infra = scanInfra(path.join(root, 'fantasy-infra'));
  assert.deepEqual(Object.keys(infra).sort(), ['FROM_CONFIGMAP', 'FROM_EXTERNAL_SECRET', 'FROM_SECRET', 'INIT_VALUE', 'PLAIN']);
  assert.equal(infra.FROM_SECRET.secret, true);
  assert.equal(infra.FROM_EXTERNAL_SECRET.secret, true);
  assert.equal(infra.FROM_CONFIGMAP.secret, false);
  assert.deepEqual(infra.PLAIN.workloads, ['app']);
});

test('reports variables missing from the metadata and in the wrong repo', async (t) => {
  const { scan, diff } = await load();
  const root = checkouts(t, {
    'fantasy-core-pipeline/src/a.py': 'os.getenv("SHARED")\nos.getenv("UNDOCUMENTED")',
    'fantasy-browser-worker/src/b.js': 'process.env.SHARED',
  });
  const problems = diff({ variables: [entry('SHARED', ['core'])], ignore: [] }, scan(root));
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /UNDOCUMENTED: read by core \(src\/a.py:2\) but missing/);
  assert.match(problems.join('\n'), /SHARED: read by worker .* lists repos \[core\]/);
});

test('reports entries the code no longer reads, but accepts names passed to a helper', async (t) => {
  const { scan, diff } = await load();
  const root = checkouts(t, {
    'fantasy-browser-worker/src/env.js': 'const NAME = "VIA_HELPER";\nconst x = env.VIA_PARAMETER;',
  });
  const metadata = {
    variables: [entry('VIA_HELPER', ['worker']), entry('VIA_PARAMETER', ['worker']), entry('REMOVED', ['worker'])],
    ignore: [],
  };
  assert.deepEqual(diff(metadata, scan(root)), ['REMOVED: env-vars.yaml lists worker, but worker no longer reads it.']);
});

test('pattern entries cover dynamic names and ignore entries must still exist', async (t) => {
  const { scan, diff } = await load();
  const root = checkouts(t, {
    'fantasy-core-pipeline/src/a.py': 'os.getenv("INTERNAL_PID")',
    'fantasy-infra/base/app.yaml': `
kind: Deployment
metadata: {name: app}
spec: {template: {spec: {containers: [{name: app, env: [{name: GROQ_API_KEY, valueFrom: {secretKeyRef: {name: g, key: k}}}]}]}}}
`,
  });
  const metadata = {
    variables: [entry('{PROVIDER}_API_KEY', ['core'], { pattern: true, secret: true })],
    ignore: [{ name: 'INTERNAL_PID', reason: 'r' }, { name: 'GONE', reason: 'r' }],
  };
  assert.deepEqual(diff(metadata, scan(root)), ['GONE: listed under ignore in env-vars.yaml but no longer read or set anywhere.']);
});

test('flags infra secrets marked as not secret and platform entries infra dropped', async (t) => {
  const { scan, diff } = await load();
  const root = checkouts(t, {
    'fantasy-infra/base/app.yaml': `
kind: Deployment
metadata: {name: app}
spec: {template: {spec: {containers: [{name: app, env: [{name: TOKEN, valueFrom: {secretKeyRef: {name: t, key: k}}}]}]}}}
`,
  });
  const metadata = { variables: [entry('TOKEN', ['platform']), entry('DROPPED', ['platform'])], ignore: [] };
  assert.deepEqual(diff(metadata, scan(root)), [
    'TOKEN: fantasy-infra sets it from a Secret, but env-vars.yaml marks it secret: false.',
    'DROPPED: env-vars.yaml lists it for a platform image, but fantasy-infra no longer sets it.',
  ]);
});

test('the checked-in metadata entries are complete', async () => {
  const { loadMetadata, diff } = await load();
  const metadata = loadMetadata();
  assert.ok(metadata.variables.length > 100);
  const shape = diff(metadata, { repos: {}, infra: null });
  assert.deepEqual(shape, []);
});

test('the command fails without the checkouts', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-reference-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script, '--check'], {
    encoding: 'utf8',
    env: { ...process.env, FANTASY_DOCS_ROOT: root },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing checkouts .*Set FANTASY_DOCS_ROOT/);
});
