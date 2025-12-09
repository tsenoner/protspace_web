import { defineConfig } from 'vitepress';
import { getUrls } from '../../config/urls';
import { getNavigation } from '../../config/navigation';

const isDev = process.env.NODE_ENV !== 'production';
const mode = isDev ? 'development' : 'production';
const urls = getUrls(mode);
const navItems = getNavigation(mode);

export default defineConfig({
  title: 'ProtSpace',
  description: 'Interactive visualization for protein language model embeddings',

  base: urls.docs,

  head: [['link', { rel: 'icon', href: '/docs/favicon.svg' }]],

  themeConfig: {
    logo: { src: '/logo.svg' },
    siteTitle: 'ProtSpace',

    nav: navItems
      .filter((item) => item.icon !== 'github') // Exclude GitHub icon (it's in socialLinks)
      .map((item) => {
        // When in VitePress (base is /docs/), map "Docs" link to root '/'
        // to avoid /docs/docs/ issue
        const link = item.text === 'Docs' ? '/' : item.link || '';

        return {
          text: item.text,
          link,
          ...(item.link && item.text !== 'Docs' && { target: '_self' }), // Only set target for non-Docs items
          ...(item.items && { items: item.items }),
        };
      }),

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/' },
          { text: 'What is ProtSpace?', link: '/guide/' },
          { text: 'Installation', link: '/guide/installation' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Data Format', link: '/guide/data-format' },
          { text: 'Data Preparation', link: '/guide/data-preparation' },
          { text: 'User Guide', link: '/guide/user-guide' },
        ],
      },
      {
        text: 'Integration',
        items: [
          { text: 'HTML', link: '/guide/integration-html' },
          { text: 'React', link: '/guide/integration-react' },
          { text: 'Vue', link: '/guide/integration-vue' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Developer Guide', link: '/guide/developer-guide' },
          { text: 'FAQ', link: '/guide/faq' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Scatterplot', link: '/api/scatterplot' },
          { text: 'Legend', link: '/api/legend' },
          { text: 'Control Bar', link: '/api/control-bar' },
          { text: 'Structure Viewer', link: '/api/structure-viewer' },
          { text: 'Data Loading', link: '/api/data-loading' },
        ],
      },
      {
        text: 'Examples',
        items: [{ text: 'Basic Usage', link: '/examples/' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/tsenoner/protspace_web' }],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2025 Rostlab, TU Munich',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/tsenoner/protspace_web/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
