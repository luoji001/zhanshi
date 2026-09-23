import { dataSource, repo, site } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import SectionHead from '@/components/shared/SectionHead';
import styles from './DataSource.module.css';

/**
 * 本页构建日期。Server Component 在**构建期**渲染，所以模块级的 new Date() 就是
 * 构建时刻。它回答的是「这一页多新」，与「数据多新」（快照日期）是两件事，都要给。
 *
 * ⚠️ 不要改成「X 天前」这类相对时间：静态页会永远停在构建那一刻，放久了就是假话。
 * 过期提醒属于维护者，放在 scripts/check-data.mjs，不放页面。
 */
const BUILD_DATE = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

/**
 * 数据说明。这里的每个数字都来自解析结果或构建期计算，**没有一项是手写的**；
 * 没有可展示的值就整行不渲染，不写「未知 / 待补充」这类填充文字。
 *
 * 2026-09-23 增补「数据体检 / 许可与下载」两块：前者是构建期体检结果（完整率、
 * 重复行、价格可解析、验证列分布），后者是 CC BY 4.0 许可、CSV 下载与引用格式。
 * 两者都直接服务于「访客能自己验证」，而不是自我宣称。
 */
export default function DataSource() {
  const { rows, source, quality } = getDirectory();

  // 完整率只在有单元格时才展示；sha 只展示前 8 位（全串在数据层，展示太长没意义）
  const filledPct =
    quality.totalCells > 0 ? Math.round((quality.filledCells / quality.totalCells) * 100) : null;
  const sha = source.sha256.slice(0, 8);

  return (
    <section id="data-source" className="section-container" aria-labelledby="data-source-title">
      <SectionHead id="data-source-title" title={dataSource.title} lead={dataSource.lead} />

      <div className={`card ${styles.panel}`}>
        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>数据来源</dt>
            <dd className={styles.metaValue}>
              {/* 源文件在公开仓库里，点开即可逐条核对 —— 这是本站最硬的可验证性信号，
                  比任何自我声明都有力。链接地址统一放 content.ts 的 repo，别在此硬编码 */}
              <a
                className={styles.code}
                href={repo.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.file}
              </a>
            </dd>
          </div>
          {source.snapshotDate !== '' && (
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>数据快照</dt>
              <dd className={styles.metaValue}>
                {source.snapshotDate}
                <span className={styles.metaNote}>源文件里这批数据自身的日期</span>
              </dd>
            </div>
          )}
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>本页构建</dt>
            <dd className={styles.metaValue}>
              {BUILD_DATE}
              <span className={styles.metaNote}>本页静态产物的构建日期</span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>源文件指纹</dt>
            <dd className={styles.metaValue}>
              <code className={styles.code}>sha256:{sha}</code>
              <span className={styles.metaNote}>
                源文件内容的 SHA-256 前 8 位，可对源文件自行算哈希核对
              </span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>收录记录</dt>
            <dd className={styles.metaValue}>{rows.length} 条</dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>{dataSource.historyLabel}</dt>
            <dd className={styles.metaValue}>
              <a
                className={styles.link}
                href={repo.commitsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                在 GitHub 查看
              </a>
              <span className={styles.metaNote}>源文件的每次变更与时间都公开可查</span>
            </dd>
          </div>
        </dl>

        <h3 className={styles.subTitle}>字段口径</h3>
        <ul className={styles.fields}>
          {dataSource.fields.map(f => (
            <li key={f.label} className={styles.fieldItem}>
              <span className={styles.fieldName}>{f.label}</span>
              <span className={styles.fieldDesc}>{f.desc}</span>
            </li>
          ))}
        </ul>

        <h3 className={styles.subTitle}>{dataSource.qualityTitle}</h3>
        <p className={styles.qualityLead}>{dataSource.qualityLead}</p>
        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>字段完整率</dt>
            <dd className={styles.metaValue}>
              {quality.filledCells} / {quality.totalCells}
              {filledPct !== null && `（${filledPct}%）`}
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>重复行</dt>
            <dd className={styles.metaValue}>
              {quality.duplicateGroups} 组
              <span className={styles.metaNote}>七个字段完全相同的记录算一组</span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>价格可解析</dt>
            <dd className={styles.metaValue}>
              {quality.priceParsable} / {quality.priceTotal}
              <span className={styles.metaNote}>有价格的记录中，能解析为数字的条数</span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>是否验证</dt>
            <dd className={styles.metaValue}>
              {quality.verifiedBreakdown
                .map(v => `${v.name === '' ? '—' : v.name} ${v.count} 条`)
                .join(' · ')}
              <span className={styles.metaNote}>
                按源文件原样取值统计；验证方与标准由数据源提供方定义，本站未独立核实
              </span>
            </dd>
          </div>
        </dl>

        <h3 className={styles.subTitle}>许可与下载</h3>
        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>{dataSource.license.label}</dt>
            <dd className={styles.metaValue}>
              <a
                className={styles.link}
                href={dataSource.license.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {dataSource.license.name}
              </a>
              <span className={styles.metaNote}>{dataSource.license.note}</span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>{dataSource.download.label}</dt>
            <dd className={styles.metaValue}>
              <a className={styles.download} href={dataSource.download.href} download>
                {dataSource.download.buttonText}
              </a>
              <span className={styles.metaNote}>{dataSource.download.note}</span>
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>{dataSource.citation.title}</dt>
            <dd className={styles.metaValue}>
              <code className={styles.citation}>
                {dataSource.citation.attribution}（数据快照 {source.snapshotDate}）. {site.url}/data
              </code>
              <span className={styles.metaNote}>{dataSource.citation.hint}</span>
            </dd>
          </div>
        </dl>

        <ul className={styles.notes}>
          {dataSource.notes.map(note => (
            <li key={note} className={styles.note}>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
