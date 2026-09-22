import Link from 'next/link';
import { overview } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import { categoryHref } from '@/lib/tableParams';
import styles from './Overview.module.css';

/**
 * 首屏概览，也是首页的全部内容。右侧的数字全部由 getDirectory() 从 Excel 推导
 * （见 suppliers.ts 的 deriveStats），**不手写、不编造**：算不出来的指标
 * 根本不会出现在 stats 里。左侧两个按钮是进入 /data 的入口。
 *
 * 底部那条品类索引带同样全部由数据推导（suppliers.ts 的 categoryBreakdown），
 * 每粒标签是一个带 category 参数的 /data 深链 —— 落地页到「我关心的那一类」
 * 因此只要一次点击（链接怎么拼见 lib/tableParams.ts）。
 */
export default function Overview() {
  const { stats, source, categoryCounts } = getDirectory();

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

        {/* 品类索引。grid-column 跨满两栏，落在标题与概览卡下方 ——
            它是「概览」的一部分（有哪些类），不是另一块内容，所以不给它单独的分区标题。 */}
        {categoryCounts.length > 0 && (
          <div className={styles.categories}>
            <p className={styles.categoriesTitle}>{overview.categoryTitle}</p>
            <ul className={styles.categoryList}>
              {categoryCounts.map(c => (
                <li key={c.name}>
                  {/* aria-label 带上条数与动作：可见文本是「饮品 4」，对读屏是个
                      没头没尾的数字。数字那个 span 因此标 aria-hidden，免得念两遍。 */}
                  <Link
                    href={categoryHref(c.name)}
                    className={styles.category}
                    aria-label={`只看${c.name}品类，共 ${c.count} 条记录`}
                  >
                    <span>{c.name}</span>
                    <span className={styles.categoryCount} aria-hidden="true">
                      {c.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
