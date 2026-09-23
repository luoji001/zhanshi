import type { Metadata } from 'next';
import { Inter, Noto_Sans_SC } from 'next/font/google';
import { site } from '@/lib/content';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import '@/styles/globals.css';

/**
 * 字体自托管（2026-09-23）。此前是 <link> 引 Google Fonts，两处问题：
 * 1. 它是全站唯一的第三方运行时请求，与页脚「不加载第三方脚本」的说法打架；
 * 2. 中国大陆访问 Google Fonts 不稳定，加载失败会直接掉到系统字体，版式跟着变。
 * 改用 next/font 后字体在**构建期**下载、随静态产物自托管，运行时零第三方请求。
 *
 * ⚠️ 构建机必须能访问 fonts.googleapis.com；拉了哪些文件构建后可
 * `ls out/_next/static/media` 验证（Noto Sans SC 的中文切片会有很多个）。
 * ⚠️ 字体栈只写在 globals.css 的 --font 里，引用这里的两个 CSS 变量，不要在组件里另写。
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// 中文部分由上百个 unicode-range 切片组成，逐个预加载没有意义，故 preload: false；
// subsets 仍要写：next/font 的参数校验要求给值（它只影响预加载哪些切片）
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  preload: false,
  variable: '--font-noto',
  display: 'swap',
});

/**
 * ⚠️ description 是**搜索引擎结果里显示的那行字**，比页面正文更「对外」。
 * 所以它和 content.ts 的首页文案守同一条规矩：不写「本地」「Excel 源文件解析生成」
 * 这类对访客没有指代对象的实现细节 —— 技术口径归 /data 的「数据说明」。
 * 与 data/page.tsx 的 description **不要写成同一句**：两页摘要重复是 SEO 上的减分项。
 */
const DESCRIPTION =
  '收录源头厂商的供货记录，含货品、价格与联系方式。数据取自同一份公开源文件、可逐条核对，支持关键词检索与厂商筛选，联系方式已在页面遮挡。';

export const metadata: Metadata = {
  // og:image 必须是**绝对地址**平台才认，所以得先告诉 Next 站点的正式地址。
  // ⚠️ 地址统一放 content.ts 的 site.url（robots/sitemap/JSON-LD/引用格式同源），
  // 不要在这里另写字面量 —— 换域名时漏一处，分享卡片就会是坏图。
  metadataBase: new URL(site.url),

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
    // 两个字体变量挂在 html 上（:root），globals.css 的 --font 引用它们。
    // 外链 <head> 已随字体自托管一起删掉，不要再加回任何 <link rel="stylesheet">。
    <html lang="zh-CN" className={`${inter.variable} ${notoSansSC.variable}`}>
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
