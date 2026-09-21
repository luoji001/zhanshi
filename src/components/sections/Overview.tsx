import Link from 'next/link';
import { overview } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import styles from './Overview.module.css';

/**
 * 首屏概览，也是首页的全部内容。右侧的数字全部由 getDirectory() 从 Excel 推导
 * （见 suppliers.ts 的 deriveStats），**不手写、不编造**：算不出来的指标
 * 根本不会出现在 stats 里。左侧两个按钮是进入 /data 的入口。
 */
export default function Overview() {
  const { stats, source } = getDirectory();

  return (
    <section className={styles.overview} aria-labelledby="overview-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h1 id="overview-title" className={styles.title}>
            {overview.title}
          </h1>
          <p className={styles.lead}>{overview.lead}</p>
          <div className={styles.actions}>
            {overview.actions.map(a => (
              <Link
                key={a.href}
                href={a.href}
                className={`${styles.btn} ${a.primary ? styles.primary : styles.ghost}`}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        <aside className={styles.scale} aria-label="数据概览">
          <p className={styles.scaleTitle}>数据概览</p>
          <dl className={styles.scaleList}>
            {stats.map(s => (
              <div key={s.label} className={styles.scaleItem}>
                <dt>{s.label}</dt>
                <dd>
                  <b>{s.value}</b>
                  {s.unit !== '' && <span>{s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {/* 文件更新日期取自真实文件属性；取不到就整行不显示，不写「未知」这类填充物 */}
          {source.updatedAt !== '' && (
            <p className={styles.scaleMeta}>源文件更新于 {source.updatedAt}</p>
          )}
          {/* 这里曾有一个「查看全部数据 →」链接，已删：它与左侧主按钮「查看名录数据」
              同指 /data，是重复入口。首页现在只留两个去向不同的操作
              （见 lib/content.ts 的 overview.actions），不要再加回来。 */}
        </aside>
      </div>
    </section>
  );
}
