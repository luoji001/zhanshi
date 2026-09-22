/**
 * 展示层格式化。**本文件必须保持客户端可用** ——
 * 绝不要 import node:fs 或任何服务端专属模块（同 ./content.ts 的约束）。
 *
 * 为什么不把 formatPrice 放进 suppliers.ts：它要被两处共用 ——
 * 客户端组件 DirectoryTable 渲染价格单元格，服务端 suppliers.ts 生成「价格区间」统计。
 * 两处口径必须完全一致，而 suppliers.ts 引了 node:fs，客户端**值导入**它会拖垮构建
 * （见 suppliers.ts 顶部的警告）。所以规则单独放这里，两边都从这里取。
 */

/**
 * 美元 + 千分位 + 两位小数。
 * 这不是站点自创的格式：源文件的「价格」列本身就带 numFmtId 26（`$#,##0.00`），
 * Excel 里显示的就是 `$3,999.00`。这里只是让页面与源文件的显示口径一致。
 */
const PRICE_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * 价格展示。空串返回空串，好让调用方继续渲染「—」占位。
 * 解析不出有限数的原值**原样返回**——宁可显示得难看，也不要显示成 `$NaN`。
 */
export function formatPrice(value: string): string {
  const raw = value.trim();
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return `$${PRICE_FORMAT.format(n)}`;
}
