/**
 * 名录数据层：把 src/excel/源头厂商.xlsx 解析成页面能直接渲染的结构。
 *
 * ⚠️ **本文件只能在服务端使用**（它 import 了 node:fs）。
 * 绝不要被 'use client' 组件**值导入** —— `DirectoryTable.tsx` 是客户端组件，
 * 它对本文件只允许 `import type { SupplierRow }`，类型在编译期被擦除；
 * 一旦改成值导入（例如 `import { DIRECTORY_COLUMNS }`），node:fs 会被拖进
 * 浏览器包、构建直接失败。
 *
 * 设计原则与 xlsx.ts 一致：**结构不符一律抛错**，不猜、不跳过。
 * 列口径是硬约定：固定 7 列（厂商名称 / 品类 / 供应货品 / 价格 / 联系电话 / 邮件地址 / 是否验证），
 * Excel 里多出的列宁可报错也不静默丢弃。
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// 带扩展名 import：Node 的 ESM 解析器不做扩展名补全，scripts/check-data.mjs 要能
// 直接 import 本文件就必须写全（需 tsconfig 的 allowImportingTsExtensions，已开）。
import { readXlsxSheet } from './xlsx.ts';

/** 数据源。相对仓库内本项目根目录；换数据就是换这一个文件 */
export const EXCEL_PATH = 'src/excel/源头厂商.xlsx';

/**
 * 名录表格的一行。字段顺序与固定 7 列一一对应，**顺序不可改**。
 * 全部为字符串：价格**保持 Excel 里的原样**，不做数值化或格式化——
 * 任何再加工都等于替数据源编造内容。
 *
 * ⚠️ **两个例外：电话与邮箱在离开本层之前已被遮挡**（见 maskPhone / maskEmail）。
 * 它们不是源文件里的原值，这是唯一一处「站点改动了数据源内容」的地方，是有意为之。
 */
export interface SupplierRow {
  /** 厂商名称（Excel：源头厂商） */
  name: string;
  /**
   * 品类（Excel：品类）。归类**取自数据源**，站点不按商品名反推、不维护映射表——
   * 数据源里怎么归类就怎么展示。
   */
  category: string;
  /** 供应货品（Excel：商品） */
  goods: string;
  /** 价格（Excel：价格） */
  price: string;
  /** 联系电话（Excel：联系方式）。**已遮挡**：前 3 后 3，中间换成 * —— 见 maskPhone */
  phone: string;
  /** 邮件地址（Excel：邮件地址）。**已遮挡**：@ 前面的本地部分只留前 3 位 —— 见 maskEmail */
  email: string;
  /**
   * 是否验证（Excel：是否验证），原样展示。
   * 取值口径由数据源自己定（「是/否」「已验证」…皆可），站点**不解释、不判定**，
   * 因此也**不据此派生任何统计数字**——详见 deriveStats。
   */
  verified: string;
}

/**
 * 表格列定义：标签与字段绑在一处，顺序与 SupplierRow 六个字段一致，**顺序不可改**。
 * `numeric` 只用于右对齐，数值语义不参与排序——排序统一走 Intl.Collator（见 DirectoryTable）。
 */
export interface DirectoryColumn {
  key: keyof SupplierRow;
  label: string;
  numeric?: boolean;
}

export const DIRECTORY_COLUMNS: readonly DirectoryColumn[] = [
  { key: 'name', label: '厂商名称' },
  // 紧挨厂商名称：先看谁供货、再看归到哪个品类，比放到商品后面顺
  { key: 'category', label: '品类' },
  { key: 'goods', label: '供应货品' },
  { key: 'price', label: '价格', numeric: true },
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '邮件地址' },
  // 追加在末位，与 Excel 的列顺序一致（源文件里它就在「邮件地址」右边）
  { key: 'verified', label: '是否验证' },
];

/** 表头别名 → 字段。按名字映射而不是按列位置，Excel 调整列顺序也不会错位 */
const FIELD_BY_HEADER: Readonly<Record<string, keyof SupplierRow>> = {
  源头厂商: 'name',
  厂商名称: 'name',
  厂商: 'name',
  品类: 'category',
  分类: 'category',
  类别: 'category',
  类目: 'category',
  商品: 'goods',
  供应货品: 'goods',
  货品: 'goods',
  价格: 'price',
  联系电话: 'phone',
  联系方式: 'phone',
  电话: 'phone',
  邮件地址: 'email',
  邮箱: 'email',
  邮件: 'email',
  是否验证: 'verified',
  验证: 'verified',
};

