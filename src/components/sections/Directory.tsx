import { directory } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import SectionHead from '@/components/shared/SectionHead';
import DirectoryTable from './DirectoryTable';
import styles from './Directory.module.css';

/**
 * 名录区块（服务端外壳）。数据在这里从 Excel 解析出来，作为 props 交给客户端表格组件。
 * 拆成两个组件的原因：表格要支持搜索/排序/筛选，必须是 'use client'；
 * 而解析数据的 suppliers.ts 引了 node:fs，两者不能同处一个模块。
 *
 * 本区块是 /data 页排第一的内容，故它的标题用 level={1} 充当那一页的主标题
 * （id="directory-title" 不变，表格的 aria-labelledby 仍指得到）。
 */
export default function Directory() {
  const { rows, columns } = getDirectory();
  const colCount = columns.length;

  return (
    <section id="directory" className={styles.section} aria-labelledby="directory-title">
      <div className="section-container">
        <SectionHead
          id="directory-title"
          level={1}
          title={directory.title}
          lead={directory.lead}
        />

        <p className={styles.hint}>← 左右滑动查看全部 {colCount} 个字段</p>

        <DirectoryTable
          rows={rows}
          columns={columns}
          title={directory.title}
          emptyText={directory.emptyText}
        />
      </div>
    </section>
  );
}
