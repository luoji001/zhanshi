import Link from 'next/link';
import { site } from '@/lib/content';
import styles from './SiteHeader.module.css';

/**
 * 顶栏。挂在根 layout 上，两页（以及 404）共用。
 *
 * ⚠️ 它是 2026-09-22 加上来的，**推翻了此前「全站没有导航栏」那条约定** ——
 * 那条约定写在 data/page.tsx 与 not-found.tsx 的注释里，原话是「两页之间只有
 * 首页的两个按钮与 /data 的返回链接」。原因是那两页单看都成立，合起来看却不像
 * 一个站：任何人从搜索引擎直接落到 /data，页面上找不到「这是哪个站」的任何线索。
 * 加了顶栏之后，/data 顶部那颗「← 返回概览」胶囊就删了（它存在的唯一理由就是
 * 没有导航栏），两页之间的通路改为：顶栏（常驻）+ 页脚 + 首页按钮。
 *
 * **刻意不吸顶**：/data 的表格表头是 `position: sticky; top: 0`
 * （见 DirectoryTable.module.css），顶栏要是也吸顶，表头滚动后会滑到顶栏底下被盖住。
 * 要两者共存就得把表头的 top 改成 --header-h，而窄屏下工具条换行会让顶栏变高，
 * 那个值跟着变，不划算。
 *
 * **刻意不做「当前页高亮」**：那要 usePathname，是个客户端 hook，会把这段本可以
 * 纯静态的东西拖进客户端包。页面的 h1 就在顶栏正下方，当前在哪一页不必由顶栏再说一遍。
 */
export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          {/* 与 favicon（src/app/icon.svg）同一个「珞」字轮廓，改一处要改两处。
              填色走 CSS 里的令牌而不是 SVG 属性：属性里写不了 var()。 */}
          <svg
            className={styles.mark}
            viewBox="0 0 64 64"
            width="26"
            height="26"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="64" height="64" rx="14" />
            <path
              transform="translate(14.650 44.962) scale(0.033755 -0.033755)"
              d="M421 23C421 -22 420 -52 416 -82H527V-31H779V-81H893C889 -53 888 -19 888 27V241C888 259 888 266 888 280C903 274 912 271 934 263C952 311 960 326 988 361C873 397 812 426 735 482C780 527 825 587 878 675C891 695 891 695 897 705L836 770C815 766 794 765 749 765H596C601 777 604 783 607 790C618 818 618 818 624 831L511 850C505 821 498 801 483 770C444 688 401 631 330 566C362 539 378 522 401 488C447 535 463 552 489 586C530 531 542 516 581 479C501 421 439 392 315 355C336 328 350 304 369 258C397 269 407 272 420 278C421 264 421 257 421 240ZM488 307C555 339 592 362 657 413C709 372 761 339 828 307C823 307 823 307 812 307H495ZM753 664C717 607 698 584 658 544C600 597 589 610 550 664ZM527 209H779V69H527ZM265 690H304C334 690 349 689 373 686V792C347 788 321 786 285 786H141C105 786 80 788 53 792V685C78 689 90 690 125 690H162V493H129C101 493 89 494 68 498V395C90 399 104 400 130 400H162V164C118 148 72 135 40 129L65 19C83 29 91 32 154 55C233 84 297 111 374 149L372 249C322 225 318 223 265 201V400H293C315 400 332 399 353 396V497C334 494 322 493 297 493H265Z"
            />
          </svg>
          <span className={styles.name}>{site.name}</span>
        </Link>

        <nav className={styles.nav} aria-label="主导航">
          {site.nav.map(item => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
