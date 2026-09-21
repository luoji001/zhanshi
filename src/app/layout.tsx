import type { Metadata } from 'next';
import '@/styles/globals.css';

/**
 * ⚠️ description 是**搜索引擎结果里显示的那行字**，比页面正文更「对外」。
 * 所以它和 content.ts 的首页文案守同一条规矩：不写「本地」「Excel 源文件解析生成」
 * 这类对访客没有指代对象的实现细节 —— 技术口径归 /data 的「数据说明」。
 * 与 data/page.tsx 的 description **不要写成同一句**：两页摘要重复是 SEO 上的减分项。
 */
export const metadata: Metadata = {
  title: '源头厂商名录',
  description:
    '收录源头厂商的供货记录，含货品、价格与联系方式。数据取自同一份源文件、原样呈现，可按关键词检索、按厂商筛选。',
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
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
