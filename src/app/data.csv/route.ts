import { getDirectory } from '@/lib/suppliers';

/**
 * 静态下载：把名录导出成 CSV，**构建期生成**（产物是 out/data.csv），
 * 运行时没有任何逻辑 —— 与页面一样是纯静态资源，不经 Worker（见 wrangler.jsonc
 * 的 run_worker_first，只有 /、/data、/api/* 会触发 Worker）。
 *
 * ⚠️ 这里导出的**不是**源文件原样，而是页面上的那份数据：
 * 联系方式与页面一致（已遮挡），字段口径也一致。源文件的完整值在公开仓库里
 * （见 lib/content.ts 的 repo.sourceUrl），两者不要混为一谈。
 *
 * 多出的两列是**站点补充的元数据**，不是 Excel 里的列：
 * - source_row：该记录在源文件中的 Excel 行号（1 基，表头是第 1 行），
 *   拿到 CSV 的人可据此在源文件里定位到同一行；行号由 suppliers.ts 在解析时记录，
 *   不能按 CSV 行序另算（解析会跳过整行空行）。
 * - snapshot：数据快照日期。文件一旦被单独转发，仍能看出是哪一版数据。
 *
 * `dynamic = 'force-static'` 是 output: 'export' 下让 Route Handler 在构建期
 * 预渲染的必需开关；本文件不得读取 Request / cookies 等运行时对象。
 */
export const dynamic = 'force-static';

/** 标准 CSV 转义：含逗号、引号、换行的字段整体加引号，内部引号翻倍 */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function GET(): Response {
  const { rows, sourceRows, columns, source } = getDirectory();

  const header = ['source_row', ...columns.map(c => c.label), 'snapshot'];
  const lines: string[][] = [header];
  rows.forEach((row, i) => {
    lines.push([String(sourceRows[i]), ...columns.map(c => row[c.key]), source.snapshotDate]);
  });

  // \uFEFF 是 UTF-8 BOM：没有它，Excel 打开含中文的 CSV 会乱码。
  // 换行用 CRLF：Excel 与各类表格工具最省事的选择。
  const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // 静态导出下这行头不会被静态托管采纳（文件按扩展名走），但保留它让
      // next dev 与将来的托管方式都能正确下载；文件名也由路由路径 /data.csv 决定。
      'Content-Disposition': 'attachment; filename="zhanshi-suppliers.csv"',
    },
  });
}
