import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/atwebpilot/',
  title: 'AtWebPilot',
  description: 'AI 网页助手 · 在当前 tab 上读写采',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/atwebpilot/favicon.svg' }],
  ],
  cleanUrls: true,
  lastUpdated: false,
  ignoreDeadLinks: false,
  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [{ icon: 'github', link: 'https://github.com/attson/atwebpilot' }],
  },
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: 'GitHub', link: 'https://github.com/attson/atwebpilot' },
        ],
        footer: {
          message: 'MIT License',
          copyright: 'Copyright © 2026 attson',
        },
        outline: { label: '本页目录' },
        docFooter: { prev: '上一页', next: '下一页' },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'GitHub', link: 'https://github.com/attson/atwebpilot' },
        ],
        footer: {
          message: 'MIT License',
          copyright: 'Copyright © 2026 attson',
        },
      },
    },
  },
});
