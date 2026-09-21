/**
 * 零依赖 xlsx 读取器：Buffer → 稠密字符串网格。
 *
 * 为什么不引第三方库：仓库根 AGENTS.md 有「不无谓新增依赖」的约定，而本项目的表格
 * 结构极简（单表、固定几列、纯文本/数字），一个约 200 行的读取器足够，且没有供应链风险。
 *
 * **核心原则是「宁可报错，不可静默出错」**：遇到读不懂的结构一律 throw，
 * 绝不猜、绝不跳过。理由是本站为纯静态页，解析器读错不会有任何运行时告警 ——
 * 日期读成 45678、稀疏单元格错位，都会安安静静地渲染到对外页面上，没人会发现。
 * 构建失败是吵的，错数据是哑的，宁可要前者。
 *
 * 唯一的外部依赖是 node:zlib，**不要**在这里引 fs 或任何 Next.js API，
 * 以便 scripts/check-data.mjs 能直接在 Node 里 import 本文件（见该脚本）。
 */

import { inflateRawSync } from 'node:zlib';

/* ─── XML ─────────────────────────────────────────────────────────────── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** 还原 XML 实体。xlsx 里中文表头常被写成数字实体，不解会原样显示成 &#21335; */
function unescapeXml(s: string): string {
  return s.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
    (whole, hex: string | undefined, dec: string | undefined, named: string | undefined) => {
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
      if (named !== undefined) return NAMED_ENTITIES[named];
      return whole;
    }
  );
}

/**
 * 取一段 XML 里全部 <t> 的文本并拼接。
 * 富文本字符串（<si> 里带多个 <r> run）会被拆成多个 <t>，必须合并，
 * 否则「加粗的厂商名」只会读到其中一段。
 */
function extractText(fragment: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    out += m[1] === undefined ? '' : unescapeXml(m[1]);
  }
  return out;
}

/** 从属性串里取某个属性的值 */
function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(attrs);
  return m ? m[1] : undefined;
}

/* ─── ZIP ─────────────────────────────────────────────────────────────── */

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface ZipEntry {
  /** 0 = stored，8 = deflate */
  method: number;
  compSize: number;
  localOffset: number;
}

/**
 * 只读中央目录：不信任本地头里的尺寸字段（部分写入器会把它留空并靠 data descriptor
 * 回填），统以中央目录为准，这是 ZIP 规范推荐的做法。
 */
function readZipEntries(buf: Buffer): Map<string, ZipEntry> {
  // EOCD 后可能跟最多 65535 字节的注释，故从尾部回扫而不是只看最后 22 字节
  const floor = Math.max(0, buf.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是有效的 xlsx：找不到 ZIP 结尾记录（EOCD）');

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  // ZIP64 里这两个字段是 0xffff / 0xffffffff 哨兵值，真实值存在 ZIP64 EOCD 中
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 格式的 xlsx（文件异常大）；请另存为普通 xlsx 后重试');
  }

  const entries = new Map<string, ZipEntry>();
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CD_SIG) {
      throw new Error(`xlsx 中央目录第 ${i + 1} 项损坏`);
    }
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, {
      method: buf.readUInt16LE(p + 10),
      compSize: buf.readUInt32LE(p + 20),
      localOffset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf: Buffer, entries: Map<string, ZipEntry>, name: string): string | null {
  const entry = entries.get(name);
  if (!entry) return null;

  const lp = entry.localOffset;
  if (lp + 30 > buf.length || buf.readUInt32LE(lp) !== LOCAL_SIG) {
    throw new Error(`xlsx 内部条目 ${name} 的本地头损坏`);
  }
  // 本地头的 name/extra 长度可能与中央目录不同，必须重新读本地头的
  const start = lp + 30 + buf.readUInt16LE(lp + 26) + buf.readUInt16LE(lp + 28);
  const raw = buf.subarray(start, start + entry.compSize);

  if (entry.method === 0) return raw.toString('utf8');
  if (entry.method === 8) return inflateRawSync(raw).toString('utf8');
  throw new Error(`xlsx 内部条目 ${name} 使用了不支持的压缩方式（method ${entry.method}）`);
}

/* ─── 日期格式检测 ────────────────────────────────────────────────────── */

