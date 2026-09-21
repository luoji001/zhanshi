import { dataSource } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import SectionHead from '@/components/shared/SectionHead';
import styles from './DataSource.module.css';

/**
 * 数据说明。这里的每个数字都来自真实文件属性或解析结果，
 * 没有可展示的值就整行不渲染，不写「未知 / 待补充」这类填充文字。
 */
export default function DataSource() {
  const { rows, source } = getDirectory();

  return (
    <section id="data-source" className="section-container" aria-labelledby="data-source-title">
      <SectionHead id="data-source-title" title={dataSource.title} lead={dataSource.lead} />

      <div className={`card ${styles.panel}`}>
        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>数据来源</dt>
            <dd className={styles.metaValue}>
              <code className={styles.code}>{source.file}</code>
            </dd>
          </div>
          {source.updatedAt !== '' && (
            <div className={styles.metaRow}>
              <dt className={styles.metaLabel}>源文件更新</dt>
              <dd className={styles.metaValue}>{source.updatedAt}</dd>
            </div>
          )}
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>收录记录</dt>
            <dd className={styles.metaValue}>{rows.length} 条</dd>
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
