import { defineConfig } from 'vitepress';

const HOME_URL = process.env.VITE_HOME_URL || 'http://localhost:8080/';
const EXPLORE_URL = `${HOME_URL.replace(/\/$/, '')}/explore`;

export default defineConfig({
  title: 'ProtSpace',
  description: 'Interactive visualization for protein language model embeddings',

  base: '/docs/',

  head: [['link', { rel: 'icon', href: '/docs/favicon.svg' }]],

  themeConfig: {
    logo: { src: '/logo.svg' },
    siteTitle: 'ProtSpace',

    nav: [
      {
        text: 'Home',
        link: HOME_URL,
        target: '_self',
      },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'Links',
        items: [
          { text: 'Explore', link: EXPLORE_URL, target: '_self' },
          { text: 'Python Package', link: 'https://github.com/tsenoner/protspace' },
          { text: 'Paper', link: 'https://doi.org/10.1016/j.jmb.2025.168940' },
        ],
      },
    ],

    sidebar: {
      '/': [
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
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [{ text: 'Overview', link: '/api/' }],
        },
        {
          text: 'Components',
          items: [
            { text: 'Scatterplot', link: '/api/scatterplot' },
            { text: 'Legend', link: '/api/legend' },
            { text: 'Control Bar', link: '/api/control-bar' },
            { text: 'Structure Viewer', link: '/api/structure-viewer' },
          ],
        },
        {
          text: 'Utilities',
          items: [{ text: 'Data Loading', link: '/api/data-loading' }],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [{ text: 'Basic Usage', link: '/examples/' }],
        },
      ],
    },

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
