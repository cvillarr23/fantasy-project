const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t, { storybook }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-components-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const site = path.join(root, 'site');
  fs.mkdirSync(path.join(site, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../scripts/add-ui-components.mjs'), path.join(site, 'scripts/add-ui-components.mjs'));
  fs.mkdirSync(path.join(site, 'repo-docs-fallback/ui-components'), { recursive: true });
  fs.writeFileSync(path.join(site, 'repo-docs-fallback/ui-components/index.html'), 'placeholder');
  fs.mkdirSync(path.join(site, 'build'));
  if (storybook) {
    const built = path.join(root, 'checkouts/fantasy-web-ui/storybook-static');
    fs.mkdirSync(built, { recursive: true });
    fs.writeFileSync(path.join(built, 'index.html'), 'storybook');
  }
  const run = (env = {}) => spawnSync(process.execPath, ['scripts/add-ui-components.mjs'], {
    cwd: site,
    encoding: 'utf8',
    env: { ...process.env, FANTASY_DOCS_ROOT: path.join(root, 'checkouts'), FANTASY_DOCS_SITE_ONLY: '', FANTASY_DOCS_REQUIRED: '', ...env },
  });
  const page = () => fs.readFileSync(path.join(site, 'build/ui/components/index.html'), 'utf8');
  return { run, page };
}

test('copies the web-ui Storybook build to /ui/components/', (t) => {
  const { run, page } = fixture(t, { storybook: true });
  assert.equal(run({ FANTASY_DOCS_REQUIRED: 'true' }).status, 0);
  assert.equal(page(), 'storybook');
});

test('uses the placeholder when the Storybook build is missing', (t) => {
  const { run, page } = fixture(t, { storybook: false });
  assert.equal(run().status, 0);
  assert.equal(page(), 'placeholder');
});

test('site-only builds use the placeholder even when a build exists', (t) => {
  const { run, page } = fixture(t, { storybook: true });
  assert.equal(run({ FANTASY_DOCS_SITE_ONLY: 'true' }).status, 0);
  assert.equal(page(), 'placeholder');
});

test('required builds fail without the Storybook build', (t) => {
  const { run } = fixture(t, { storybook: false });
  const result = run({ FANTASY_DOCS_REQUIRED: 'true' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /build-storybook/);
});
