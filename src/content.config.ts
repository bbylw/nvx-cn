// 文档内容集合：src/content/docs 下的中文 Markdown 由本集合统一校验和渲染。
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/docs',
    // 默认 id 会把 "1.1-goals" 变成 "11-goals"，这里保留文件名里的点号。
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    group: z.enum(['use', 'dev', 'guest', 'design']),
    order: z.number(),
    source: z.string(),
  }),
});

export const collections = { docs };
