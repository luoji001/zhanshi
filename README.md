# 源头厂商名录 · next-zhanshi

把本地 Excel 里的厂商名录在**构建期**烘成纯静态页面，托管在 Cloudflare Workers 的静态资源上。

线上：<https://zhanshi.liangpengzhan.workers.dev> ｜ 页面只有两个：`/`（概览）与 `/data`（名录表格 + 数据说明）

> **本项目的定位、UI 要求，以及「改这个项目时哪些文件在管我」，分别写在
> [`AGENTS.md`](./AGENTS.md) 和 [`本项目约束文件说明.md`](./本项目约束文件说明.md)。**
> 这两份文件都明确要求「不重复收录」，所以本 README 不复述它们 ——
> 只补上它们没覆盖的**操作层**：怎么跑、怎么改数据、怎么发、密钥有哪些。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

需要 Node ≥ 20.9.0（见 `package.json` 的 `engines`）。

> 作者本机的工作区里另有一层 `sh/start-zhanshi.sh`（**在本仓库之外**，不随仓库分发），
> 它用 `:3006` 起前端并把日志写进 `console/`。单独克隆本仓库时用不到它。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发，默认 `:3000` |
| `npm run build` | 生产构建，产出 `out/`。**它同时做类型检查**（含 `worker/`），所以这也是最常用的一道自检 |
| `npm run preview` | 先 `build` 再用 `wrangler dev` 起本地 Worker，用来验证边缘行为（访问统计） |
| `npm run data:check` | 只跑数据层：解析 Excel 并打印结果。换完数据先跑这个，比起整个站点快得多 |
| `npm run data:selftest` | xlsx 解析器自检，守护「宁可报错，不可静默出错」这条数据纪律 |
| `./commit "提交信息"` | 构建校验 → commit → push → 触发 Cloudflare 构建上线（约 1–2 分钟） |

## 改数据

数据只有一个来源：**`src/excel/源头厂商.xlsx`**。换数据就是换这一个文件，然后重新构建。

- 必需 **7 列**：厂商名称 / 品类 / 供应货品 / 价格 / 联系电话 / 邮件地址 / 是否验证。
  表头接受若干别名（「源头厂商」「商品」「联系方式」等），映射表见 `src/lib/suppliers.ts`。
- **多出一列会直接构建失败**，不会静默丢弃 —— 这是有意的：宁可构建报错，也不要错数据悄悄上线。
- 整行为空的尾行会跳过；部分为空的行如实保留，空单元格在页面上显示为 `—`。
- 价格**按源文件原样展示**，不做单位换算、不做四舍五入；电话与邮箱在构建时即被遮挡
  （页面与页面源码里不存在完整值，完整值只存在于源文件本身）。
- 换完数据要同步改 `src/lib/suppliers.ts` 的 `DATA_SNAPSHOT_DATE`（页面上的「数据快照」日期）。
  忘了改时 `npm run data:check` 会拿文件 mtime 比对并告警提醒。
- **提交信息请写清改了什么**（如「数据更新：新增 2 条，修正 1 条价格」）。
  源文件的公开提交历史就是本站对外的变更记录（`/data` 的「源文件变更历史」直接链过去），
  写成 `update` 等于把这个信任信号浪费掉。

改完先 `npm run data:check` 确认能解析，再 `npm run build`。

## 部署

推送即发布：Cloudflare 通过本仓库的 Git 集成构建，所以日常只需要

```bash
./commit "更新名录数据"
```

## 访问统计

站长自用的 PV/UV，**只在边缘记录、页面不加任何脚本**，实现见 `worker/index.ts`。

查看入口：`https://<域名>/api/stats?token=<STATS_TOKEN>`

首次部署前要设置密钥（**不要写进仓库**，本地放 `.dev.vars`，已 gitignore）：

```bash
npx wrangler secret put HASH_SALT     # UV 哈希加盐，任意随机串
npx wrangler secret put STATS_TOKEN   # 访问统计页的令牌
npx wrangler secret put CF_API_TOKEN  # 只需 Analytics Engine 读权限
# CF_ACCOUNT_ID 不是密钥，放进 wrangler.jsonc 的 vars 即可
```

未设 `HASH_SALT` 时 **PV 仍然准确，UV 会失真并在日志里报警** —— 刻意不静默降级，
免得拿着一个自己不知情的假数字。另：本地 `wrangler dev` 的 Analytics Engine 写入不落盘，
数字从部署那一刻才开始累积。

## 目录结构

```
src/app/          两个页面的路由（/ 与 /data）、自定义 404 页、/data.csv 与 robots/sitemap
src/components/   页面区块组件（概览、名录表格、数据说明）
src/lib/          数据层：xlsx 解析器、名录数据、静态文案
src/excel/        数据源，唯一的 Excel
src/styles/       全局样式与设计令牌
worker/           边缘 Worker：访问统计 + /api/stats（不参与页面渲染）
scripts/          数据自检脚本
out/              构建产物，不入库
```

## 改代码前

设计约定不集中在一处，而是写在对应源码的注释里 —— 配色只走 `globals.css` 的令牌、
对比度实测值、表格表头吸顶为何必须用 `overflow: clip`、Excel 列口径等。
**改哪块读哪块的注释**，别绕过它们按记忆行事。
