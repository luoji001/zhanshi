'use client';

import { useEffect, useState } from 'react';
import styles from './BackToTop.module.css';

/**
 * 回到顶部。**只挂在 /data**（见 app/data/page.tsx），不进根 layout：
 * 首页一屏就到底、404 也短，不需要它；挂上去只会多一个永远不出现的组件。
 *
 * 为什么这一页需要：/data 全展开近 5000px（78 行 × 约 44px + 头部 + 数据说明），
 * 从表格底部回顶要滚十几屏。表头虽然吸顶，但那只解决「现在看的是哪一列」，
 * 解决不了「怎么回去改筛选」—— 而筛选控件恰好全在页面最上面。
 *
 * ⚠️ **不用 IntersectionObserver 盯着某个元素**：这一页的高度随筛选结果剧烈变化
 * （筛到 1 条时整页只剩几百像素），盯元素就得处理「元素根本不存在」的分支。
 * 直接看滚动距离，判据稳定。
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 滚过一屏才出现。用 innerHeight 而不是写死像素：手机和桌面的「一屏」差好几倍。
    const onScroll = () => setVisible(window.scrollY > window.innerHeight);
    onScroll(); // 带锚点直达页面中部时（/data#data-source）初始就在下面，先判一次
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const toTop = () => {
    // 系统开了「减少动态效果」就直接跳。globals.css 里虽然也把 scroll-behavior
    // 改回了 auto，但那管不到 scrollTo 的 behavior 参数，这里得自己判。
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <button type="button" className={styles.btn} onClick={toTop}>
      <span className={styles.arrow} aria-hidden="true">
        ↑
      </span>
      <span className={styles.srOnly}>回到顶部</span>
    </button>
  );
}
