// Builds the environment variable reference on /installation/configuration and checks
// it against the code. Descriptions, defaults and flags are hand-written in
// docs/installation/env-vars.yaml; this script scans the four source checkouts for the
// variables each one reads (and fantasy-infra for the ones production sets) and reports
// any disagreement. The site build runs it through the envReference plugin in
// docusaurus.config.ts; `npm run check:env` runs the same check from the command line.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import yaml from 'js-yaml';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const metadataPath = path.join(siteRoot, 'docs/installation/env-vars.yaml');

const NAME = '([A-Z][A-Z0-9_]*)';
// A trailing `=` (but not `==`) marks an assignment, which sets a variable rather than reading it.
const notAssigned = '(?!\\s*=[^=])';

const python = [
  new RegExp(`\\bos\\.getenv\\(\\s*["']${NAME}["']`, 'g'),
  new RegExp(`\\bos\\.environ\\.get\\(\\s*["']${NAME}["']`, 'g'),
  new RegExp(`\\bos\\.environ\\[\\s*["']${NAME}["']\\s*\\]${notAssigned}`, 'g'),
  // sync_league and sync_rumors wrap os.getenv in a helper that fails on a missing value.
  new RegExp(`\\b_require_env\\(\\s*["']${NAME}["']`, 'g'),
];
const javascript = [
  new RegExp(`\\bprocess\\.env\\.${NAME}\\b${notAssigned}`, 'g'),
  new RegExp(`\\bprocess\\.env\\[\\s*["'\`]${NAME}["'\`]\\s*\\]${notAssigned}`, 'g'),
  new RegExp(`\\bimport\\.meta\\.env\\.${NAME}\\b`, 'g'),
];
// Variables Vite defines itself rather than reading from the environment.
const viteBuiltins = new Set(['DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR']);
const destructured = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*process\.env\b/g;
const shellDefault = new RegExp(`\\$\\{${NAME}:?-`, 'g');
// envsubst placeholders in the web-ui nginx template; nginx's own variables have no braces.
const templateVar = new RegExp(`\\$\\{${NAME}\\}`, 'g');

export const sources = [
  {
    id: 'core', repo: 'fantasy-core-pipeline', branch: 'main',
    files: [{dir: 'src', ext: ['.py'], patterns: python}, {dir: 'scripts', ext: ['.py'], patterns: python}],
  },
  {
    id: 'worker', repo: 'fantasy-browser-worker', branch: 'main',
    files: [
      {dir: 'src', ext: ['.js', '.mjs', '.cjs'], patterns: javascript, destructure: true},
      {dir: 'scripts', ext: ['.js', '.mjs', '.cjs'], patterns: javascript, destructure: true},
      // The remote-login image runs this script before Node starts; the other shell
      // scripts are operator helpers that mostly expand their own variables.
      {file: 'scripts/start-vnc.sh', patterns: [shellDefault]},
    ],
  },
  {
    id: 'ui', repo: 'fantasy-web-ui', branch: 'master',
    files: [
      {file: 'vite.config.ts', patterns: javascript},
      {file: 'vitest.config.ts', patterns: javascript},
      {dir: 'src', ext: ['.ts', '.tsx'], patterns: javascript},
      {file: 'nginx.conf.template', patterns: [templateVar]},
    ],
  },
];
export const infraSource = {id: 'infra', repo: 'fantasy-infra', branch: 'main', dirs: ['base', 'overlays']};
export const repoIds = ['core', 'worker', 'ui'];

const skippedDirs = new Set(['node_modules', '.git', 'tests', 'test', '__tests__', 'docs', 'dist', 'build', 'storybook-static', 'coverage']);
const skippedFile = /\.(test|spec|stories)\.[cm]?[jt]sx?$/;

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return skippedDirs.has(entry.name) ? [] : walk(full, ext);
    return ext.includes(path.extname(entry.name)) && !skippedFile.test(entry.name) ? [full] : [];
  });
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function sourceFiles(checkout, source) {
  return source.files.flatMap((spec) => {
    const files = spec.file ? [path.join(checkout, spec.file)].filter(existsSync) : walk(path.join(checkout, spec.dir), spec.ext);
    return files.map((file) => ({file, spec}));
  });
}

