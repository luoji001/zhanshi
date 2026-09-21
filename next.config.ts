import type { NextConfig } from 'next';

/**
 * 纯静态导出。
 *
 * 本站全站预渲染（`next build` 输出里 / 与 /data 均为 ○ Static），没有任何动态
 * 渲染、表单或服务端逻辑，因此直接导出成静态文件即可：
 * `next build` 产出 out/，交给 Cloudflare Workers Static Assets 托管。
 *
 * 这样做的关键收益是**绕开框架适配层** —— 不需要 @opennextjs/cloudflare 之类的
 * 适配器，Cloudflare 那边只看到一个普通静态目录。
 *
 * ⚠️ 关于「以后要加动态能力」：**不一定需要去掉这个开关**。访问统计（worker/index.ts）
 * 就是反例 —— 它是一段独立的边缘 Worker，直接跑在静态资源前面（见 wrangler.jsonc 的
 * run_worker_first），既没动 output: 'export'，也没进 Next 的运行时。
 * 只有当真需要 **Next 自己**做服务端渲染 / 路由 / 表单时，才要拿掉这个开关换适配器方案。
 *
 * 注：本站未使用 next/image，所以不需要配 images.unoptimized。
 * `next dev` 的开发流程不受本项影响。
 */
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
