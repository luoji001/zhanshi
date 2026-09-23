import type { Metadata } from 'next';
import { dataSource, repo, site } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import Directory from '@/components/sections/Directory';
import DataSource from '@/components/sections/DataSource';
import BackToTop from '@/components/shared/BackToTop';

// description 与首页 layout.tsx 那条**刻意写得不一样**：两页摘要重复是 SEO 减分项。
// 这条只讲这一页有什么（完整表格 + 能检索排序 + 附口径说明），不复述首页的定位。
export const metadata: Metadata = {
  title: '名录数据与数据说明',
  description:
    '完整的厂商名录表格，可按关键词检索、按厂商与品类筛选、点表头排序，并附字段口径与数据来源说明。',
};

/**
 * 数据页 = 名录表格（主角）+ 数据说明。首页只留概览，两块数据内容都搬到了这里。
 *
 * ⚠️ 2026-09-22 删掉了页首那颗「← 返回概览」胶囊与它那条蓝色带
 * （原 app/data/page.module.css，已随之下线）。
 * 它当初存在的唯一理由写在旧注释里：「全站没有导航栏，这里与首页的按钮是两页之间
 * 仅有的通路」。现在根 layout 有了常驻顶栏（src/components/shared/SiteHeader.tsx），
 * 顶栏那条「概览」就是回去的路，且**滚动到哪儿都在** —— 胶囊版本滚到底部就看不见了，
 * 这一点旧注释自己也承认。留着它只会与顶栏重复，还让 /data 看起来像个文档页。
 *
 * 蓝色带没有消失：它原本由这里的 .backBar 起头、与 Directory 区块接成一条，
 * 现在整条带子从 Directory 自己开始（见 Directory.module.css 的 .section）。
 */
export default function DataPage() {
  const { columns, source } = getDirectory();

  /**
   * schema.org Dataset 结构化数据（构建期写死的静态对象，不含任何用户输入）。
   * 目的：让搜索引擎与数据集检索工具把这一页识别成**数据集**而不是普通网页，
   * 从而把它当可引用的数据来源收录。字段只写站上真实成立的：
   * license 是 canonical 的英文许可地址（不是中文 deed），distribution 指向 /data.csv。
   * ⚠️ 别在这里补 temporalCoverage / spatialCoverage 之类的字段 —— 采集范围与时间
   * 范围尚未确定（Phase B 随「数据方法」一起补），编一个出来就是造假。
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: site.name,
    description:
      '源头厂商的供货记录数据集：厂商名称、品类、供应货品、价格、联系电话、邮件地址与源文件的验证标注。联系方式已遮挡，完整源文件公开可查。',
    url: `${site.url}/data`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: { '@type': 'Organization', name: dataSource.citation.attribution, url: repo.url },
    dateModified: source.snapshotDate,
    isAccessibleForFree: true,
    variableMeasured: columns.map(c => c.label),
    distribution: [
      {
        '@type': 'DataDownload',
        contentUrl: `${site.url}/data.csv`,
        encodingFormat: 'text/csv',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Directory />
      <DataSource />
      {/* 只挂在这一页：这一页近 5000px 高，且筛选控件全在最上面（原因见该组件） */}
      <BackToTop />
    </>
  );
}
