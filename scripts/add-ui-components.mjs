// Copies fantasy-web-ui's Storybook build into the site at /ui/components/.
// Runs after `docusaurus build` (npm postbuild). CI builds Storybook in the web-ui
// checkout first; builds without that checkout get a placeholder page instead, the
// same way the docs import falls back to repo-docs-fallback/.
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.resolve(siteRoot, process.env.FANTASY_DOCS_ROOT ?? '..');
const source = path.join(docsRoot, 'fantasy-web-ui', 'storybook-static');
const target = path.join(siteRoot, 'build', 'ui', 'components');
const placeholder = path.join(siteRoot, 'repo-docs-fallback', 'ui-components');

const available = process.env.FANTASY_DOCS_SITE_ONLY !== 'true' && existsSync(path.join(source, 'index.html'));
if (!available && process.env.FANTASY_DOCS_REQUIRED === 'true') {
  console.error(`Missing ${source}. Run "npm ci && npm run build-storybook" in the fantasy-web-ui checkout first.`);
  process.exit(1);
}

rmSync(target, {recursive: true, force: true});
mkdirSync(path.dirname(target), {recursive: true});
cpSync(available ? source : placeholder, target, {recursive: true});
console.log(available
  ? `Copied the component library from ${source}.`
  : 'Using the component library placeholder; build Storybook in fantasy-web-ui to see the full library.');