/**
 * 内置的日期/时间 numFmtId。
 * 14–22 是各语言通用的日期时间格式；45–47 是时间；27–36 与 50–58 在 ECMA-376 里
 * 属于「依语言而定」，但在中文/日文等 locale 下同样是日期时间格式。
 * 宁可多判——把日期误当数字渲染出去，比构建报错严重得多。
 */
const BUILTIN_DATE_FMT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47,
  50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

/** 剥掉 formatCode 里的字面量与颜色/条件段，避免 `0.00"m"` 被当成日期 */
function stripFormatLiterals(code: string): string {
  return code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
}

/**
 * 解析 xl/styles.xml，返回 cellXfs 每项对应的 numFmtId。
 * <c> 上的 s="N" 就是这张表的索引。
 *
 * 这一步存在的唯一理由：日期单元格与数字单元格在 sheet xml 里长得**完全一样**
 * （都是 <c s="1"><v>45678</v></c>），不查格式表就会把 2025-01-01 静默渲染成 45678。
 */
function parseDateStyleIndexes(stylesXml: string | null): Set<number> {
  const dateStyles = new Set<number>();
  if (!stylesXml) return dateStyles;

  // 自定义格式：numFmtId >= 164 的部分由文件自己定义
  const customDateIds = new Set<number>();
  const numFmtsBlock = /<numFmts\b[^>]*>([\s\S]*?)<\/numFmts>/.exec(stylesXml);
  if (numFmtsBlock) {
    const re = /<numFmt\b([^>]*?)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(numFmtsBlock[1])) !== null) {
      const id = Number(attr(m[1], 'numFmtId'));
      const code = attr(m[1], 'formatCode');
      if (!Number.isInteger(id) || code === undefined) continue;
      // y/m/d/h/s 是日期时间的格式占位符（m 同时表示月份和分钟，两者都算日期）
      if (/[yYmMdDhHsS]/.test(stripFormatLiterals(unescapeXml(code)))) customDateIds.add(id);
    }
  }

  // 只取 <cellXfs> 里的 <xf>；<cellStyleXfs> 里也有一堆 <xf>，混进来会错位
  const cellXfsBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (cellXfsBlock) {
    const re = /<xf\b([^>]*?)(?:\/>|>)/g;
    let m: RegExpExecArray | null;
    let index = 0;
    while ((m = re.exec(cellXfsBlock[1])) !== null) {
      const id = Number(attr(m[1], 'numFmtId') ?? '0');
      if (BUILTIN_DATE_FMT_IDS.has(id) || customDateIds.has(id)) dateStyles.add(index);
      index++;
    }
  }
  return dateStyles;
}

/* ─── 主入口 ──────────────────────────────────────────────────────────── */

/** A1 → 0 基列号；支持多字母列（AA = 26） */
function columnIndex(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) throw new Error(`无法解析单元格坐标：${ref}`);
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * 读取 xlsx 的**第一张工作表**，返回稠密网格（行列均 0 基，空位补 ''）。
 *
 * 支持的单元格类型：共享字符串（t="s"）、内联字符串（t="inlineStr"）、
 * 公式缓存字符串（t="str"）、数字（无 t）。**其余类型（布尔 t="b"、
 * 错误值 t="e"、日期格式）一律抛错**，不静默降级。
 */
