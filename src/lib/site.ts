// 站内链接统一经过 BASE_URL，支持部署在域名根路径或子路径。
// 注意：只处理以 / 开头的站内绝对路径；锚点、外链原样返回。
const base = import.meta.env.BASE_URL;

export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  if (base === '/') return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

// 规范化 canonical：补尾斜杠（/docs → /docs/），根路径保持 /。
export function canonicalPath(pathname: string): string {
  if (pathname.endsWith('/')) return pathname;
  const last = pathname.split('/').pop() ?? '';
  return last.includes('.') ? pathname : `${pathname}/`;
}
