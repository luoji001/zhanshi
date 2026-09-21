/**
 * **静态文案**的单一事实来源：三个区块的标题与说明文字。
 * 改文案只需改这里，不用进组件。
 *
 * ⚠️ 名录**数据**不在这里 —— 它来自 src/excel/源头厂商.xlsx，见 ./suppliers.ts。
 * 本文件必须保持**客户端可用**（将来若有 'use client' 组件引用它），
 * 因此**绝对不要**在这里 import node:fs 或任何服务端专属模块。
 */

export const overview = {
  // 标题是中性数据站标题。本站只展示 Excel 里的名录数据，不承载公司主体信息。
  title: '源头厂商名录',
  lead: '本站展示的全部记录来自本地 Excel 源文件，于构建时解析、原样呈现，不做增删与修饰。',
  // 首页只有概览，名录与数据说明都在 /data，故这两个 href 是跨页路由而非页内锚点。
  // 改这里要同步 src/app/data/page.tsx 的返回链接，两者是两页之间仅有的通路。
  actions: [
    { href: '/data', label: '查看名录数据', primary: true },
    { href: '/data#data-source', label: '数据说明', primary: false },
  ],
} as const;

export const directory = {
  title: '名录数据',
  lead: '以下为 Excel 源文件中的全部记录，可按关键词检索、按厂商筛选、点表头排序。',
  emptyText: '数据源中暂无记录。',
} as const;

export const dataSource = {
  title: '数据说明',
  lead: '本页数据的来源、口径与更新方式。',
  // 字段口径逐条对应 src/lib/suppliers.ts 的 SupplierRow，改口径要两处一起改
  fields: [
    { label: '厂商名称', desc: '数据源「源头厂商」列' },
    { label: '供应货品', desc: '数据源「商品」列' },
    { label: '价格', desc: '数据源「价格」列，按原样展示，未做换算或格式化' },
    { label: '联系电话', desc: '数据源「联系方式」列' },
    { label: '邮件地址', desc: '数据源「邮件地址」列' },
    { label: '是否验证', desc: '数据源「是否验证」列，取值与写法均按源文件原样展示' },
  ],
  notes: [
    '数据由本地 Excel 源文件在构建时解析生成，页面不连接任何后端接口。',
    '表格按源文件原样呈现，收录的记录一条不落；如需增删改，请修改源文件后重新构建。',
    '价格与电话保持源文件中的原始写法，站点不做单位换算、不做四舍五入。',
  ],
} as const;