export interface DirectoryStat {
  label: string;
  value: string;
  unit: string;
}

export interface Directory {
  rows: SupplierRow[];
  columns: readonly DirectoryColumn[];
  /** 由 rows 推导，算不出来的指标不会出现——**绝不编造数字** */
  stats: DirectoryStat[];
  source: {
    /** 展示用的相对路径 */
    file: string;
    /** 文件最后修改日期 YYYY-MM-DD，取自真实文件属性 */
    updatedAt: string;
  };
}

const FIELD_ORDER: (keyof SupplierRow)[] = [
  'name',
  'category',
  'goods',
  'price',
  'phone',
  'email',
  'verified',
];

/** 字段中文名，用于报错信息 */
const FIELD_LABEL: Record<keyof SupplierRow, string> = {
  name: '厂商名称',
  category: '品类',
  goods: '供应货品',
  price: '价格',
  phone: '联系电话',
  email: '邮件地址',
  verified: '是否验证',
};

/** 该字段是否已有内容（空串视为空） */
export function isFilled(v: string): boolean {
  return v.trim() !== '';
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ─── 联系方式遮挡 ────────────────────────────────────────────────────── */

/**
 * ⚠️ 遮挡必须发生在这里（数据层），**不能**挪到 DirectoryTable 去。
 * DirectoryTable 是 'use client' 组件，它拿到的 rows 会被序列化进静态产物 ——
 * 在组件里遮，原始值照样躺在 out/ 的页面源码里，等于没遮。
 * 只有在本层遮完再往外传，真值才进不了构建产物。
 */
const MASK = '*';

/**
 * 保留首尾各若干位，中间整段换成 *。
 * 长度不够（≤ head + tail）时**全部遮掉**：`ab@x.com` 只留前 3 位就等于没留，
 * 这种短值遮一半比不遮更危险，因为看着像遮过了。
 */
function maskBetween(value: string, head: number, tail: number): string {
  if (value.length <= head + tail) return MASK.repeat(value.length);
  return (
    value.slice(0, head) + MASK.repeat(value.length - head - tail) + value.slice(-tail)
  );
}

/** 电话：前 3 后 3，中间遮住。13800138000 → 138*****000 */
export function maskPhone(value: string): string {
  return maskBetween(value, 3, 3);
}

/**
 * 邮箱：只遮 @ 前面的本地部分，**域名整个保留** —— 域名不是敏感信息，
 * 留着才看得出是哪家邮箱服务，遮了对隐私没有任何帮助。
 * huadong@example.com → hua****@example.com
 */
export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  // 不成形的邮箱（没有 @ 或 @ 在开头）退回通用规则，不猜它哪段是域名
  if (at <= 0) return maskBetween(value, 3, 3);
  const local = value.slice(0, at);
  // 本地部分不足 4 位就整段遮掉：只留前 3 位等于把整个本地部分都暴露了
  const head = local.length > 3 ? 3 : 0;
  return local.slice(0, head) + MASK.repeat(local.length - head) + value.slice(at);
}

/** 解析表头行，返回「列号 → 字段」的映射；遇到任何无法对应的情况直接抛错 */
function mapHeader(header: string[]): Map<number, keyof SupplierRow> {
  const mapping = new Map<number, keyof SupplierRow>();
  const unknown: string[] = [];

  header.forEach((raw, col) => {
    const title = raw.trim();
    // 空表头列是排版留白（本表 A 列就是空的），直接忽略，不算错误
    if (title === '') return;
    const field = FIELD_BY_HEADER[title];
    if (field === undefined) unknown.push(title);
    else mapping.set(col, field);
  });

  if (unknown.length > 0) {
    throw new Error(
      `${EXCEL_PATH} 的表头里有本站不认识的列：${unknown.map(t => `「${t}」`).join('、')}。\n` +
        `本站名录固定 ${FIELD_ORDER.length} 列（${FIELD_ORDER.map(f => FIELD_LABEL[f]).join(' / ')}），` +
        `多出的列宁可报错也不静默丢弃——如果确实要展示这一列，` +
        `请先扩展 SupplierRow 与 DIRECTORY_COLUMNS（同时要改 lib/content.ts 的字段口径文案）。`
    );
  }

  const missing = FIELD_ORDER.filter(f => ![...mapping.values()].includes(f));
  if (missing.length > 0) {
    throw new Error(
      `${EXCEL_PATH} 缺少必需的列：${missing.map(f => `「${FIELD_LABEL[f]}」`).join('、')}。\n` +
        `表头行必须包含全部 ${FIELD_ORDER.length} 列：${FIELD_ORDER.map(f => FIELD_LABEL[f]).join(' / ')}。`
    );
  }

  return mapping;
}