// Returns {name: [{file, line}]} for every variable the checkout reads directly, plus the
// text of each scanned file for the looser "is the name mentioned at all" test.
export function scanRepo(checkout, source) {
  const reads = {};
  const texts = [];
  const add = (name, file, line) => {
    if (viteBuiltins.has(name)) return;
    (reads[name] ??= []).push({file: path.relative(checkout, file).split(path.sep).join('/'), line});
  };
  for (const {file, spec} of sourceFiles(checkout, source)) {
    const text = readFileSync(file, 'utf8');
    texts.push(text);
    for (const pattern of spec.patterns) {
      for (const match of text.matchAll(pattern)) add(match[1], file, lineOf(text, match.index));
    }
    if (spec.destructure) {
      for (const match of text.matchAll(destructured)) {
        for (const part of match[1].split(',')) {
          const name = part.split(/[:=]/)[0].trim();
          if (/^[A-Z][A-Z0-9_]*$/.test(name)) add(name, file, lineOf(text, match.index));
        }
      }
    }
  }
  return {reads, texts};
}

function containersIn(node, found = []) {
  if (Array.isArray(node)) node.forEach((item) => containersIn(item, found));
  else if (node && typeof node === 'object') {
    for (const key of ['containers', 'initContainers']) {
      if (Array.isArray(node[key])) found.push(...node[key].filter((c) => c && typeof c === 'object'));
    }
    Object.values(node).forEach((value) => containersIn(value, found));
  }
  return found;
}

// Returns {name: {secret, workloads}} for every variable a container in base/ or
// overlays/ sets, including keys pulled in with envFrom from a ConfigMap or from a Secret
// that an ExternalSecret in the repo creates.
export function scanInfra(checkout) {
  const docs = infraSource.dirs.flatMap((dir) => walk(path.join(checkout, dir), ['.yaml', '.yml']))
    .flatMap((file) => {
      try {
        return yaml.loadAll(readFileSync(file, 'utf8')).filter((doc) => doc && typeof doc === 'object');
      } catch {
        return [];
      }
    });
  const configMaps = new Map();
  const secrets = new Map();
  for (const doc of docs) {
    if (doc.kind === 'ConfigMap' && doc.metadata?.name) {
      configMaps.set(doc.metadata.name, Object.keys(doc.data ?? {}));
    }
    if (doc.kind === 'ExternalSecret') {
      const target = doc.spec?.target?.name ?? doc.metadata?.name;
      const keys = [
        ...(doc.spec?.data ?? []).map((item) => item.secretKey),
        ...Object.keys(doc.spec?.target?.template?.data ?? {}),
      ].filter(Boolean);
      secrets.set(target, [...(secrets.get(target) ?? []), ...keys]);
    }
  }
  const vars = {};
  const add = (name, secret, workload) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return;
    const entry = (vars[name] ??= {secret: false, workloads: []});
    entry.secret ||= secret;
    if (workload && !entry.workloads.includes(workload)) entry.workloads.push(workload);
  };
  for (const doc of docs) {
    const workload = doc.metadata?.name;
    for (const container of containersIn(doc.spec)) {
      for (const env of container.env ?? []) {
        if (env?.name) add(env.name, Boolean(env.valueFrom?.secretKeyRef), workload);
      }
      for (const from of container.envFrom ?? []) {
        if (from?.configMapRef) (configMaps.get(from.configMapRef.name) ?? []).forEach((key) => add(key, false, workload));
        if (from?.secretRef) (secrets.get(from.secretRef.name) ?? []).forEach((key) => add(key, true, workload));
      }
    }
  }
  return vars;
}

export function loadMetadata(file = metadataPath) {
  const data = yaml.load(readFileSync(file, 'utf8')) ?? {};
  return {variables: data.variables ?? [], ignore: data.ignore ?? []};
}

// `{PROVIDER}_API_KEY` matches GROQ_API_KEY, GEMINI_API_KEY and so on.
const patternRegex = (name) => new RegExp(`^${name.replace(/\{[A-Z_]+\}/g, '[A-Z0-9]+')}$`);

export function scan(root) {
  const repos = {};
  for (const source of sources) {
    const checkout = path.join(root, source.repo);
    if (existsSync(checkout)) repos[source.id] = scanRepo(checkout, source);
  }
  const infraCheckout = path.join(root, infraSource.repo);
  const infra = existsSync(infraCheckout) ? scanInfra(infraCheckout) : null;
  return {repos, infra};
}

