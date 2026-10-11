import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type {Options as DocsOptions} from '@docusaurus/plugin-content-docs';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const repoUrl = 'https://github.com/cvillarr23/fantasy-project';

const repositories = [
  {id: 'core', name: 'fantasy-core-pipeline', branch: 'main', label: 'Core'},
  {id: 'worker', name: 'fantasy-browser-worker', branch: 'main', label: 'Worker'},
  {id: 'ui', name: 'fantasy-web-ui', branch: 'master', label: 'UI'},
  {id: 'infra', name: 'fantasy-infra', branch: 'main', label: 'Infra'},
];

const repoDocsPlugins: NonNullable<Config['plugins']> = repositories.map((repo) => {
  const source = path.resolve(process.env.FANTASY_DOCS_ROOT ?? '..', repo.name, 'docs');
  const available = process.env.FANTASY_DOCS_SITE_ONLY !== 'true' && existsSync(source);
  if (!available && process.env.FANTASY_DOCS_REQUIRED === 'true') {
    throw new Error(`Missing ${source}. Check DOCS_REPOS_READ_TOKEN and the repository checkouts.`);
  }
  if (!available) console.warn(`Using local placeholder for ${repo.name}; checkout its docs to see the full section.`);
  return ['@docusaurus/plugin-content-docs', {
    id: repo.id,
    path: available ? source : `repo-docs-fallback/${repo.id}`,
    routeBasePath: repo.id,
    sidebarPath: './sidebars.ts',
    sidebarItemsGenerator: async (args) => {
      const items = await args.defaultSidebarItemsGenerator(args);
      // Repos without an index page still need a landing route for site navigation.
      if (available && !['index.md', 'index.mdx'].some((file) => existsSync(path.join(source, file)))) {
        return [{
          type: 'category',
          label: repo.label,
          link: {type: 'generated-index', slug: '/'},
          items,
        }];
      }
      return items;
    },
    exclude: ['**/superpowers/**', '**/plans/**', '**/working-notes/**'],
    editUrl: ({docPath}: {docPath: string}) => available
      ? `https://github.com/cvillarr23/${repo.name}/edit/${repo.branch}/docs/${docPath}`
      : `${repoUrl}/edit/main/repo-docs-fallback/${repo.id}/${docPath}`,
    showLastUpdateTime: available,
  } satisfies DocsOptions];
});

const config: Config = {
  title: 'Fantasy Project',
  tagline: 'How the fantasy-* services fit together',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://fantasy-docs.roo-net.cc',
  baseUrl: '/',

  organizationName: 'cvillarr23',
  projectName: 'fantasy-project',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    // Plain .md files parse as CommonMark rather than MDX, so stray braces and
    // angle brackets in docs (ours and, later, other repos') don't break the build.
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: ['/', ...repositories.map((repo) => `/${repo.id}`)],
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          // Docs-only site: the docs are the home page.
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `${repoUrl}/edit/main/`,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    ...repoDocsPlugins,
    function queueContracts() {
      const specPath = path.resolve(process.env.FANTASY_DOCS_ROOT ?? '..', 'fantasy-core-pipeline/docs/asyncapi.yaml');
      return {
        name: 'queue-contracts',
        getPathsToWatch: () => [specPath],
        async loadContent() {
          return process.env.FANTASY_DOCS_SITE_ONLY !== 'true' && existsSync(specPath)
            ? readFileSync(specPath, 'utf8') : null;
        },
        async contentLoaded({content, actions}) {
          actions.setGlobalData({schema: content});
        },
      };
    },
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Fantasy Project',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        ...repositories.map((repo) => ({
          type: 'docSidebar' as const,
          docsPluginId: repo.id,
          sidebarId: 'docs',
          position: 'left' as const,
          label: repo.label,
        })),
        {
          href: repoUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Repositories',
          items: [
            {label: 'fantasy-core-pipeline', href: 'https://github.com/cvillarr23/fantasy-core-pipeline'},
            {label: 'fantasy-browser-worker', href: 'https://github.com/cvillarr23/fantasy-browser-worker'},
            {label: 'fantasy-web-ui', href: 'https://github.com/cvillarr23/fantasy-web-ui'},
            {label: 'fantasy-infra', href: 'https://github.com/cvillarr23/fantasy-infra'},
          ],
        },
        {
          title: 'Planning',
          items: [
            {label: 'Wayfinder map', href: `${repoUrl}/issues/1`},
            {label: 'fantasy-project', href: repoUrl},
          ],
        },
        {
          title: 'About',
          items: [{label: 'Disclaimer and scope', to: '/disclaimer'}],
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'python'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
