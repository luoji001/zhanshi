import type { Metadata } from 'next';
import Link from 'next/link';
import Directory from '@/components/sections/Directory';
import DataSource from '@/components/sections/DataSource';
import styles from './page.module.css';

// description 与首页 layout.tsx 那条**刻意写得不一样**：两页摘要重复是 SEO 减分项。
// 这条只讲这一页有什么（完整表格 + 能检索排序 + 附口径说明），不复述首页的定位。
export const metadata: Metadata = {
  title: '名录数据与数据说明',
  description:
    '完整的厂商名录表格，可按关键词检索、按厂商筛选、点表头排序，并附字段口径与数据来源说明。',
};

/**
 * 数据页 = 名录表格（主角）+ 数据说明。首页只留概览，两块数据内容都搬到了这里。
 *
 * 全站没有导航栏，两页之间只有两条通路：首页的两个按钮（见 lib/content.ts 的
 * overview.actions）与这里的返回链接。改动其中一个，记得同步另一个。
 */
export default function DataPage() {
  return (
    <>
      {/* 外层铺满全宽的蓝带（与下面 Directory 区块接成一条），内层负责 1280px 对齐 */}
      <div className={styles.backBar}>
        <div className={styles.backBarInner}>
          {/* 箭头与文字各占一个 span：箭头要单独 hover 位移，混在一段文本里推不动。
              aria-hidden 是因为「←」对读屏是噪音，链接文字「返回概览」已经说清了去处。 */}
          <Link href="/" className={styles.back}>
            <span className={styles.backArrow} aria-hidden="true">
              ←
            </span>
            <span>返回概览</span>
          </Link>
        </div>
      </div>
      <Directory />
      <DataSource />
    </>
  );
}
