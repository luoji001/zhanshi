import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './not-found.module.css';

/**
 * 404 页面。
 *
 * 为什么必须自己写一个：不写的话 Next.js 会用它的**内置默认页**，那一页
 * ①全英文（"This page could not be found."）、②自带系统字体与纯黑纯白的内联样式、
 * ③内联了 `@media (prefers-color-scheme:dark)` —— 第三条直接违反 globals.css 里
 * 写明的「全站只有浅色主题」。深色系统下的用户访问不存在的地址会看到一片黑。
 * 本文件走根 layout，因此 globals.css 的令牌、字体与 color-scheme 都照常生效。
 *
 * 全站没有导航栏，所以这一页必须自己给出回去的路 —— 两个链接各指一个真实页面。
 */
export const metadata: Metadata = {
  title: '页面不存在',
};

export default function NotFound() {
  return (
    <section className={styles.wrap} aria-labelledby="notfound-title">
      <p className={styles.code}>404</p>
      <h1 id="notfound-title" className={styles.title}>
        页面不存在
      </h1>
      <p className={styles.lead}>你访问的地址不存在，或者这个页面已经被移走了。</p>
      <div className={styles.actions}>
        <Link href="/" className={`${styles.btn} ${styles.primary}`}>
          返回概览
        </Link>
        <Link href="/data" className={`${styles.btn} ${styles.ghost}`}>
          查看名录数据
        </Link>
      </div>
    </section>
  );
}
