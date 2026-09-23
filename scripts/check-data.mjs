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

import { statSync } from 'node:fs';
import { getDirectory, EXCEL_PATH, DIRECTORY_COLUMNS } from '../src/lib/suppliers.ts';

let directory;
try {
  directory = getDirectory();
} catch (err) {
  console.error(`\n✗ 数据自检失败\n`);
  console.error(`  ${err.message}\n`);
  process.exit(1);
}

const { rows, stats, quality, source } = directory;

console.log(`\n源文件    ${source.file}`);
console.log(`快照日期  ${source.snapshotDate}`);
console.log(`指纹      sha256:${source.sha256.slice(0, 8)}…（页面上显示前 8 位）`);
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

// 数据体检：页面上「数据体检」那一节的同一批数字，这里先看一遍
const pct = quality.totalCells === 0 ? '—' : `${Math.round((quality.filledCells / quality.totalCells) * 100)}%`;
console.log('数据体检');
console.log(`  字段完整率  ${quality.filledCells}/${quality.totalCells}（${pct}）`);
console.log(`  重复行      ${quality.duplicateGroups} 组`);
console.log(`  价格可解析  ${quality.priceParsable}/${quality.priceTotal}`);
console.log(
  `  是否验证    ${quality.verifiedBreakdown.map(v => `${v.name || '（空）'} ${v.count}`).join(' · ')}`
);
console.log();

// 空表是合法状态（页面会显示空提示），但值得提醒一句
if (rows.length === 0) {
  console.log(`提示：${EXCEL_PATH} 里只有表头、没有数据行，页面上会显示空状态。`);
}

/* 「换过数据却忘了同步改 DATA_SNAPSHOT_DATE」的兜底提醒。
   mtime 是本地唯一能拿到的线索，它不可靠（CI 上恒等于 checkout 时间），
   所以这里只提醒、不拦截；刚 clone 完就跑到这条告警也很正常，看第二行即可。 */
try {
  const m = statSync(EXCEL_PATH).mtime;
  const p = n => String(n).padStart(2, '0');
  const mtimeDate = `${m.getFullYear()}-${p(m.getMonth() + 1)}-${p(m.getDate())}`;
  if (mtimeDate > source.snapshotDate) {
    console.log(`⚠️ 源文件 mtime（${mtimeDate}）晚于快照日期（${source.snapshotDate}）。`);
    console.log(`   若确实换过数据，请同步改 src/lib/suppliers.ts 的 DATA_SNAPSHOT_DATE；`);
    console.log(`   刚克隆仓库的话（mtime = checkout 时间），忽略这条即可。\n`);
  }
} catch {
  // 取不到 mtime 就算了：它只是提醒，不是校验
}

/* 快照过期提醒：数据站最怕「看着还新、其实半年没动」。
   阈值 90 天，只提醒不拦截。CI 只跑 build、不跑本脚本，所以这条服务的是
   维护者本地的例行检查（也正因如此，这里的「今天」是可信的）。 */
const ageDays = Math.floor(
  (Date.now() - new Date(`${source.snapshotDate}T00:00:00`).getTime()) / 86400000
);
if (Number.isFinite(ageDays) && ageDays > 90) {
  console.log(`⚠️ 数据快照已 ${ageDays} 天未更新（${source.snapshotDate}）。`);
  console.log(`   确实没有新数据就忽略；否则请更新源文件并同步 DATA_SNAPSHOT_DATE。\n`);
}

console.log('✓ 数据自检通过\n');
