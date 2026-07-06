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
          {
            text: '快速上手',
            items: [
              { text: '安装', link: '/guide/install' },
              { text: '配置', link: '/guide/config' },
              { text: '第一条任务', link: '/guide/first-task' },
            ],
          },
          { text: 'GitHub', link: 'https://github.com/attson/atwebpilot' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: '快速上手',
              items: [
                { text: '安装', link: '/guide/install' },
                { text: '配置', link: '/guide/config' },
                { text: '第一条任务', link: '/guide/first-task' },
              ],
            },
          ],
        },
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
          {
            text: 'Guide',
            items: [
              { text: 'Install', link: '/en/guide/install' },
              { text: 'Configuration', link: '/en/guide/config' },
              { text: 'First task', link: '/en/guide/first-task' },
            ],
          },
          { text: 'GitHub', link: 'https://github.com/attson/atwebpilot' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Install', link: '/en/guide/install' },
                { text: 'Configuration', link: '/en/guide/config' },
                { text: 'First task', link: '/en/guide/first-task' },
              ],
            },
          ],
        },
        footer: {
          message: 'MIT License',
          copyright: 'Copyright © 2026 attson',
        },
      },
    },
  },
});
