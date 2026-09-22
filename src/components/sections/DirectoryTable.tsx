'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
// ⚠️ 只允许**类型**导入。本文件是客户端组件，而 suppliers.ts 引了 node:fs；
// 一旦改成值导入（例如 import { DIRECTORY_COLUMNS }），node:fs 会被拖进浏览器包，构建直接失败。
import type { DirectoryColumn, SupplierRow } from '@/lib/suppliers';
// format.ts 不引 node:fs，可以安全值导入（suppliers.ts 则只能 import type，见上）
import { formatPrice } from '@/lib/format';
import { readTableQuery, writeTableQuery } from '@/lib/tableParams';
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
const FIELDS: SortKey[] = ['name', 'category', 'goods', 'price', 'phone', 'email', 'verified'];

interface Props {
  rows: SupplierRow[];
  columns: readonly DirectoryColumn[];
  title: string;
  emptyText: string;
}

/**
 * 表格会横向溢出的视口区间。1048 = 表格 min-width 1000 + .section-container 左右各 24px，
 * 与 DirectoryTable.module.css 里 .scroll 的分档是同一个数，改一处必须改另一处。
 *
 * ⚠️ 下界 768 是 2026-09-22 加的：≤767px 的表格已改成**卡片布局**（见
 * DirectoryTable.module.css 文件末尾那一档），那一档根本不横向滚动，
 * 所以这个区间不是「≤1047」而是「768–1047」。写回 `max-width: 1047px`
 * 会让手机端多出一个「聚焦了却滚不动」的空 tab 停靠点。
 */
const H_SCROLL_QUERY = '(min-width: 768px) and (max-width: 1047px)';

/**
 * 只有确实能横向滚动时才让滚动容器可聚焦（WCAG 2.1.1：键盘用户得够得着溢出的列）。
 * 表格改为整页滚动后，宽屏下这个容器不再横向溢出，恒挂 tabIndex 会多出一个
 * 「聚焦了却什么都滚不动」的空 tab 停靠点。
 */
