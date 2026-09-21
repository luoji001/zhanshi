#!/usr/bin/env node
/**
 * 数据自检：解析 Excel 源文件并打印结果，结构不符时以非零码退出。
 *
 * 用途 —— 换数据文件后先跑这个，比启动整个站点快得多：
 *     npm run data:check
 *
 * 它直接复用站点的数据层（src/lib/suppliers.ts），所以这里通过 = 页面渲染通过，
 * 不存在「脚本能读、页面读不出」的两套口径。
 *
 * 注意：Node 原生支持 import .ts（类型擦除），但**必须写全扩展名**，
 * 这也是 suppliers.ts 里 import './xlsx.ts' 要带扩展名的原因。
 */

import { getDirectory, EXCEL_PATH, DIRECTORY_COLUMNS } from '../src/lib/suppliers.ts';

let directory;
try {
  directory = getDirectory();
} catch (err) {
  console.error(`\n✗ 数据自检失败\n`);
  console.error(`  ${err.message}\n`);
  process.exit(1);
}

const { rows, stats, source } = directory;

console.log(`\n源文件    ${source.file}`);
console.log(`更新时间  ${source.updatedAt || '(取不到)'}`);
console.log(`列口径    ${DIRECTORY_COLUMNS.map(c => c.label).join(' | ')}`);
console.log(`记录数    ${rows.length}\n`);

if (rows.length === 0) {
  console.log('（源文件中没有数据行）\n');
} else {
  // 中日韩字符在终端里占两列，按码点数补空格会整体错位
  const dispWidth = (s) =>
    [...s].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏ꥠ-꥿가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - dispWidth(s)));

  const widths = DIRECTORY_COLUMNS.map(c =>
    Math.max(...rows.map(r => dispWidth(r[c.key])), dispWidth(c.label))
  );

  console.log(DIRECTORY_COLUMNS.map((c, i) => pad(c.label, widths[i])).join('  '));
  console.log(widths.map(w => '─'.repeat(w)).join('  '));

  // 行数多时只铺前 20 行：这个脚本是给人扫一眼的，不是导出工具
  const LIMIT = 20;
  const shown = rows.length > LIMIT ? rows.slice(0, LIMIT) : rows;
  for (const row of shown) {
    console.log(DIRECTORY_COLUMNS.map((c, j) => pad(row[c.key], widths[j])).join('  '));
  }
  if (rows.length > LIMIT) console.log(`…（其余 ${rows.length - LIMIT} 行略）`);
  console.log();
}

console.log('派生统计');
stats.forEach(s => console.log(`  ${s.label}  ${s.value}${s.unit}`));
console.log();

// 空表是合法状态（页面会显示空提示），但值得提醒一句
if (rows.length === 0) {
  console.log(`提示：${EXCEL_PATH} 里只有表头、没有数据行，页面上会显示空状态。`);
}

console.log('✓ 数据自检通过\n');
