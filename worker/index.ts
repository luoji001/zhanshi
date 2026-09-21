/**
 * 边缘侧的访问统计。**不参与页面渲染** —— 页面仍是 next build 产出的纯静态文件，
 * 这个 Worker 只在页面请求上记一笔，然后把请求交回静态资源。
 *
 * 为什么在边缘记、而不是在页面里埋 beacon：
 * 1. 站点产出的 HTML 一个字节都不用改，广告拦截器也拦不掉，比 beacon 准；
 * 2. 不用发 cookie，因此不需要同意弹窗（UV 走 IP+UA 加盐哈希，见 visitorHash）。
 *
 * 成本：只有 /、/data、/api/* 会触发本 Worker（见 wrangler.jsonc 的 run_worker_first），
 * _next/static/* 那些资源仍由静态资源托管免费不限量地服务。
 *
 * ⚠️ 本文件会被 `next build` 的类型检查扫到（tsconfig 的 include 覆盖全部 .ts 文件）。
 * 所以这里不引 @cloudflare/workers-types，只用 lib: dom 已有的 Request/Response/crypto，
 * Env 就地自己声明 —— 既不增依赖，也避免 DOM 与 workers-types 的类型打架。
 */

interface Env {
  /** 静态资源绑定，由 wrangler.jsonc 的 assets.binding 提供 */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Analytics Engine 绑定，由 wrangler.jsonc 的 analytics_engine_datasets 提供 */
  ANALYTICS: { writeDataPoint(point: DataPoint): void };
  /** UV 哈希的盐。secret。缺失时 PV 照记但 UV 会失真，见 record() */
  HASH_SALT?: string;
  /** /api/stats 的访问令牌。secret */
  STATS_TOKEN?: string;
  /** 读 Analytics Engine 的 API Token（只给该权限）。secret */
  CF_API_TOKEN?: string;
  /** Cloudflare 账号 ID，SQL API 的路径参数。var */
  CF_ACCOUNT_ID?: string;
}

interface DataPoint {
  indexes?: string[];
  blobs?: string[];
  doubles?: number[];
}

const DATASET = 'zhanshi_pageviews';

/** 算作「一次页面浏览」的路径。与 wrangler.jsonc 的 run_worker_first 保持一致 */
const PAGE_PATHS = new Set(['/', '/data', '/data/']);

/**
 * 粗筛爬虫 / 监控 / 预览抓取。不求全 —— 真要精确就该上 Cloudflare 的 Bot Management，
 * 这里只要挡掉最明显的那些，避免 PV 被 SEO 爬虫灌水。
 */
const BOT_RE =
  /bot|crawl|spider|slurp|preview|monitor|uptime|pingdom|curl|wget|python-requests|headless|facebookexternalhit|slackbot|telegram|whatsapp|discord/i;

/** 只记真正的页面导航，不记资源、预取与接口调用 */
function isPageView(request: Request, url: URL): boolean {
  if (request.method !== 'GET') return false;
  if (!PAGE_PATHS.has(url.pathname)) return false;
  // Sec-Fetch-Dest 是浏览器给的「这次请求要拿去干什么」。
  // document = 顶层导航。prefetch 是 empty，图片是 image，脚本是 script —— 都挡掉。
  // 老浏览器不发这个头（值为 null），此时放行，否则会漏掉真实用户。
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest !== null && dest !== 'document') return false;
  return !BOT_RE.test(request.headers.get('User-Agent') ?? '');
}

/**
 * 访客标识：IP + UA 加盐后的 SHA-256，取前 8 字节（64 位）十六进制。
 *
 * **原始 IP 不落盘**，只落这个哈希，所以不需要 cookie、也不需要同意弹窗。
 * 口径代价：同一个人换设备或换浏览器会算成两个访客；加盐保证哈希不可跨站比对。
 * 盐固定（不是每日轮换），因此同一访客跨天的哈希一致，既能算日 UV 也能算月 UV。
 */