export function readXlsxSheet(buf: Buffer): string[][] {
  const entries = readZipEntries(buf);

  // 工作表路径不能写死 sheet1.xml：真实文件里可能是 worksheets/sheet2.xml。
  // 走 workbook.xml 的 r:id → workbook.xml.rels 的 Target 才是可靠解。
  const workbookXml = readEntry(buf, entries, 'xl/workbook.xml');
  if (!workbookXml) throw new Error('xlsx 缺少 xl/workbook.xml');

  const sheetTag = /<sheet\b([^>]*?)\/?>/.exec(workbookXml);
  if (!sheetTag) throw new Error('xlsx 里没有找到任何工作表');
  const relId = attr(sheetTag[1], 'r:id');
  const sheetName = attr(sheetTag[1], 'name') ?? '(未命名)';

  let sheetPath: string | null = null;
  if (relId) {
    const relsXml = readEntry(buf, entries, 'xl/_rels/workbook.xml.rels');
    if (relsXml) {
      const re = /<Relationship\b([^>]*?)\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(relsXml)) !== null) {
        if (attr(m[1], 'Id') !== relId) continue;
        const target = attr(m[1], 'Target');
        if (target) {
          sheetPath = target.startsWith('/')
            ? target.slice(1)
            : `xl/${target.replace(/^\.\//, '')}`;
        }
        break;
      }
    }
  }
  // 关系表缺失时退回约定路径，但只认这一种猜测，不做模糊搜索
  if (!sheetPath) sheetPath = 'xl/worksheets/sheet1.xml';

  const sheetXml = readEntry(buf, entries, sheetPath);
  if (!sheetXml) throw new Error(`xlsx 里找不到工作表「${sheetName}」的内容（${sheetPath}）`);

  // 整表没有共享字符串是合法的（全数字表），此时按空表处理而不是报错
  const sharedStrings = parseSharedStrings(readEntry(buf, entries, 'xl/sharedStrings.xml'));
  const dateStyles = parseDateStyleIndexes(readEntry(buf, entries, 'xl/styles.xml'));

  const sheetData = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(sheetXml);
  if (!sheetData) return [];

  const grid: string[][] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rowMatch: RegExpExecArray | null;
  let rowCursor = 0;

  while ((rowMatch = rowRe.exec(sheetData[1])) !== null) {
    const declaredRow = Number(attr(rowMatch[1], 'r'));
    // 空行（<row r="7"/>）在 xlsx 里是合法的，必须原样补空行占位，
    // 否则行号会整体前移，表头与数据错位
    const rowIndex = Number.isInteger(declaredRow) && declaredRow > 0 ? declaredRow - 1 : rowCursor;
    while (grid.length < rowIndex) grid.push([]);
    rowCursor = rowIndex + 1;

    const cells: string[] = [];
    const inner = rowMatch[2] ?? '';
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRe.exec(inner)) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? '';
      const ref = attr(attrs, 'r');
      const type = attr(attrs, 't') ?? 'n';
      const styleIndex = Number(attr(attrs, 's') ?? NaN);
      const rawValue = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);

      let value: string;
      if (type === 's') {
        if (!rawValue) throw new Error(`单元格 ${ref ?? '?'} 声明为共享字符串但没有值`);
        const idx = Number(rawValue[1]);
        const s = sharedStrings[idx];
        if (s === undefined) {
          throw new Error(`单元格 ${ref ?? '?'} 引用了不存在的共享字符串（索引 ${idx}）`);
        }
        value = s;
      } else if (type === 'inlineStr') {
        value = extractText(body);
      } else if (type === 'str') {
        // 公式的缓存字符串结果；公式本身不求值，用的是 Excel 上次保存时的缓存值
        value = rawValue ? unescapeXml(rawValue[1]) : '';
      } else if (type === 'n') {
        if (Number.isInteger(styleIndex) && dateStyles.has(styleIndex)) {
          throw new Error(
            `单元格 ${ref ?? '?'} 是日期格式，零依赖解析器不换算 Excel 日期序列号。` +
              `请把该列改成文本格式后重新导出，或改用 exceljs 解析`
          );
        }
        value = rawValue ? unescapeXml(rawValue[1]) : '';
      } else if (type === 'b') {
        throw new Error(`单元格 ${ref ?? '?'} 是布尔值，本站列口径不支持`);
      } else if (type === 'e') {
        throw new Error(`单元格 ${ref ?? '?'} 是公式错误值（如 #N/A），请先修正源文件`);
      } else {
        throw new Error(`单元格 ${ref ?? '?'} 的类型 "${type}" 暂不支持`);
      }

      // 用 r 属性定位而不是 push 顺序：稀疏行会省略空单元格，
      // 按顺序 push 会让「第 3 列的空值」把后面所有列整体左移。
      // **必须先补齐再 push**——反过来写会把本单元格的值也挤到前面去。
      if (ref) {
        const col = columnIndex(ref);
        while (cells.length < col) cells.push('');
      }
      cells.push(value);
    }

    grid[rowIndex] = cells;
  }

  return grid;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  // <si/> 自闭合表示空字符串，也要计数，否则后续索引全部错位
  const re = /<si\b[^>]*?\/>|<si\b[^>]*?>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1] === undefined ? '' : extractText(m[1]));
  }
  return out;
}