// Lists every disagreement between the metadata and a full scan, as readable strings.
export function diff(metadata, {repos, infra}) {
  const problems = [];
  const byName = new Map(metadata.variables.map((entry) => [entry.name, entry]));
  const patterns = metadata.variables.filter((entry) => entry.pattern).map((entry) => ({entry, regex: patternRegex(entry.name)}));
  const ignored = new Set(metadata.ignore.map((entry) => entry.name));
  const describe = (name) => byName.get(name) ?? patterns.find(({regex}) => regex.test(name))?.entry;
  const where = (hits) => hits.slice(0, 3).map((hit) => `${hit.file}:${hit.line}`).join(', ');

  for (const entry of metadata.variables) {
    if (!entry.name || !Array.isArray(entry.repos) || typeof entry.secret !== 'boolean' || !entry.description) {
      problems.push(`${entry.name ?? '(unnamed entry)'}: needs name, repos, secret and description in env-vars.yaml.`);
    }
  }
  for (const [id, {reads}] of Object.entries(repos)) {
    for (const [name, hits] of Object.entries(reads)) {
      if (ignored.has(name)) continue;
      const entry = describe(name);
      if (!entry) problems.push(`${name}: read by ${id} (${where(hits)}) but missing from env-vars.yaml.`);
      else if (!entry.repos?.includes(id)) problems.push(`${name}: read by ${id} (${where(hits)}) but env-vars.yaml lists repos [${entry.repos}].`);
    }
  }
  for (const entry of metadata.variables) {
    if (entry.pattern) continue;
    for (const id of entry.repos ?? []) {
      if (id === 'platform') continue;
      const scanned = repos[id];
      if (!scanned) continue;
      // Some names reach os.getenv or process.env through a helper, a list or an `env`
      // parameter, so a quoted mention or an `env.NAME` access in scanned source counts.
      const mentioned = new RegExp(`["'\`]${entry.name}["'\`]|\\benv\\.${entry.name}\\b`);
      if (!scanned.reads[entry.name] && !scanned.texts.some((text) => mentioned.test(text))) {
        problems.push(`${entry.name}: env-vars.yaml lists ${id}, but ${id} no longer reads it.`);
      }
    }
  }
  if (infra) {
    for (const [name, set] of Object.entries(infra)) {
      if (ignored.has(name)) continue;
      const entry = describe(name);
      if (!entry) problems.push(`${name}: set by fantasy-infra (${set.workloads.slice(0, 3).join(', ')}) but missing from env-vars.yaml.`);
      else if (set.secret && !entry.secret) problems.push(`${name}: fantasy-infra sets it from a Secret, but env-vars.yaml marks it secret: false.`);
    }
    for (const entry of metadata.variables) {
      if (entry.repos?.includes('platform') && !infra[entry.name]) {
        problems.push(`${entry.name}: env-vars.yaml lists it for a platform image, but fantasy-infra no longer sets it.`);
      }
    }
    const seen = new Set([...Object.values(repos).flatMap(({reads}) => Object.keys(reads)), ...Object.keys(infra)]);
    for (const name of ignored) {
      if (!seen.has(name)) problems.push(`${name}: listed under ignore in env-vars.yaml but no longer read or set anywhere.`);
    }
  }
  return problems;
}

// The data the EnvReference component renders. Without the checkouts it carries only the
// hand-written metadata.
export function buildReference(root, {scanRepos = true} = {}) {
  const metadata = loadMetadata();
  const scanned = scanRepos ? scan(root) : {repos: {}, infra: null};
  const complete = sources.every((source) => scanned.repos[source.id]) && scanned.infra !== null;
  const links = Object.fromEntries(sources.map((source) => [source.id, `https://github.com/cvillarr23/${source.repo}/blob/${source.branch}`]));
  const variables = metadata.variables.map((entry) => {
    const regex = entry.pattern ? patternRegex(entry.name) : null;
    const matches = (name) => (regex ? regex.test(name) : name === entry.name);
    const readIn = Object.entries(scanned.repos).flatMap(([id, {reads}]) => Object.entries(reads)
      .filter(([name]) => matches(name))
      .flatMap(([, hits]) => hits.map((hit) => ({repo: id, file: hit.file, line: hit.line, url: `${links[id]}/${hit.file}#L${hit.line}`}))));
    const infraNames = Object.entries(scanned.infra ?? {}).filter(([name]) => matches(name));
    return {
      ...entry,
      readIn,
      production: scanned.infra ? (infraNames.length > 0 ? {secret: infraNames.some(([, set]) => set.secret)} : null) : undefined,
    };
  });
  return {variables, complete, problems: complete ? diff(metadata, scanned) : []};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = path.resolve(process.env.FANTASY_DOCS_ROOT ?? path.join(siteRoot, '..'));
  const missing = [...sources, infraSource].filter((source) => !existsSync(path.join(root, source.repo)));
  if (missing.length > 0) {
    console.error(`Missing checkouts under ${root}: ${missing.map((source) => source.repo).join(', ')}. Set FANTASY_DOCS_ROOT.`);
    process.exit(1);
  }
  const problems = diff(loadMetadata(), scan(root));
  if (problems.length > 0) {
    console.error(`Environment variable reference is out of date (docs/installation/env-vars.yaml):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Environment variable reference matches the code.');
}
