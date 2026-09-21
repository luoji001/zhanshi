'use client';

import { useMemo, useState } from 'react';
// ⚠️ 只允许**类型**导入。本文件是客户端组件，而 suppliers.ts 引了 node:fs；
// 一旦改成值导入（例如 import { DIRECTORY_COLUMNS }），node:fs 会被拖进浏览器包，构建直接失败。
import type { DirectoryColumn, SupplierRow } from '@/lib/suppliers';
import styles from './DirectoryTable.module.css';

type SortKey = keyof SupplierRow;
type SortDir = 'asc' | 'desc';

/**
 * 全站唯一的排序比较器。
 * numeric: true 让「10.1」排在「2.1」之后——纯字典序会把 10.1 排到 2.1 前面，
 * 价格列顺序一错整张表就没法看；顺带解决中文按拼音排序。
 */
const COLLATOR = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

// 全字段清单：既用于行 key（第 30 行），也用于关键词搜索（第 60 行）。
// 必须与 suppliers.ts 的 SupplierRow 字段一一对应，漏一个则该列搜不到。
const FIELDS: SortKey[] = ['name', 'goods', 'price', 'phone', 'email', 'verified'];

interface Props {
  rows: SupplierRow[];
  columns: readonly DirectoryColumn[];
  title: string;
  emptyText: string;
}

/** 行内容拼成稳定 key；相同的行可能出现多次，用出现序号区分 */
function rowKey(row: SupplierRow, seen: Map<string, number>): string {
  const base = FIELDS.map(f => row[f]).join('\u0000');
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return `${base}#${n}`;
}

export default function DirectoryTable({ rows, columns, title, emptyText }: Props) {
  const [query, setQuery] = useState('');
  const [vendor, setVendor] = useState('');
  // sort 为 null = 保持 Excel 源文件的原始行序。默认不重排，
  // 让用户第一眼看到的就是源文件里的顺序。
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  // key 只由行内容决定，不带数组下标——否则排序/筛选后下标变化，
  // React 会把整张表当成全新节点重建，滚动位置与焦点都会丢。
  const keyedRows = useMemo(() => {
    const seen = new Map<string, number>();
    return rows.map(row => ({ row, key: rowKey(row, seen) }));
  }, [rows]);

  const vendors = useMemo(() => {
    const names = new Set(rows.map(r => r.name.trim()).filter(n => n !== ''));
    return [...names].sort((a, b) => COLLATOR.compare(a, b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = keyedRows.filter(({ row }) => {
      if (vendor !== '' && row.name.trim() !== vendor) return false;
      if (q === '') return true;
      return FIELDS.some(f => row[f].toLowerCase().includes(q));
    });
    if (sort === null) return matched;
    const sorted = [...matched].sort((a, b) => COLLATOR.compare(a.row[sort.key], b.row[sort.key]));
    return sort.dir === 'desc' ? sorted.reverse() : sorted;
  }, [keyedRows, query, vendor, sort]);

  /** 三态循环：原始顺序 → 升序 → 降序 → 回到原始顺序 */
  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      if (prev === null || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const dirty = query !== '' || vendor !== '';
  const clearAll = () => {
    setQuery('');
    setVendor('');
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label className={styles.srOnly} htmlFor="directory-search">
            按关键词检索名录
          </label>
          <input
            id="directory-search"
            type="search"
            className={styles.search}
            placeholder="搜索厂商、货品、电话或邮箱…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.filterLabel} htmlFor="directory-vendor">
            厂商
          </label>
          <select
            id="directory-vendor"
            className={styles.select}
            value={vendor}
            onChange={e => setVendor(e.target.value)}
          >
            <option value="">全部</option>
            {vendors.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {dirty && (
          <button type="button" className={styles.clear} onClick={clearAll}>
            清除筛选
          </button>
        )}
      </div>

      {/* 结果数用 aria-live 播报：搜索时读屏用户需要知道筛完还剩几条 */}
      <p className={styles.count} role="status" aria-live="polite">
        共 {rows.length} 条
        {filtered.length !== rows.length && `，当前显示 ${filtered.length} 条`}
      </p>

      <div className={`card ${styles.wrap}`}>
        {/* 窄屏下表格横向溢出，必须让该容器可键盘聚焦：
            Chrome/Firefox 会把无聚焦子元素的滚动容器自动变成焦点停靠点，Safari 不会，
            那样键盘用户将永远看不到最后一列（WCAG 2.1.1）。这两个属性不要删。 */}
        <div
          className={styles.scroll}
          tabIndex={0}
          role="group"
          aria-label={`${title}表格，窄屏可横向滚动`}
        >
          <table className={styles.table} aria-labelledby="directory-title">
            <colgroup>
              {columns.map(col => (
                <col key={col.key} className={styles[`col_${col.key}`]} />
              ))}
            </colgroup>

            <thead>
              <tr>
                {columns.map(col => {
                  const active = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={
                        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      className={col.numeric ? styles.numericHead : undefined}
                    >
                      <button
                        type="button"
                        className={styles.sortBtn}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <span
                          className={`${styles.arrow} ${active ? styles.arrowOn : ''}`}
                          aria-hidden="true"
                        >
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className={styles.empty}>
                    {emptyText}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className={styles.empty}>
                    没有匹配的记录。
                    <button type="button" className={styles.clearInline} onClick={clearAll}>
                      清除筛选
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(({ row, key }) => (
                  <tr key={key}>
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={
                          col.numeric
                            ? styles.numericCell
                            : col.key === 'email'
                              ? styles.emailCell
                              : undefined
                        }
                      >
                        <Cell row={row} col={col} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** 单元格渲染：空值统一显示「—」，电话与邮箱可点击 */
function Cell({ row, col }: { row: SupplierRow; col: DirectoryColumn }) {
  const value = row[col.key];

  if (value === '') {
    return (
      <span className={styles.blank} aria-label="无此项">
        —
      </span>
    );
  }

  if (col.key === 'phone' && /\d/.test(value)) {
    return (
      <a className={styles.link} href={`tel:${value.replace(/[^\d+]/g, '')}`}>
        {value}
      </a>
    );
  }

  if (col.key === 'email' && value.includes('@')) {
    return (
      <a className={styles.link} href={`mailto:${value}`}>
        {value}
      </a>
    );
  }

  return <>{value}</>;
}
