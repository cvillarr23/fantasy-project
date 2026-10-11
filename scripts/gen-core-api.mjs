// Regenerates the core API explorer pages from core's docs/openapi.json.
// Runs before `npm run build` and `npm start`; the output is gitignored.
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const out = 'generated/core-api';
const specOut = 'generated/core-api-spec.json';
const fallbackSpec = 'repo-docs-fallback/core/openapi.json';

const coreSpec = path.resolve(process.env.FANTASY_DOCS_ROOT ?? '..', 'fantasy-core-pipeline', 'docs', 'openapi.json');
const useCore = process.env.FANTASY_DOCS_SITE_ONLY !== 'true' && existsSync(coreSpec);
if (!useCore && process.env.FANTASY_DOCS_REQUIRED === 'true') {
  throw new Error(`Missing ${coreSpec}. Check DOCS_REPOS_READ_TOKEN and the repository checkouts.`);
}
const spec = JSON.parse(readFileSync(useCore ? coreSpec : fallbackSpec, 'utf8'));

// Core's routes don't set OpenAPI tags yet. Group untagged operations by the
// area after /v1 so the sidebar isn't one flat list. This does nothing once
// core tags its routers.
const areaTitle = (route) => {
  const area = route.split('/')[2] ?? 'api';
  return area.charAt(0).toUpperCase() + area.slice(1);
};
for (const [route, item] of Object.entries(spec.paths ?? {})) {
  for (const operation of Object.values(item)) {
    if (operation && typeof operation === 'object' && !operation.tags?.length) {
      operation.tags = [areaTitle(route)];
    }
  }
}

// Docusaurus requires the docs folder to exist before any CLI command, including the generator.
rmSync('generated', {recursive: true, force: true});
mkdirSync(out, {recursive: true});
writeFileSync(specOut, `${JSON.stringify(spec, null, 2)}\n`);
execFileSync('npx', ['docusaurus', 'gen-api-docs', 'all'], {stdio: 'inherit'});
// The generator only writes endpoint pages; the hand-written landing page sits beside them.
copyFileSync('content/core-api-index.mdx', `${out}/index.mdx`);
