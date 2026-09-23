import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

/**
 * robots.txt。静态导出会把它烘成 out/robots.txt（metadata 路由在构建期求值）。
 * 全站允许抓取：本站是公开数据展示页，被搜索引擎与数据集检索收录正是目的。
 * sitemap 地址从 content.ts 的 site.url 取，不在这里另写域名。
 */
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
