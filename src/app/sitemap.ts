import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';

/**
 * sitemap.xml。静态导出会把它烘成 out/sitemap.xml。
 *
 * lastModified 用**数据快照日期**而不是构建时间：对搜索引擎而言，这一页真正的
 * 内容变化来自数据更新，不是每次重新构建。快照日期取不到就整项不写（不编一个今天）。
 *
 * ⚠️ 只列两个页面。/data.csv 是下载资源不是页面，不进 sitemap。
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const { source } = getDirectory();
  const lastModified =
    source.snapshotDate !== '' ? new Date(`${source.snapshotDate}T00:00:00Z`) : undefined;

  return [
    { url: `${site.url}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/data`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
