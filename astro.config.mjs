// @ts-check
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// 部署地址优先级：SITE_URL（推荐显式设置）→ 常见托管平台环境变量。
// 未配置时不生成 canonical，避免把站点指向错误的域名。
const rawSite =
  process.env.SITE_URL ||
  process.env.URL || // Netlify
  process.env.CF_PAGES_URL || // Cloudflare Pages
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

const site = rawSite ? `${rawSite.replace(/\/+$/, '')}/` : undefined;

// 部署在子路径时设置，例如 GitHub Pages 项目页：BASE_PATH=/nvx
const rawBase = process.env.BASE_PATH?.trim();
const base =
  rawBase && rawBase !== '/'
    ? `/${rawBase.replace(/^\/+|\/+$/g, '')}`
    : undefined;

// Markdown 与页面中的站内绝对链接（/docs/...）不会自动带 base。
// 构建完成后统一扫描 HTML，给尚未带前缀的 href/src 补上 base。
/** @param {string | undefined} basePath */
function prefixBaseLinksIntegration(basePath) {
  const prefix = basePath ? basePath.replace(/\/$/, '') : '';
  return {
    name: 'nvx-prefix-base-links',
    hooks: {
      /** @param {{ dir: URL }} context */
      'astro:build:done': async ({ dir }) => {
        if (!prefix) return;
        const root = fileURLToPath(dir);
        /** @param {string} directory */
        const walk = async (directory) => {
          const entries = await readdir(directory, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(directory, entry.name);
            if (entry.isDirectory()) {
              await walk(full);
            } else if (entry.name.endsWith('.html')) {
              const html = await readFile(full, 'utf8');
              const next = html.replace(/\b(href|src)="(\/[^"]*)"/g, (match, attr, value) => {
                if (value.startsWith('//')) return match;
                if (value === prefix || value.startsWith(`${prefix}/`)) return match;
                return `${attr}="${prefix}${value}"`;
              });
              if (next !== html) await writeFile(full, next, 'utf8');
            }
          }
        };
        await walk(root);
      },
    },
  };
}

// NVX 中文站 · Astro + TypeScript + Tailwind CSS + Bun
export default defineConfig({
  ...(site ? { site } : {}),
  ...(base ? { base } : {}),
  trailingSlash: 'always',
  integrations: [prefixBaseLinksIntegration(base)],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: false,
      langAlias: {
        'rust,no_run': 'rust',
        'python,no_run': 'python',
        'bash,no_run': 'bash',
        'sh,no_run': 'bash',
        'powershell,no_run': 'powershell',
        'console,no_run': 'console',
        'text,no_run': 'text',
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
