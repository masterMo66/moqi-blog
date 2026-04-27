import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export function slugify(input) {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[\\/#?%*:|"<>]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { data: {}, content: raw };
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { data: {}, content: raw };
  }

  const yaml = raw.slice(4, end).trim();
  const content = raw.slice(end + 4).replace(/^\n/, "");
  const data = {};
  const lines = yaml.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (rawValue === "") {
      const values = [];
      while (lines[index + 1]?.match(/^\s*-\s+/)) {
        index += 1;
        values.push(cleanYamlValue(lines[index].replace(/^\s*-\s+/, "")));
      }
      data[key] = values;
    } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      data[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((item) => cleanYamlValue(item.trim()))
        .filter(Boolean);
    } else {
      data[key] = cleanYamlValue(rawValue);
    }
  }

  return { data, content };
}

export function stringifyFrontmatter(content, data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---", "", content.trim(), "");
  return lines.join("\n");
}

function cleanYamlValue(value) {
  return String(value)
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function normalizeDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;
  return date.toISOString().slice(0, 10);
}

export function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", ".");
}

export async function readPosts(contentDir) {
  const files = await collectMarkdown(contentDir);
  const posts = [];

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const parsed = parseFrontmatter(raw);
    const fileStats = await stat(file);
    const slug = slugify(path.relative(contentDir, file));
    const fallbackDate = fileStats.mtime.toISOString().slice(0, 10);
    const title = parsed.data.title ?? path.basename(file, ".md");
    const date = normalizeDate(
      parsed.data.date ?? parsed.data.created ?? parsed.data.updated,
      fallbackDate,
    );

    posts.push({
      slug,
      content: stripDuplicateTitle(parsed.content.trim(), title),
      data: {
        title,
        date,
        description: parsed.data.description ?? "",
        category: parsed.data.category ?? parsed.data.type ?? "ESSAY",
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        draft: parsed.data.draft === true || parsed.data.draft === "true",
      },
    });
  }

  return posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
}

function stripDuplicateTitle(content, title) {
  const lines = content.split(/\r?\n/);
  const firstTextLine = lines.findIndex((line) => line.trim());
  if (firstTextLine === -1) return content;

  const firstLine = lines[firstTextLine].trim();
  if (firstLine !== `# ${title}`) return content;

  lines.splice(firstTextLine, 1);
  return lines.join("\n").replace(/^\s+/, "");
}

async function collectMarkdown(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdown(fullPath, files);
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function markdownToHtml(markdown) {
  return renderMarkdown(markdown).html;
}

export function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  const headings = [];
  const headingSlugs = new Map();
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let quote = [];
  let quoteKind = "";
  let code = [];
  let inCode = false;
  let codeLang = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushOrderedList = () => {
    if (!orderedList.length) return;
    html.push(`<ol>${orderedList.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
    orderedList = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    const className = quoteKind ? ` class="callout callout-${escapeHtml(quoteKind)}"` : "";
    const paragraphs = quote
      .join("\n")
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `<p>${inlineMarkdown(item.replace(/\n/g, " "))}</p>`)
      .join("");
    html.push(`<blockquote${className}>${paragraphs}</blockquote>`);
    quote = [];
    quoteKind = "";
  };

  const flushCode = () => {
    if (!inCode) return;
    html.push(
      `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`,
    );
    code = [];
    codeLang = "";
    inCode = false;
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      if (inCode) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        flushOrderedList();
        flushQuote();
        inCode = true;
        codeLang = fence[1] ?? "";
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      continue;
    }

    const quoteLine = line.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const value = quoteLine[1];
      const callout = value.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout) {
        flushQuote();
        quoteKind = callout[1].toLowerCase();
        if (callout[2]) quote.push(callout[2]);
      } else {
        quote.push(value);
      }
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      const level = heading[1].length;
      const text = stripInlineMarkdown(heading[2]);
      const id = uniqueHeadingId(text, headingSlugs);
      if (level >= 2 && level <= 3) {
        headings.push({ id, level, text });
      }
      html.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushOrderedList();
      flushQuote();
      list.push(bullet[1]);
      continue;
    }

    const orderedBullet = line.match(/^\d+\.\s+(.+)$/);
    if (orderedBullet) {
      flushParagraph();
      flushList();
      flushQuote();
      orderedList.push(orderedBullet[1]);
      continue;
    }

    flushQuote();
    paragraph.push(line.trim());
  }

  flushCode();
  flushParagraph();
  flushList();
  flushOrderedList();
  flushQuote();

  return { html: html.join("\n"), headings };
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<button class="image-zoom" type="button" data-image-zoom="$2" data-image-alt="$1" aria-label="放大图片"><img src="$2" alt="$1" loading="lazy" /></button>',
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function stripInlineMarkdown(value) {
  return String(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function uniqueHeadingId(text, slugs) {
  const base =
    text
      .normalize("NFKC")
      .trim()
      .replace(/[\\/#?%*:|"<>()[\]{}]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "section";
  const count = slugs.get(base) ?? 0;
  slugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}
