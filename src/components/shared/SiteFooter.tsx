import Link from 'next/link';
import { repo, site } from '@/lib/content';
import { getDirectory } from '@/lib/suppliers';
import styles from './SiteFooter.module.css';

/**
 * 页脚。与顶栏同处根 layout，两页（以及 404）共用。
 *
 * 页脚是**服务端组件**：它要的数字来自 getDirectory()（引了 node:fs），
 * 而整棵 layout 本来就是构建期渲染的，所以这里没有 DirectoryTable 那条
 * 「客户端组件不能值导入 suppliers.ts」的限制。
 *
 * ⚠️ 页脚里**只放站上真实存在的事**：站点名、两页入口、由 Excel 推导出的收录条数、
 * 数据快照日期、公开仓库（源文件与数据勘误入口）。
 * **不写公司主体、备案号、客服电话、二维码** —— 本站是纯数据展示页，不承载主体信息
 * （见 content.ts 的 overview.title 注释），编一个出来就是造假，也正是这个项目
 * 一路在防的事（算不出来的指标宁可不显示）。
 *
 * 2026-09-23 加了三样，都是「信任基建」：谁在维护（about）、
 * 数据可自行核对（sourceLink）、发现问题能告诉谁（footerLinks 里的「数据勘误」）。
 */
export default function SiteFooter() {
  const { rows, source } = getDirectory();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <p className={styles.brand}>
              {/* 与顶栏、favicon 同一个「珞」字轮廓，三处共用一份 path */}
              <svg
                className={styles.mark}
                viewBox="0 0 64 64"
                width="22"
                height="22"
                aria-hidden="true"
                focusable="false"
              >
                <rect width="64" height="64" rx="14" />
                <path
                  transform="translate(14.650 44.962) scale(0.033755 -0.033755)"
                  d="M421 23C421 -22 420 -52 416 -82H527V-31H779V-81H893C889 -53 888 -19 888 27V241C888 259 888 266 888 280C903 274 912 271 934 263C952 311 960 326 988 361C873 397 812 426 735 482C780 527 825 587 878 675C891 695 891 695 897 705L836 770C815 766 794 765 749 765H596C601 777 604 783 607 790C618 818 618 818 624 831L511 850C505 821 498 801 483 770C444 688 401 631 330 566C362 539 378 522 401 488C447 535 463 552 489 586C530 531 542 516 581 479C501 421 439 392 315 355C336 328 350 304 369 258C397 269 407 272 420 278C421 264 421 257 421 240ZM488 307C555 339 592 362 657 413C709 372 761 339 828 307C823 307 823 307 812 307H495ZM753 664C717 607 698 584 658 544C600 597 589 610 550 664ZM527 209H779V69H527ZM265 690H304C334 690 349 689 373 686V792C347 788 321 786 285 786H141C105 786 80 788 53 792V685C78 689 90 690 125 690H162V493H129C101 493 89 494 68 498V395C90 399 104 400 130 400H162V164C118 148 72 135 40 129L65 19C83 29 91 32 154 55C233 84 297 111 374 149L372 249C322 225 318 223 265 201V400H293C315 400 332 399 353 396V497C334 494 322 493 297 493H265Z"
                />
              </svg>
              {site.name}
            </p>
            <p className={styles.tagline}>{site.footer.tagline}</p>
            <p className={styles.about}>{site.footer.about}</p>
            <p className={styles.about}>{site.footer.privacy}</p>
          </div>

          <nav className={styles.links} aria-label="页脚导航">
            {/* 外链走 <a target="_blank" rel="noopener noreferrer">：next/link 是给
                站内路由用的，把 GitHub 地址交给它不会开新标签，用户就离开了本站 */}
            {site.footerLinks.map(item =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  className={styles.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <div className={styles.bottom}>
          {/* 与首页「数据概览」同源。快照日期取不到时只少那半句，不留「未知」 */}
          <p className={styles.meta}>
            收录 {rows.length} 条
            {source.snapshotDate !== '' && ` · 数据快照 ${source.snapshotDate}`}
          </p>
          {/* 遮挡声明必须带上源文件链接：光说「完整值在源文件里」而不给去处，
              等于把「可自行核对」变成一句空话 */}
          <p className={styles.meta}>
            {site.footer.masked}{' '}
            <a
              className={styles.metaLink}
              href={repo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {site.footer.sourceLink}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
