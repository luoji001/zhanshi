/**
 * /data 表格筛选状态的 URL 编解码。
 *
 * **本文件必须保持客户端可用** —— 绝不要 import node:fs 或任何服务端专属模块
 * （同 ./content.ts 与 ./format.ts 的约束）。首页（服务端组件）也引它来拼品类链接。
 *
 * 为什么把筛选状态放进 URL：这个站的用法之一是「筛出某一批厂商，把链接发给别人」。
 * 状态只活在组件里时，刷新页面、把链接发给同事、从 /data 跳到 /data#data-source
 * 再退回来，筛选都会丢 —— 78 条记录里重新筛一遍是实打实的返工。
 *
 * ⚠️ 参数名只在这里写一遍。要拼一个带筛选的 /data 链接，用 categoryHref()，
 * 别在别处手写 `?category=`。
 *
 * ⚠️ 写入端（DirectoryTable）是**防抖**的，原因写在那里：Safari 对
 * history.replaceState 有调用频率限制，每敲一个字写一次会撞上去。
 */

export const TABLE_PARAM = {
  query: 'q',
  vendor: 'vendor',
  category: 'category',
  sort: 'sort',
  dir: 'dir',
} as const;

/** 从 URL 读出来的原始状态。除了 dir，其余都不做校验 —— 校验需要知道表格有哪些列，
 *  那是 DirectoryTable 的 props，放在那边做（见它的 restore 效果）。 */
export interface TableQueryState {
  query: string;
  vendor: string;
  category: string;
  sort: string;
  dir: string;
}

/** 空串一律表示「这一项没设」，与组件的状态表示一致 */
export function readTableQuery(search: string): TableQueryState {
  const p = new URLSearchParams(search);
  return {
    query: p.get(TABLE_PARAM.query) ?? '',
    vendor: p.get(TABLE_PARAM.vendor) ?? '',
    category: p.get(TABLE_PARAM.category) ?? '',
    sort: p.get(TABLE_PARAM.sort) ?? '',
    dir: p.get(TABLE_PARAM.dir) ?? '',
  };
}

/**
 * 拼查询串（含前导 `?`；全部为空时返回空串）。
 * **空值不写进 URL**：`?q=&vendor=&category=` 这种噪声会让发出去的链接看着像坏的，
 * 也会让「有没有筛选」这件事没法靠 URL 一眼判断。
 */
export function writeTableQuery(state: TableQueryState): string {
  const p = new URLSearchParams();
  if (state.query !== '') p.set(TABLE_PARAM.query, state.query);
  if (state.vendor !== '') p.set(TABLE_PARAM.vendor, state.vendor);
  if (state.category !== '') p.set(TABLE_PARAM.category, state.category);
  if (state.sort !== '') p.set(TABLE_PARAM.sort, state.sort);
  if (state.dir !== '') p.set(TABLE_PARAM.dir, state.dir);
  const qs = p.toString();
  return qs === '' ? '' : `?${qs}`;
}

/**
 * 进 /data 并只看某个品类的链接。
 *
 * 取值**原样来自数据源**（品类列里怎么写的就怎么传），这里不做任何归并或转义猜测 ——
 * URLSearchParams 会负责百分号编码。首页那条品类标签带用的就是它。
 */
export function categoryHref(category: string): string {
  return `/data${writeTableQuery({
    query: '',
    vendor: '',
    category,
    sort: '',
    dir: '',
  })}`;
}