function useHorizontallyScrollable(): boolean {
  // 初值 false：服务端渲染时拿不到视口宽度，先按「不需要焦点」渲染，挂载后再校正。
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(H_SCROLL_QUERY);
    const sync = () => setScrollable(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return scrollable;
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
  const [category, setCategory] = useState('');
  // sort 为 null = 保持 Excel 源文件的原始行序。默认不重排，
  // 让用户第一眼看到的就是源文件里的顺序。
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  /* ─── 与 URL 同步 ─────────────────────────────────────────────────────
     读：**必须是 effect，不能是 useState 的初值**。静态导出下首帧 HTML 由构建期
     渲染，那时候没有 window；写成初值会造成水合前后 DOM 不一致。
     代价是首屏先以「无筛选」渲染一帧再跳到筛选后的样子，对静态站可以接受。

     写：**防抖 250ms**。Safari 对 history.replaceState 有频率限制
     （约 100 次 / 30 秒，超了直接抛异常），搜索框每敲一个字写一次会撞上去。
     用 replaceState 而不是 pushState：逐个字符的输入不该在浏览器历史里留下
     几十条记录，那样「后退」就废了。 */
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const s = readTableQuery(window.location.search);
    const keys = new Set<string>(columns.map(c => c.key));
    if (s.query !== '') setQuery(s.query);
    // 厂商/品类直接照单全收：值不存在时筛出 0 条，用户能看出问题并从筛选条上撤掉；
    // 但排序字段必须校验 —— 一个不存在的 key 会让整张表按 undefined 排序，静默乱序。
    if (s.vendor !== '') setVendor(s.vendor);
    if (s.category !== '') setCategory(s.category);
    if (s.sort !== '' && keys.has(s.sort) && (s.dir === 'asc' || s.dir === 'desc')) {
      setSort({ key: s.sort as SortKey, dir: s.dir });
    }
    // columns 是构建期定下的常量，挂载后不会变；restored 兜底保证只跑一次
  }, [columns]);

  useEffect(() => {
    // 还没读完 URL 就写，会把地址上原有的参数抹掉（首帧状态是空的）
    if (!restored.current) return;
    const timer = setTimeout(() => {
      const search = writeTableQuery({
        query,
        vendor,
        category,
        sort: sort?.key ?? '',
        dir: sort?.dir ?? '',
      });
      // 保留 hash：/data#data-source 这类地址不该因为动了一下筛选就掉锚点
      history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, vendor, category, sort]);

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

  // 与 vendors 同一套做法：选项就是数据里**出现过的**值，站点不维护品类清单、
  // 不把「分类/类目」这类同义写法合并（口径见 suppliers.ts 的 SupplierRow.category）
  const categories = useMemo(() => {
    const names = new Set(rows.map(r => r.category.trim()).filter(n => n !== ''));
    return [...names].sort((a, b) => COLLATOR.compare(a, b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = keyedRows.filter(({ row }) => {
      if (vendor !== '' && row.name.trim() !== vendor) return false;
      if (category !== '' && row.category.trim() !== category) return false;
      if (q === '') return true;
      return FIELDS.some(f => row[f].toLowerCase().includes(q));
    });
    if (sort === null) return matched;
    const sorted = [...matched].sort((a, b) => COLLATOR.compare(a.row[sort.key], b.row[sort.key]));
    return sort.dir === 'desc' ? sorted.reverse() : sorted;
  }, [keyedRows, query, vendor, category, sort]);

  /** 三态循环：原始顺序 → 升序 → 降序 → 回到原始顺序 */
  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      if (prev === null || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const dirty = query !== '' || vendor !== '' || category !== '';

  /* 撤掉一粒筛选之后，被点的那颗按钮就从 DOM 里消失了，**焦点会掉回 <body>** ——
     键盘用户于是丢掉位置，得从头 Tab 回工具条。所有撤筛动作统一走这个包装：
     先记一个待办，等 React 把新的 DOM 提交完（见下面那个 effect）再把焦点放到
     下一粒的移除按钮上；一粒都不剩就落到搜索框（工具条上唯一永远在的控件）。 */
  const pendingFocus = useRef(false);
  const chipsRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const clearAll = () => {
    pendingFocus.current = true;
    setQuery('');
    setVendor('');
    setCategory('');
  };

  /** 单撤一粒。与 clearAll 同意图，只是范围小 */
  const removeOne = (clear: () => void) => {
    pendingFocus.current = true;
    clear();
  };

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    // 用 styles.chipX 而不是字面量 class：生产构建里它被哈希过，写死字符串选不中
    const next = chipsRef.current?.querySelector<HTMLButtonElement>(`.${styles.chipX}`);
    (next ?? searchRef.current)?.focus();
  });

  const hScroll = useHorizontallyScrollable();

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label className={styles.srOnly} htmlFor="directory-search">
            按关键词检索名录
          </label>
          <input
            id="directory-search"
            ref={searchRef}
            type="search"
            className={styles.search}
            // 列全字段名：搜索实际覆盖 7 列（FIELDS），漏写「品类」「是否验证」
            // 会让这个框看着比它实际能做的窄，用户就不去用它
            placeholder="搜索厂商、品类、货品、电话或邮箱…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* 两个下拉：厂商与品类。品类筛选是 2026-09-22 补的 —— 此前只有厂商筛选，
            但「品类」是表里独立的一列（且数据里有 23 个取值），只能靠搜索框碰运气。
            两者各自带可见标签，「全部」不会指代不明。 */}
        <div className={`${styles.field} ${styles.fieldInline}`}>
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

        <div className={`${styles.field} ${styles.fieldInline}`}>
          <label className={styles.filterLabel} htmlFor="directory-category">
            品类
          </label>
          <select
            id="directory-category"
            className={styles.select}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">全部</option>
            {categories.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* 结果数用 aria-live 播报：搜索时读屏用户需要知道筛完还剩几条。
            放在工具条内（靠 margin-left:auto 顶到右侧），桌面端工具条因此只占一行。 */}
        <p className={styles.count} role="status" aria-live="polite">
          共 {rows.length} 条
          {filtered.length !== rows.length && `，当前显示 ${filtered.length} 条`}
        </p>
      </div>

      {/* 生效中的筛选条。原先这里只有一个「清除筛选」按钮：它只告诉你「筛过了」，
          不告诉你**筛的是什么**，也不允许只撤掉其中一条 —— 想留厂商只换品类，
          就得整组清掉重来。改成一颗条件一粒、各自能撤。
          空结果时它尤其重要：不留神选了「美的 + 生鲜果蔬」，光看表格是 0 条，
          原因得在这条上找。 */}
      {dirty && (
        <ul className={styles.chips} ref={chipsRef}>
          {vendor !== '' && (
            <Chip label="厂商" value={vendor} onRemove={() => removeOne(() => setVendor(''))} />
          )}
          {category !== '' && (
            <Chip
              label="品类"
              value={category}
              onRemove={() => removeOne(() => setCategory(''))}
            />
          )}
          {query.trim() !== '' && (
            <Chip
              label="关键词"
              value={query.trim()}
              onRemove={() => removeOne(() => setQuery(''))}
            />
          )}
          <li>
            <button type="button" className={styles.clearAll} onClick={clearAll}>
              全部清除
            </button>
          </li>
        </ul>
      )}

      <div className={`card ${styles.wrap}`}>
        {/* 窄屏下表格横向溢出，必须让该容器可键盘聚焦：
            Chrome/Firefox 会把无聚焦子元素的滚动容器自动变成焦点停靠点，Safari 不会，
            那样键盘用户将永远看不到最后一列（WCAG 2.1.1）。
            宽屏下表格已不横向溢出，此时再挂 tabIndex 只会多一个空的停靠点，故按 hScroll 条件化。
            这几个属性绑在一起增减：role/aria-label 只对可滚动的那种状态才有意义。 */}
        <div
          className={styles.scroll}
          tabIndex={hScroll ? 0 : undefined}
          role={hScroll ? 'group' : undefined}
          aria-label={hScroll ? `${title}表格，窄屏可横向滚动` : undefined}
        >
          {/* ⚠️ 这些 role 看着是冗余（<table> 本来就有表格语义），但它们不能删：
              ≤767px 那一档把 table/tr/td 改成了 display:block（见 CSS 文件末尾的
              卡片布局），而按 HTML-AAM，元素的**隐式 role 取决于它的 display** ——
              display:block 的 <table> 会被算成 generic，读屏在手机上就此丢掉
              行/列结构与表头。显式写死 role 可以压过这个推断。
              （字段名那一层由 td 的 data-label + ::before 提供，见 CSS。） */}
          <table className={styles.table} role="table" aria-labelledby="directory-title">
            <colgroup>
              {columns.map(col => (
                <col key={col.key} className={styles[`col_${col.key}`]} />
              ))}
            </colgroup>

            <thead role="rowgroup">
              <tr role="row">
                {columns.map(col => {
                  const active = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      role="columnheader"
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

            <tbody role="rowgroup">
              {rows.length === 0 ? (
                <tr role="row">
                  <td role="cell" colSpan={columns.length} className={styles.empty}>
                    {emptyText}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr role="row">
                  <td role="cell" colSpan={columns.length} className={styles.empty}>
                    没有匹配的记录。上方的筛选条可以逐条撤掉，也可以
                    <button type="button" className={styles.clearInline} onClick={clearAll}>
                      全部清除
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(({ row, key }) => (
                  <tr key={key} role="row">
                    {columns.map(col => (
                      <td
                        key={col.key}
                        /* data-label 供手机端卡片布局用：那一档表头被收成排序条，
                           每个字段得自己带名字（见 DirectoryTable.module.css 的
                           ::before）。data-col 让卡片里的跨栏规则按**字段名**选中，
                           而不是按 nth-child 的顺序 —— 加一列时前者不会静默错位。 */
                        role="cell"
                        data-col={col.key}
                        data-label={col.label}
                        className={
                          col.numeric
                            ? styles.numericCell
                            : col.key === 'email'
                              ? styles.emailCell
                              : undefined
                        }
                      >
                        <Cell row={row} col={col} query={query} />
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

/**
 * 一粒生效中的筛选条件。
 *
 * `label` 与 `value` 分开渲染（前者灰、后者深）是因为条件值可能很长
 * （「宁波家居用品供应链」9 个字），混成一句话之后不容易一眼扫出「筛的是哪一维」。
 *
 * 移除按钮的 aria-label 必须**带上值**：一屏可能同时有「厂商 美的」和「品类 美的」，
 * 只念「移除筛选」读屏用户分不清按的是哪一粒。
 */
function Chip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <li className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipValue}>{value}</span>
      <button
        type="button"
        className={styles.chipX}
        onClick={onRemove}
        aria-label={`移除筛选：${label} ${value}`}
      >
        {/* 「×」对读屏是噪音，名字已经由 aria-label 给了 */}
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

/**
 * 单元格渲染：空值统一显示「—」，价格多走一道 formatPrice。
 *
 * **电话不渲染成链接**：数据层已把它遮罩（suppliers.ts 的 maskPhone），
 * `138*****000` 剔掉非数字会得到 `tel:138000` —— 拨不通的坏链接，不如给纯文本。
 *
 * **邮箱也不拿自己去拼 mailto:**，同样因为它被遮罩了（maskEmail），
 * `hua****@qq.com` 是个不存在的收件人。改用后面挂的「邮件联系」按钮走**空收件人**的
 * `mailto:`，只负责唤起邮件客户端，收件人由用户自己填。这是遮罩的必然代价，
 * 所以 aria-label 里必须写明「收件人需自行填写」，别删。
 */
function Cell({
  row,
  col,
  query,
}: {
  row: SupplierRow;
  col: DirectoryColumn;
  query: string;
}) {
  const value = row[col.key];

  if (value === '') {
    return (
      <span className={styles.blank} aria-label="无此项">
        —
      </span>
    );
  }

  // 价格高亮的是**格式化之后**的文本（`$1,000.00`），与屏幕上看到的完全一致
  if (col.key === 'price') {
    return (
      <>
        <Highlight text={formatPrice(value)} query={query} />
      </>
    );
  }

  if (col.key === 'email') {
    return (
      <>
        <Highlight text={value} query={query} />
        <a
          className={styles.mailBtn}
          href="mailto:"
          aria-label="打开邮件客户端，收件人需自行填写"
        >
          邮件联系
        </a>
      </>
    );
  }

  return (
    <>
      <Highlight text={value} query={query} />
    </>
  );
}

/**
 * 搜索命中高亮。
 *
 * 为什么需要它：搜索覆盖 7 个字段，一行**为什么**被留下，光看表格是猜不出来的 ——
 * 搜「水」，命中的可能是「矿泉水」（货品）、「生鲜果蔬」里的「水果」没有，
 * 但「水产」是品类、「纯净水」是货品。把那几个字直接标出来，比让人自己去比对快得多。
 *
 * ⚠️ 传进来的是**屏幕上那串文本**，而筛选是在**原始值**上做的，两者在价格列上
 * 可能对不上：原值 `1000` 显示成 `$1,000.00`，搜 `1000` 会命中、却高亮不出来。
 * 那种行仍照常出现在结果里，只是这一格没有高亮。
 * **宁可少一处高亮，也不要为了高亮去改显示口径** —— 那会让「显示的」和
 * 「筛选用的」变成两个不同的值，是更糟的毛病。
 *
 * 只标第一处命中：一段文本里同一个词出现多次时全标上会花掉大半张表，
 * 而目的是「指出是哪一格命中了」，一处就够。
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q === '') return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark}>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}
