import type { Metadata } from 'next';
import { site } from '@/lib/content';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import '@/styles/globals.css';

/**
 * ⚠️ description 是**搜索引擎结果里显示的那行字**，比页面正文更「对外」。
 * 所以它和 content.ts 的首页文案守同一条规矩：不写「本地」「Excel 源文件解析生成」
 * 这类对访客没有指代对象的实现细节 —— 技术口径归 /data 的「数据说明」。
 * 与 data/page.tsx 的 description **不要写成同一句**：两页摘要重复是 SEO 上的减分项。
 */
const DESCRIPTION =
  '收录源头厂商的供货记录，含货品、价格与联系方式。数据取自同一份源文件、原样呈现，可按关键词检索、按厂商筛选。';

export const metadata: Metadata = {
  // og:image 必须是**绝对地址**平台才认，所以得先告诉 Next 站点的正式地址。
  // 换域名时这里要一起改，否则分享卡片会是坏图。
  metadataBase: new URL('https://zhanshi.liangpengzhan.workers.dev'),

  // 模板只作用于子页面：/data 的「名录数据与数据说明」会渲染成
  //「名录数据与数据说明 · 源头厂商名录」。不配的话搜索结果里两条结果
  // 看起来像两个不相干的站（首页显示站名，内页却没有）。
  // 站名三个地方（含 openGraph.siteName）都取 site.name，不再各写一遍字面量。
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: DESCRIPTION,

  // 分享到微信/钉钉/Slack 时的预览卡片。此前**一个 og 标签都没有** ——
  // 链接被转发出去只有一行裸链接，对一个对外展示站来说这是实打实的缺口。
  // og:image 不用在这里写：src/app/opengraph-image.png 是 Next 的文件约定，
  // 它会自动挂上带哈希的绝对地址（依赖上面的 metadataBase）。
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: site.name,
    // 刻意不写 title / description：留空时 Next 会用页面自己的 title 与 description，
    // 于是 /data 分享出去显示的是那一页的摘要而不是首页的。
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/*
        顶栏 / 页脚挂在根 layout 上，两页与 404 共用 —— 站点外壳只写一遍，
        不然每加一页就要记得补一次（404 页尤其容易漏）。
        body 用 flex 纵向排布 + main flex:1：/404 这种内容很短的页面，
        页脚会被顶到视口底部而不是浮在半空（见 globals.css 里 body 的规则）。
      */}
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