async function visitorHash(request: Request, salt: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ua = request.headers.get('User-Agent') ?? '';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}|${ip}|${ua}`)
  );
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 记一笔访问。绝不抛错到调用方 —— 统计坏了不能连累页面 */
async function record(request: Request, env: Env, url: URL): Promise<void> {
  let visitor = '';
  if (env.HASH_SALT) {
    visitor = await visitorHash(request, env.HASH_SALT);
  } else {
    // 刻意不静默降级：PV 仍然准确，但如果这里没配盐，UV 会全部并成一个，
    // 必须让人在日志里看见，否则会拿着一个自己不知情的假 UV 数字。
    console.warn('[stats] 未配置 HASH_SALT，本次访问的 UV 将失真（PV 不受影响）');
  }

  const referer = request.headers.get('Referer') ?? '';
  let refHost = 'direct';
  if (referer !== '') {
    try {
      refHost = new URL(referer).host || 'direct';
    } catch {
      refHost = 'direct';
    }
  }

  // request.cf 是 Cloudflare 运行时附加的，DOM 的 Request 类型里没有，故断言
  const cf = (request as Request & { cf?: { country?: string } }).cf;

  env.ANALYTICS.writeDataPoint({
    // index 是采样键，取高基数的访客哈希，让采样在访客间均匀。
    // UV 就是从它算的：count(DISTINCT index1)。
    indexes: [visitor === '' ? 'no-salt' : visitor],
    blobs: [url.pathname, refHost, cf?.country ?? ''],
    doubles: [1],
  });
}

/** 定长比较，避免用 === 泄漏令牌前缀 */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** 调 Analytics Engine 的 SQL API */
async function runSql(env: Env, sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: sql,
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL API ${res.status}：${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { data?: Record<string, unknown>[] };
  return json.data ?? [];
}

/**
 * PV 一律用 sum(_sample_interval) 而不是 count()：
 * Analytics Engine 在高写入量下会自动采样，_sample_interval 是被丢弃事件的权重，
 * count() 会把采样后的行数当成真实值、系统性少算。
 */
const PV = 'sum(_sample_interval)';

/**
 * ⚠️ 方言是**实测**出来的，不是照 ClickHouse 文档写的 —— 两者不一样：
 *   `INTERVAL 7 DAY`（裸数字）→ 422 sql parser error: Expected literal string, found: 7
 *   `INTERVAL '7' DAY`（字符串）→ 通过
 * 上面这几条连同 `toStartOfDay(now())`、`toDate(timestamp)`、`sum(_sample_interval)`、
 * `count(DISTINCT index1)` 都已对真实 SQL API 跑通（2026-09-21）。改这里请先实测。
 */
const PERIODS: { label: string; where: string }[] = [
  { label: '今日', where: 'timestamp >= toStartOfDay(now())' },
  { label: '近 7 天', where: "timestamp > now() - INTERVAL '7' DAY" },
  { label: '近 30 天', where: "timestamp > now() - INTERVAL '30' DAY" },
  { label: '总计', where: '1 = 1' },
];

const esc = (v: unknown): string =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

const num = (v: unknown): number => Math.round(Number(v ?? 0));

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return `<p class="empty">暂无数据</p>`;
  }
  return `<table><thead><tr>${headers
    .map(h => `<th>${esc(h)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(r => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

async function statsPage(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') ?? '';
  if (!env.STATS_TOKEN || !timingSafeEqual(token, env.STATS_TOKEN)) {
    // 不区分「没配」与「令牌错」，避免对外暴露配置状态
    return new Response('未授权', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return new Response('服务端缺少 CF_API_TOKEN 或 CF_ACCOUNT_ID', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const overview = await Promise.all(
      PERIODS.map(async p => {
        const [row] = await runSql(
          env,
          `SELECT ${PV} AS pv, count(DISTINCT index1) AS uv FROM ${DATASET} WHERE ${p.where}`
        );
        return [p.label, num(row?.pv), num(row?.uv)] as const;
      })
    );

    const byPage = await runSql(
      env,
      `SELECT blob1 AS path, ${PV} AS pv, count(DISTINCT index1) AS uv
       FROM ${DATASET} GROUP BY path ORDER BY pv DESC`
    );

    const byDay = await runSql(
      env,
      `SELECT toDate(timestamp) AS d, ${PV} AS pv, count(DISTINCT index1) AS uv
       FROM ${DATASET} WHERE timestamp > now() - INTERVAL '7' DAY
       GROUP BY d ORDER BY d DESC`
    );

    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>访问统计</title>
<style>
  :root { color-scheme: only light; --text:#1a1d21; --muted:#5c636e; --border:#e2e5ea; --accent:#1b4b8f; }
  body { margin:0; padding:32px 20px; background:#f5f6f8; color:var(--text);
         font:15px/1.6 'Inter','Noto Sans SC',system-ui,sans-serif; }
  .wrap { max-width:760px; margin:0 auto; }
  h1 { font-size:1.3rem; margin:0 0 4px; }
  h2 { font-size:1rem; margin:28px 0 10px; }
  .lead { color:var(--muted); font-size:.86rem; margin:0 0 8px; }
  table { width:100%; border-collapse:separate; border-spacing:0; background:#fff;
          border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  th,td { padding:9px 14px; text-align:left; border-bottom:1px solid var(--border); font-size:.92rem; }
  th { background:#eef0f3; color:var(--muted); font-size:.82rem; font-weight:600; }
  tbody tr:last-child td { border-bottom:none; }
  td.n { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; color:var(--accent); }
  .empty { color:var(--muted); font-size:.9rem; }
  code { background:#eef0f3; padding:1px 6px; border-radius:4px; font-size:.85rem; }
</style></head>
<body><div class="wrap">
  <h1>访问统计</h1>
  <p class="lead">PV = 页面浏览数，UV = 去重访客数（IP+UA 加盐哈希，无 cookie）。</p>
  ${table(['期间', 'PV', 'UV'], overview.map(([l, pv, uv]) => [esc(l), String(pv), String(uv)]))}
  <h2>按页面</h2>
  ${table(['页面', 'PV', 'UV'], byPage.map(r => [esc(r.path), String(num(r.pv)), String(num(r.uv))]))}
  <h2>近 7 天</h2>
  ${table(['日期', 'PV', 'UV'], byDay.map(r => [esc(r.d), String(num(r.pv)), String(num(r.uv))]))}
</div></body></html>`;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (err) {
    // 把 SQL 侧的错误原样带出来，方便定位方言问题（此页面仅站长可见，不涉泄露）
    return new Response(`查询失败：${err instanceof Error ? err.message : String(err)}`, {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/stats') {
      return statsPage(env, url);
    }

    if (isPageView(request, url)) {
      try {
        await record(request, env, url);
      } catch (err) {
        // 统计失败绝不能影响页面本身
        console.error('[stats] 记录失败', err);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
