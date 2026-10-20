// 文档导航与元数据工具：分组、排序、路由和上游原文地址。
import type { CollectionEntry } from 'astro:content';
import { withBase } from './site';

export type DocEntry = CollectionEntry<'docs'>;
export type DocGroup = DocEntry['data']['group'];

// 全部分组：使用 → 开发 → 客户机 → 架构手册（架构手册挂在设计文档下）。
export const groupOrder: DocGroup[] = ['use', 'dev', 'guest', 'design'];

// 主目录只展示前三个分组，架构章节在“架构设计”页内部导航。
export const navGroupOrder: DocGroup[] = ['use', 'dev', 'guest'];

export const groupLabels: Record<DocGroup, string> = {
  use: '使用',
  dev: '开发',
  guest: '客户机',
  design: '架构',
};

export const groupNotes: Record<DocGroup, string> = {
  use: '安装、构建、运行与命令行',
  dev: '架构、仓库与协作流程',
  guest: 'Ubuntu 与 Azure Linux 用户态',
  design: '微虚拟机与客户机运行时',
};

// 同组内按 order 升序；跨组由 groupOrder 决定。
export function sortDocs(entries: DocEntry[]): DocEntry[] {
  return [...entries].sort((a, b) => {
    const groupDelta = groupOrder.indexOf(a.data.group) - groupOrder.indexOf(b.data.group);
    if (groupDelta !== 0) return groupDelta;
    return a.data.order - b.data.order;
  });
}

export function groupDocs(entries: DocEntry[]): Record<DocGroup, DocEntry[]> {
  const sorted = sortDocs(entries);
  const pick = (group: DocGroup) => sorted.filter((entry) => entry.data.group === group);
  return {
    use: pick('use'),
    dev: pick('dev'),
    guest: pick('guest'),
    design: pick('design'),
  };
}

export function docPath(entry: DocEntry): string {
  return `/docs/${entry.id}/`;
}

export function docHref(entry: DocEntry): string {
  return withBase(docPath(entry));
}

export function sourceHref(source: string): string {
  return `https://github.com/microsoft/nvx/blob/dev/${source}`;
}

// 页面上下篇：主文档之间互相翻页，架构章节只在架构手册内部翻页。
export function docNeighbors(entries: DocEntry[], currentId: string): {
  prev: DocEntry | null;
  next: DocEntry | null;
} {
  const sorted = sortDocs(entries);
  const current = sorted.find((entry) => entry.id === currentId);
  const inDesign = current?.data.group === 'design';
  const pool = inDesign
    ? sorted.filter((entry) => entry.data.group === 'design')
    : sorted.filter((entry) => entry.data.group !== 'design');
  const index = pool.findIndex((entry) => entry.id === currentId);
  return {
    prev: index > 0 ? pool[index - 1] : null,
    next: index >= 0 && index < pool.length - 1 ? pool[index + 1] : null,
  };
}
