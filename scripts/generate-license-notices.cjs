const fs = require('node:fs');
const path = require('node:path');
const checker = require('license-checker');

const root = path.resolve(__dirname, '..');
const output = path.join(root, process.argv[2] || 'public');
const project = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const overridesFile = path.join(__dirname, 'license-overrides.json');
const overrides = fs.existsSync(overridesFile)
  ? JSON.parse(fs.readFileSync(overridesFile, 'utf8'))
  : {};

function collectNotices(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      collectNotices(fullPath, files);
    } else if (entry.isFile() && /^(licen[cs]e|copying|notice)([._-]|$)/i.test(entry.name)) {
      files.add(fullPath);
    }
  }
}

checker.init({ start: root, production: true, excludePackages: `${project.name}@${project.version}` }, (error, packages) => {
  if (error) throw error;
  const notices = [];
  for (const [name, info] of Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (/UNKNOWN|UNLICENSED|Custom:/.test(String(info.licenses))) {
      throw new Error(`Review the license of ${name}: ${info.licenses}`);
    }
    const files = new Set();
    if (info.licenseFile && fs.readFileSync(info.licenseFile, 'utf8').trim()) files.add(info.licenseFile);
    // Vendored components can carry license and NOTICE files below the package root.
    collectNotices(info.path, files);
    if (overrides[name]) files.add(path.join(__dirname, overrides[name].file));
    if (!files.size) throw new Error(`No license text for ${name}; add a reviewed license override`);
    const separator = name.lastIndexOf('@');
    const packageName = name.slice(0, separator);
    const version = name.slice(separator + 1);
    const tarball = `https://registry.npmjs.org/${packageName}/-/${packageName.split('/').pop()}-${version}.tgz`;
    notices.push(`${name}\nLicense: ${info.licenses}\nSource: ${info.repository || info.url || tarball}\nPackage source archive: ${tarball}\n`);
    for (const file of [...files].sort()) {
      const text = fs.readFileSync(file, 'utf8').trim();
      if (!text) throw new Error(`Empty license/notice file for ${name}: ${file}`);
      const label = file.startsWith(`${info.path}${path.sep}`)
        ? path.relative(info.path, file)
        : path.basename(file);
      notices.push(`--- ${label} ---\n${text}\n`);
    }
  }
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE.txt'));
  fs.writeFileSync(path.join(output, 'THIRD_PARTY_LICENSES.txt'), notices.join('\n'));
  console.log(`Wrote license texts and notices for ${Object.keys(packages).length} packages to ${path.relative(root, output)}`);
});
