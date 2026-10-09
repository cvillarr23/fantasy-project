import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoUrl = 'https://github.com/cvillarr23/fantasy-project';

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
        docsRouteBasePath: '/',
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
