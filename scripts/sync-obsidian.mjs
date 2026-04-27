import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  normalizeDate,
  parseFrontmatter,
  slugify,
  stringifyFrontmatter,
} from "./lib/content.mjs";

const root = process.cwd();
const repo = process.env.OBSIDIAN_REPO;
const branch = process.env.OBSIDIAN_BRANCH ?? "main";
const localDir = process.env.OBSIDIAN_LOCAL_DIR;
const sourceDir = process.env.OBSIDIAN_SOURCE_DIR ?? "";
const includeDirs = (process.env.OBSIDIAN_INCLUDE_DIRS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const destination = path.resolve(
  root,
  process.env.OBSIDIAN_DEST_DIR ?? "src/content/blog",
);
const cacheDir = path.resolve(root, ".cache/obsidian-vault");
const assetDestination = path.resolve(root, "public/obsidian-assets");

const ignoredDirs = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
  "dist",
  "Templates",
  "templates",
]);

const assetExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svg",
  ".webp",
]);

const categoryByDirectory = new Map([
  ["技术", "TECH NOTES"],
  ["哲思", "ESSAY"],
  ["金融", "FINANCE"],
  ["商业机会", "BUSINESS"],
]);

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function transformObsidianLinks(content, articleDirectory) {
  return content
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, target) => {
      const cleanTarget = target.replace(/^\/+/, "");
      const assetPath = cleanTarget.includes("/")
        ? path.posix.join(articleDirectory, cleanTarget)
        : path.posix.join(articleDirectory, "imgs", cleanTarget);
      return `![${path.basename(cleanTarget)}](/obsidian-assets/${encodeURI(assetPath)})`;
    })
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => {
      return `[${label}](/blog/${encodeURI(slugify(path.basename(target)))}/)`;
    })
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
      return `[${target}](/blog/${encodeURI(slugify(path.basename(target)))}/)`;
    });
}

async function collectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }

    files.push(fullPath);
  }
  return files;
}

async function prepareSource() {
  if (repo) {
    await mkdir(path.dirname(cacheDir), { recursive: true });
    if (existsSync(path.join(cacheDir, ".git"))) {
      run("git", ["fetch", "origin", branch], cacheDir);
      run("git", ["checkout", branch], cacheDir);
      run("git", ["pull", "--ff-only", "origin", branch], cacheDir);
    } else {
      await rm(cacheDir, { recursive: true, force: true });
      run("git", ["clone", "--depth", "1", "--branch", branch, repo, cacheDir]);
    }
    return path.resolve(cacheDir, sourceDir);
  }

  if (localDir) {
    return path.resolve(localDir, sourceDir);
  }

  console.log(
    "No OBSIDIAN_REPO or OBSIDIAN_LOCAL_DIR set; keeping existing sample posts.",
  );
  return null;
}

async function copyAsset(file, sourceRoot) {
  await mkdir(assetDestination, { recursive: true });
  const relative = path.relative(sourceRoot, file);
  const outputPath = path.join(assetDestination, relative);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await cp(file, outputPath);
}

async function writePost(file, sourceRoot) {
  const raw = await readFile(file, "utf8");
  const parsed = parseFrontmatter(raw);
  const sourceStats = await stat(file);
  const title = parsed.data.title ?? path.basename(file, ".md");
  const fallbackDate = sourceStats.mtime.toISOString().slice(0, 10);
  const date = normalizeDate(
    parsed.data.date ?? parsed.data.created ?? parsed.data.updated,
    fallbackDate,
  );

  const relative = path.relative(sourceRoot, file);
  const relativeParts = relative.split(path.sep);
  const topDirectory = relativeParts[0];
  const outputName = `${slugify(path.basename(file, ".md"))}.md`;
  const outputPath = path.join(destination, outputName);
  const data = {
    ...parsed.data,
    title,
    date,
    category:
      parsed.data.category ??
      parsed.data.type ??
      categoryByDirectory.get(topDirectory) ??
      "ESSAY",
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
  };

  const articleDirectory = relativeParts.slice(0, -1).join("/");
  const content = transformObsidianLinks(parsed.content.trim(), articleDirectory);
  await writeFile(outputPath, stringifyFrontmatter(`${content}\n`, data));
}

async function main() {
  const source = await prepareSource();
  if (!source) return;

  if (!existsSync(source)) {
    throw new Error(`Obsidian source directory does not exist: ${source}`);
  }

  await rm(destination, { recursive: true, force: true });
  await rm(assetDestination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  const sourceRoots = includeDirs.length
    ? includeDirs.map((dir) => path.join(source, dir))
    : [source];
  const files = [];
  for (const sourceRoot of sourceRoots) {
    await collectFiles(sourceRoot, files);
  }
  let postCount = 0;
  let assetCount = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const relative = path.relative(source, file);
    const segments = relative.split(path.sep);
    const isMarkdownAssetDraft =
      ext === ".md" && segments.some((segment) => segment === "imgs" || segment === "prompts");

    if (ext === ".md" && !isMarkdownAssetDraft) {
      await writePost(file, source);
      postCount += 1;
    } else if (assetExtensions.has(ext)) {
      await copyAsset(file, source);
      assetCount += 1;
    }
  }

  console.log(`Synced ${postCount} posts and ${assetCount} assets from Obsidian.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
