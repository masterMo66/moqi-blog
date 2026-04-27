import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  escapeHtml,
  formatDate,
  renderMarkdown,
  readPosts,
} from "./lib/content.mjs";

const root = process.cwd();
const contentDir = path.join(root, "src/content/blog");
const stylesPath = path.join(root, "src/styles/site.css");
const distDir = path.join(root, "dist");

function pageShell({ title, description, current, body }) {
  const nav = [
    { href: "/", label: "首页", id: "home" },
    { href: "/blog/", label: "博客", id: "blog" },
    { href: "/about/", label: "关于", id: "about" },
  ];

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles/site.css" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%23111111'/%3E%3C/svg%3E" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="MOQILOG 首页">MOQILOG</a>
      <nav class="site-nav" aria-label="主导航">
        ${nav
          .map(
            (item) =>
              `<a class="nav-link${current === item.id ? " is-active" : ""}" href="${item.href}">${item.label}</a>`,
          )
          .join("")}
      </nav>
      <div class="header-tools" aria-label="页面工具">
        <span class="lang-muted">EN</span>
        <span class="divider">/</span>
        <span>ZH</span>
        <button class="theme-button" type="button" aria-label="切换深色模式">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.1A7.8 7.8 0 0 1 9.9 3a8.9 8.9 0 1 0 11.1 11.1Z" /></svg>
        </button>
      </div>
    </header>
    <main>${body}</main>
  </body>
</html>`;
}

function articleRows(posts, headingLevel = 3, withFilterData = false) {
  if (!posts.length) {
    return `<p class="empty-state">还没有同步到文章。</p>`;
  }

  return `<ol class="article-list">
    ${posts
      .map(
        (post) => `<li class="article-row"${withFilterData ? ` data-year="${new Date(post.data.date).getFullYear()}" data-category="${escapeHtml(post.data.category)}"` : ""}>
      <time class="article-date" datetime="${post.data.date}">${formatDate(post.data.date)}</time>
      <h${headingLevel} class="article-title"><a href="/blog/${encodeURIComponent(post.slug)}/">${escapeHtml(post.data.title)}</a></h${headingLevel}>
      <span class="article-category">${escapeHtml(post.data.category)}</span>
    </li>`,
      )
      .join("")}
  </ol>`;
}

function siteFooter(posts) {
  const footerPosts = posts.slice(0, 5);

  return `<footer class="site-footer page-shell">
    <div class="footer-column">
      <h2>站内页面</h2>
      <a href="/about/">关于我</a>
      <a href="/about/">摄影</a>
      <a href="/blog/">博客</a>
    </div>
    <div class="footer-column">
      <h2>产品</h2>
      <a href="https://youmind.ai/">YOUMIND</a>
      <a href="/">HAYE</a>
      <a href="/">YUQUE</a>
      <a href="/">BRIDGE</a>
      <a href="/">EASYDEVO</a>
      <a href="/">ANT DESIGN</a>
    </div>
    <div class="footer-column">
      <h2>社交媒体</h2>
      <a href="https://x.com/">X</a>
      <a href="https://www.linkedin.com/">LINKEDIN</a>
      <a href="https://github.com/">GITHUB</a>
      <a href="https://www.instagram.com/">INSTAGRAM</a>
      <a href="https://telegram.org/">TELEGRAM</a>
    </div>
    <div class="footer-column footer-blog">
      <h2>博客</h2>
      ${footerPosts
        .map(
          (post) =>
            `<a href="/blog/${encodeURIComponent(post.slug)}/">${escapeHtml(post.data.title)}</a>`,
        )
        .join("")}
    </div>
  </footer>`;
}

function homePage(posts) {
  return pageShell({
    title: "MOQILOG",
    description: "同步 Obsidian 的个人博客，记录思考、产品与 AI 工作流。",
    current: "home",
    body: `<section class="home-hero page-shell">
      <p class="sync-note">Obsidian via GitHub · 每次提交自动更新</p>
      <h1>嗨，我是 Moqi<br />记录思考、产品与 AI 工作流</h1>
      <p class="hero-copy">这里同步我的 Obsidian 笔记，整理成可阅读的文章、随笔和项目记录。我关心产品、AI Coding、个人知识库，以及那些能把想法推向现实的工作方式。</p>
    </section>
    <section class="latest page-shell" aria-labelledby="latest-title">
      <div class="section-head">
        <div>
          <h2 class="section-title" id="latest-title">最新文章</h2>
          <p class="section-subtitle">从笔记仓库中整理出的近期更新</p>
        </div>
        <a class="all-posts-link" href="/blog/">查看全部</a>
      </div>
      ${articleRows(posts.slice(0, 6))}
    </section>
    ${siteFooter(posts)}`,
  });
}

function blogPage(posts) {
  const years = [...new Set(posts.map((post) => new Date(post.data.date).getFullYear()))];
  const categories = [...new Set(posts.map((post) => post.data.category))];

  return pageShell({
    title: "博客 - MOQILOG",
    description: "从 Obsidian 同步而来的文章，按时间、主题与标签整理。",
    current: "blog",
    body: `<section class="blog-hero page-shell">
      <h1>博客</h1>
      <p>从 Obsidian 同步而来的文章，按时间、主题与标签整理。</p>
    </section>
    <section class="blog-index page-shell" aria-label="文章列表">
      <div class="filters">
        <label class="filter">
          <span>年份</span>
          <select aria-label="按年份筛选" data-filter-year>
            <option value="all">全部</option>
            ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
          </select>
        </label>
        <label class="filter">
          <span>分类</span>
          <select aria-label="按分类筛选" data-filter-category>
            <option value="all">全部</option>
            ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
      </div>
      <p class="filter-status" data-filter-status aria-live="polite">全部文章 · ${posts.length} 篇</p>
      ${articleRows(posts, 2, true)}
      <p class="empty-state is-hidden" data-filter-empty>没有符合筛选条件的文章。</p>
      <script>
        (() => {
          const yearSelect = document.querySelector("[data-filter-year]");
          const categorySelect = document.querySelector("[data-filter-category]");
          const rows = [...document.querySelectorAll(".article-row")];
          const empty = document.querySelector("[data-filter-empty]");
          const status = document.querySelector("[data-filter-status]");
          const params = new URLSearchParams(window.location.search);

          const restore = (select, value) => {
            if (!value) return;
            const option = [...select.options].find((item) => item.value === value);
            if (option) select.value = value;
          };

          restore(yearSelect, params.get("year"));
          restore(categorySelect, params.get("category"));

          const updateFilters = () => {
            const year = yearSelect.value;
            const category = categorySelect.value;
            let visibleCount = 0;

            for (const row of rows) {
              const visible =
                (year === "all" || row.dataset.year === year) &&
                (category === "all" || row.dataset.category === category);
              row.dataset.hidden = String(!visible);
              row.hidden = !visible;
              row.setAttribute("aria-hidden", String(!visible));
              if (visible) visibleCount += 1;
            }

            const activeParts = [];
            if (year !== "all") activeParts.push(year + " 年");
            if (category !== "all") activeParts.push(category);
            status.textContent = (activeParts.length ? activeParts.join(" · ") : "全部文章") + " · " + visibleCount + " / " + rows.length + " 篇";
            empty.classList.toggle("is-hidden", visibleCount !== 0);

            const nextParams = new URLSearchParams();
            if (year !== "all") nextParams.set("year", year);
            if (category !== "all") nextParams.set("category", category);
            const nextUrl = nextParams.toString()
              ? window.location.pathname + "?" + nextParams.toString()
              : window.location.pathname;
            window.history.replaceState(null, "", nextUrl);
          };

          yearSelect.addEventListener("change", updateFilters);
          categorySelect.addEventListener("change", updateFilters);
          updateFilters();
        })();
      </script>
    </section>
    ${siteFooter(posts)}`,
  });
}

function aboutPage() {
  return pageShell({
    title: "关于 - MOQILOG",
    description: "关于 Moqi 和这个博客。",
    current: "about",
    body: `<section class="about page-shell">
      <h1>关于</h1>
      <p>这里是 Moqi 的个人博客，主要同步 Obsidian 中整理过的文章。主题包括产品、AI、工具、知识管理，以及一些日常思考。</p>
    </section>`,
  });
}

function readTime(content) {
  const text = content.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWords = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  const minutes = Math.max(1, Math.round((chineseChars + latinWords) / 420));
  return `${minutes} min read`;
}

function postToc(headings) {
  if (!headings.length) {
    return `<aside class="post-toc-shell" data-toc-shell>
      <button class="toc-toggle" type="button" aria-label="隐藏目录" aria-expanded="true" data-toc-toggle><span aria-hidden="true"></span></button>
      <p class="toc-empty">暂无章节</p>
    </aside>`;
  }

  return `<aside class="post-toc-shell" data-toc-shell>
    <button class="toc-toggle" type="button" aria-label="隐藏目录" aria-expanded="true" data-toc-toggle><span aria-hidden="true"></span></button>
    <nav class="post-toc" aria-label="文章章节">
      ${headings
        .map(
          (heading, index) =>
            `<a class="toc-link toc-level-${heading.level}${index === 0 ? " is-active" : ""}" href="#${encodeURIComponent(heading.id)}" data-toc-link="${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`,
        )
        .join("")}
    </nav>
  </aside>`;
}

function postPage(post) {
  const rendered = renderMarkdown(post.content);

  return pageShell({
    title: `${post.data.title} - MOQILOG`,
    description: post.data.description || post.data.title,
    current: "blog",
    body: `<article class="post page-shell">
      <header class="post-header">
        <div class="post-header-inner">
          <a class="post-category" href="/blog/">${escapeHtml(post.data.category)}</a>
          <h1>${escapeHtml(post.data.title)}</h1>
          <div class="post-meta">
            <span>${readTime(post.content)}</span>
            <span>-</span>
            <time datetime="${post.data.date}">${formatDate(post.data.date).replaceAll(".", "年").replace(/年(\d{2})年(\d{2})$/, "年$1月$2日")}</time>
          </div>
          ${post.data.description ? `<p>${escapeHtml(post.data.description)}</p>` : ""}
        </div>
      </header>
      <div class="post-layout">
        ${postToc(rendered.headings)}
        <div class="post-body">${rendered.html}</div>
      </div>
      <div class="image-lightbox" data-lightbox hidden>
        <button class="lightbox-close" type="button" aria-label="关闭图片预览" data-lightbox-close>×</button>
        <img alt="" data-lightbox-image />
      </div>
      <script>
        const postLayout = document.querySelector(".post-layout");
        const tocToggle = document.querySelector("[data-toc-toggle]");
        const tocLinks = [...document.querySelectorAll("[data-toc-link]")];
        const sections = tocLinks
          .map((link) => document.getElementById(link.dataset.tocLink))
          .filter(Boolean);
        tocToggle?.addEventListener("click", () => {
          const hidden = postLayout.classList.toggle("is-toc-hidden");
          tocToggle.setAttribute("aria-expanded", String(!hidden));
          tocToggle.setAttribute("aria-label", hidden ? "显示目录" : "隐藏目录");
        });
        const setActiveToc = (id) => {
          for (const link of tocLinks) {
            link.classList.toggle("is-active", link.dataset.tocLink === id);
          }
        };
        const syncToc = () => {
          let active = sections[0]?.id;
          for (const section of sections) {
            if (section.getBoundingClientRect().top <= 120) active = section.id;
          }
          if (active) setActiveToc(active);
        };
        window.addEventListener("scroll", syncToc, { passive: true });
        window.addEventListener("resize", syncToc);
        syncToc();

        const lightbox = document.querySelector("[data-lightbox]");
        const lightboxImage = document.querySelector("[data-lightbox-image]");
        let lightboxScale = 1;
        let lightboxX = 0;
        let lightboxY = 0;
        let dragStart = null;
        const applyLightboxTransform = () => {
          lightboxImage.style.transform = "translate(" + lightboxX + "px, " + lightboxY + "px) scale(" + lightboxScale + ")";
        };
        const resetLightboxTransform = () => {
          lightboxScale = 1;
          lightboxX = 0;
          lightboxY = 0;
          dragStart = null;
          applyLightboxTransform();
        };
        const closeLightbox = () => {
          lightbox.hidden = true;
          lightboxImage.removeAttribute("src");
          document.documentElement.classList.remove("has-lightbox");
          resetLightboxTransform();
        };
        document.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
        lightbox?.addEventListener("click", (event) => {
          if (event.target === lightbox) closeLightbox();
        });
        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
        });
        for (const trigger of document.querySelectorAll("[data-image-zoom]")) {
          trigger.addEventListener("click", () => {
            lightboxImage.src = trigger.dataset.imageZoom;
            lightboxImage.alt = trigger.dataset.imageAlt || "";
            resetLightboxTransform();
            lightbox.hidden = false;
            document.documentElement.classList.add("has-lightbox");
          });
        }
        lightbox?.addEventListener("wheel", (event) => {
          if (lightbox.hidden) return;
          event.preventDefault();
          const previousScale = lightboxScale;
          const nextScale = Math.min(6, Math.max(1, lightboxScale * Math.exp(-event.deltaY * 0.002)));
          if (nextScale === previousScale) return;
          const rect = lightboxImage.getBoundingClientRect();
          const offsetX = event.clientX - (rect.left + rect.width / 2);
          const offsetY = event.clientY - (rect.top + rect.height / 2);
          const ratio = nextScale / previousScale;
          lightboxX -= offsetX * (ratio - 1);
          lightboxY -= offsetY * (ratio - 1);
          lightboxScale = nextScale;
          applyLightboxTransform();
        }, { passive: false });
        lightboxImage?.addEventListener("pointerdown", (event) => {
          if (lightbox.hidden) return;
          event.preventDefault();
          lightboxImage.setPointerCapture(event.pointerId);
          dragStart = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            x: lightboxX,
            y: lightboxY,
          };
          lightboxImage.classList.add("is-dragging");
        });
        lightboxImage?.addEventListener("pointermove", (event) => {
          if (!dragStart || dragStart.pointerId !== event.pointerId) return;
          lightboxX = dragStart.x + event.clientX - dragStart.clientX;
          lightboxY = dragStart.y + event.clientY - dragStart.clientY;
          applyLightboxTransform();
        });
        const endLightboxDrag = (event) => {
          if (!dragStart || dragStart.pointerId !== event.pointerId) return;
          dragStart = null;
          lightboxImage.classList.remove("is-dragging");
        };
        lightboxImage?.addEventListener("pointerup", endLightboxDrag);
        lightboxImage?.addEventListener("pointercancel", endLightboxDrag);
      </script>
    </article>`,
  });
}

async function writePage(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function main() {
  const posts = await readPosts(contentDir);

  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "styles"), { recursive: true });
  await cp(stylesPath, path.join(distDir, "styles/site.css"));

  if (existsSync(path.join(root, "public"))) {
    await cp(path.join(root, "public"), distDir, { recursive: true });
  }

  await writePage(path.join(distDir, "index.html"), homePage(posts));
  await writePage(path.join(distDir, "blog/index.html"), blogPage(posts));
  await writePage(path.join(distDir, "about/index.html"), aboutPage());

  for (const post of posts) {
    await writePage(
      path.join(distDir, "blog", post.slug, "index.html"),
      postPage(post),
    );
  }

  console.log(`Built ${posts.length} posts into dist.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