/** 价格区间：仅当所有非空价格都能解析为有限数字时才成立，否则返回 null（不显示这一项） */
function priceRange(rows: SupplierRow[]): { min: number; max: number } | null {
  const values: number[] = [];
  for (const row of rows) {
    if (!isFilled(row.price)) continue;
    const n = Number(row.price.trim());
    if (!Number.isFinite(n)) return null;
    values.push(n);
  }
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * 派生统计。**只输出确实算得出来的指标**：
 * 数据为空时连「收录记录」都会是 0，此时调用方应展示空状态而不是一排 0。
 *
 * 「是否验证」一列**有意不派生任何统计**：它的取值口径由数据源自定，
 * 站点要数「已验证几条」就得先替数据源定义「什么算已验证」，那是编造。
 */
function deriveStats(rows: SupplierRow[]): DirectoryStat[] {
  const stats: DirectoryStat[] = [
    { label: '收录记录', value: String(rows.length), unit: '条' },
  ];

  const vendors = new Set(rows.map(r => r.name.trim()).filter(isFilled));
  if (vendors.size > 0) {
    stats.push({ label: '厂商', value: String(vendors.size), unit: '家' });
  }

  // 与「厂商」「商品」同源：数的是数据源里**出现过的不同取值**，不替数据源做归类合并。
  // 数据源把同一批货拆成两个品类名（或反过来），这里如实数成两个（或一个）。
  const categories = new Set(rows.map(r => r.category.trim()).filter(isFilled));
  if (categories.size > 0) {
    stats.push({ label: '品类', value: String(categories.size), unit: '个' });
  }

  const goods = new Set(rows.map(r => r.goods.trim()).filter(isFilled));
  if (goods.size > 0) {
    stats.push({ label: '商品', value: String(goods.size), unit: '类' });
  }

  const range = priceRange(rows);
  if (range) {
    stats.push({
      label: '价格区间',
      value: range.min === range.max ? String(range.min) : `${range.min} ~ ${range.max}`,
      unit: '',
    });
  }

  const withContact = rows.filter(r => isFilled(r.phone) || isFilled(r.email)).length;
  if (withContact > 0) {
    stats.push({ label: '含联系方式', value: String(withContact), unit: '条' });
  }

  return stats;
}

/**
 * 读取并解析名录数据。每次调用都会重读文件：开发模式下改完 Excel 刷新页面即生效，
 * 构建模式下在渲染期读取一次并烘进静态产物。
 */
export function getDirectory(): Directory {
  const absolute = join(process.cwd(), EXCEL_PATH);

  let buf: Buffer;
  try {
    buf = readFileSync(absolute);
  } catch {
    throw new Error(`读不到数据文件 ${EXCEL_PATH}（期望路径：${absolute}）。`);
  }

  const grid = readXlsxSheet(buf);
  if (grid.length === 0) {
    throw new Error(`${EXCEL_PATH} 是空表：第 1 行必须是表头。`);
  }

  const header = grid[0];
  const mapping = mapHeader(header);

  const rows: SupplierRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const row = {} as SupplierRow;
    for (const field of FIELD_ORDER) {
      row[field] = '';
    }
    mapping.forEach((field, col) => {
      row[field] = (cells[col] ?? '').trim();
    });
    // 整行为空（Excel 常见的尾部空行）不算数据，跳过；部分为空则如实保留
    if (FIELD_ORDER.every(f => row[f] === '')) continue;
    // 空值遮完仍是空串，故上面那条空行判定不受影响
    row.phone = maskPhone(row.phone);
    row.email = maskEmail(row.email);
    rows.push(row);
  }

  let updatedAt: string;
  try {
    updatedAt = formatDate(statSync(absolute).mtime);
  } catch {
    updatedAt = '';
  }

  return {
    rows,
    columns: DIRECTORY_COLUMNS,
    stats: deriveStats(rows),
    source: { file: EXCEL_PATH, updatedAt },
  };
}
