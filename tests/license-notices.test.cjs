const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t, license, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'license-notices-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(__dirname, '../scripts/generate-license-notices.cjs'), path.join(root, 'scripts/generate-license-notices.cjs'));
  fs.writeFileSync(path.join(root, 'LICENSE'), 'Project MIT license\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
  const dependency = path.join(root, 'node_modules/example');
  fs.mkdirSync(dependency, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dependency, name)), { recursive: true });
    fs.writeFileSync(path.join(dependency, name), content);
  }
  const packages = {
    'example@1.2.3': { licenses: license, path: dependency, licenseFile: files.LICENSE ? path.join(dependency, 'LICENSE') : undefined },
  };
  const checker = path.join(root, 'node_modules/license-checker');
  fs.mkdirSync(checker);
  fs.writeFileSync(path.join(checker, 'index.js'), `exports.init = (options, callback) => callback(null, ${JSON.stringify(packages)});`);
  return { root, run: () => spawnSync(process.execPath, ['scripts/generate-license-notices.cjs', 'static'], { cwd: root, encoding: 'utf8' }) };
}

test('static distributions retain the project license, multiple license texts and upstream NOTICE', (t) => {
  const { root, run } = fixture(t, 'Apache-2.0 OR MIT', { LICENSE: 'Apache text', 'LICENSE-MIT': 'MIT text', NOTICE: 'Required attribution', 'lib-vendor/component/LICENSE': 'Vendored copyright' });
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'static/LICENSE.txt'), 'utf8'), 'Project MIT license\n');
  const notices = fs.readFileSync(path.join(root, 'static/THIRD_PARTY_LICENSES.txt'), 'utf8');
  for (const text of ['Apache text', 'MIT text', 'Required attribution', 'lib-vendor/component/LICENSE', 'Vendored copyright', 'https://registry.npmjs.org/example/-/example-1.2.3.tgz']) assert.ok(notices.includes(text));
});

test('unknown license metadata prevents a distribution', (t) => {
  const { run } = fixture(t, 'UNKNOWN', { LICENSE: 'Some text' });
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /Review the license/);
});

test('missing license text prevents a distribution', (t) => {
  const { run } = fixture(t, 'MIT', {});
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /No license text/);
});

test('empty license text prevents a distribution', (t) => {
  const { run } = fixture(t, 'MIT', { LICENSE: '' });
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /Empty license\/notice file/);
});
