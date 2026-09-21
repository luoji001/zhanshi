import styles from './SectionHead.module.css';

interface SectionHeadProps {
  /** 供外层 <section aria-labelledby> 引用 */
  id?: string;
  title: string;
  lead?: string;
  /**
   * 标题层级，默认 2。
   * 当这个区块的标题**就是所在页面的主标题**时传 1 —— 例如 /data 上排第一的
   * 「名录数据」：那一页除了它没有别的 h1，若仍渲染成 h2，页面就没有主标题了。
   * 视觉样式由全局 .section-heading 决定，与层级无关，改层级不会改变外观。
   */
  level?: 1 | 2;
}

export default function SectionHead({ id, title, lead, level = 2 }: SectionHeadProps) {
  const Tag: React.ElementType = level === 1 ? 'h1' : 'h2';

  return (
    <div className={styles.head}>
      <Tag id={id} className="section-heading">
        {title}
      </Tag>
      {lead && <p className={styles.lead}>{lead}</p>}
    </div>
  );
}
