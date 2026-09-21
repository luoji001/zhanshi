#!/usr/bin/env node
/**
 * xlsx 解析器自检：npm run data:selftest
 *
 * 这个脚本守护的是本项目最重要的一条数据纪律 —— **宁可报错，不可静默出错**。
 * 页面是纯静态的，一旦解析器把日期读成 45678 或把稀疏单元格读错位，
 * 错误数据会安安静静地出现在对外页面上，没有任何人会发现。
 * 所以这些「必须抛错」的用例要能随时重跑，而不是只验一次就算数。
 *
 * 用例在内存里手工构造 xlsx（stored 模式，无需压缩依赖），不读写任何文件。
 */

import { crc32 } from 'node:zlib';
import { readXlsxSheet } from '../src/lib/xlsx.ts';

/* ─── 最小 ZIP 写入器（method 0 = stored） ────────────────────────────── */

function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8); // method 0
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 10); // method 0
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const cdBuf = Buffer.concat(central);
  const count = Object.keys(files).length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function build({ styles, sharedStrings, sheetData }) {
  const files = {
    'xl/workbook.xml':
      `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets>` +
      `<sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0"?><Relationships xmlns="${RELS_NS}">` +
      `<Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${sheetData}</sheetData></worksheet>`,
  };
  if (styles) files['xl/styles.xml'] = styles;
  if (sharedStrings) {
    files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst xmlns="${NS}">${sharedStrings}</sst>`;
  }
  return makeZip(files);
}

/* ─── 用例 ────────────────────────────────────────────────────────────── */

const cases = [];
const test = (label, buf, { throws, match, grid }) => cases.push({ label, buf, throws, match, grid });

const numberStyle = (numFmtId) =>
  `<?xml version="1.0"?><styleSheet xmlns="${NS}"><cellXfs count="2">` +
  `<xf numFmtId="0"/><xf numFmtId="${numFmtId}"/></cellXfs></styleSheet>`;

// 日期检测 —— 本项目最关键的静默错误场景
test(
  '内置日期格式的单元格必须报错（而非渲染成 45678）',
  build({ styles: numberStyle(14), sheetData: `<row r="1"><c r="A1" s="1"><v>45678</v></c></row>` }),
  { throws: true, match: /日期/ }
);
test(
  '自定义日期格式（formatCode 含 yyyy）必须报错',
  build({
    styles:
      `<?xml version="1.0"?><styleSheet xmlns="${NS}">` +
      `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy&quot;年&quot;m&quot;月&quot;"/></numFmts>` +
      `<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
    sheetData: `<row r="1"><c r="A1" s="1"><v>45678</v></c></row>`,
  }),
  { throws: true, match: /日期/ }
);
// 反向用例：不能把普通数字误判成日期，否则构建会被无故卡住
test(
  '普通数字格式不应被误判为日期',
  build({ styles: numberStyle(2), sheetData: `<row r="1"><c r="A1" s="1"><v>0.1</v></c></row>` }),
  { grid: g => g[0][0] === '0.1' }
);
test(
  '格式 0.00"m" 里的 m 是字面量，不应误判为日期',
  build({
    styles:
      `<?xml version="1.0"?><styleSheet xmlns="${NS}">` +
      `<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00&quot;m&quot;"/></numFmts>` +
      `<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
    sheetData: `<row r="1"><c r="A1" s="1"><v>1.5</v></c></row>`,
  }),
  { grid: g => g[0][0] === '1.5' }
);

// 不支持的类型
test('布尔单元格（t="b"）必须报错', build({ sheetData: `<row r="1"><c r="A1" t="b"><v>1</v></c></row>` }), {
  throws: true,
  match: /布尔/,
});
test(
  '错误值单元格（t="e"）必须报错',
  build({ sheetData: `<row r="1"><c r="A1" t="e"><v>#N/A</v></c></row>` }),
  { throws: true, match: /错误值/ }
);

// 定位与占位
test(
  '稀疏单元格必须按 r 属性定位，不能左移',
  build({ sheetData: `<row r="1"><c r="C1"><v>3</v></c></row>` }),
  { grid: g => g[0][0] === '' && g[0][1] === '' && g[0][2] === '3' }
);
test(
  '空行必须占位，不能让下方数据整体上移',
  build({
    sheetData:
      `<row r="1"><c r="A1"><v>1</v></c></row><row r="2"/>` +
      `<row r="3"><c r="A3"><v>3</v></c></row>`,
  }),
  { grid: g => g.length === 3 && g[2][0] === '3' }
);

// 共享字符串
test(
  '富文本共享字符串（多个 <t> run）必须拼接完整',
  build({
    sharedStrings: `<si><r><t>娃</t></r><r><t>哈哈</t></r></si>`,
    sheetData: `<row r="1"><c r="A1" t="s"><v>0</v></c></row>`,
  }),
  { grid: g => g[0][0] === '娃哈哈' }
);
test(
  '自闭合空 <si/> 必须占位，否则后续共享字符串索引错位',
  build({
    sharedStrings: `<si/><si><t>第二项</t></si>`,
    sheetData: `<row r="1"><c r="A1" t="s"><v>1</v></c></row>`,
  }),
  { grid: g => g[0][0] === '第二项' }
);
test(
  'XML 数字实体必须还原（&#28304; → 源）',
  build({
    sharedStrings: `<si><t>&#28304;&#22836;</t></si>`,
    sheetData: `<row r="1"><c r="A1" t="s"><v>0</v></c></row>`,
  }),
  { grid: g => g[0][0] === '源头' }
);

// 损坏输入
test('非 zip 输入必须报错', Buffer.from('this is not a zip'), { throws: true, match: /EOCD/ });

/* ─── 执行 ────────────────────────────────────────────────────────────── */

let failed = 0;
for (const { label, buf, throws, match, grid } of cases) {
  try {
    const result = readXlsxSheet(buf);
    if (throws) {
      console.log(`✗ ${label}\n    期望抛错，实际返回 ${JSON.stringify(result)}`);
      failed++;
    } else if (grid && !grid(result)) {
      console.log(`✗ ${label}\n    结果不符：${JSON.stringify(result)}`);
      failed++;
    } else {
      console.log(`✓ ${label}`);
    }
  } catch (err) {
    if (throws && (!match || match.test(err.message))) {
      console.log(`✓ ${label}`);
    } else if (throws) {
      console.log(`✗ ${label}\n    抛错但信息不符：${err.message}`);
      failed++;
    } else {
      console.log(`✗ ${label}\n    意外抛错：${err.message}`);
      failed++;
    }
  }
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`);
process.exit(failed > 0 ? 1 : 0);
