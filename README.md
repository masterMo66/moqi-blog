# Moqi Blog

一个从 Obsidian Markdown 同步生成的极简个人博客。项目没有前端运行时依赖，构建脚本会把 `src/content/blog` 中的 Markdown 生成为 `dist` 静态页面。

## 本地开发

```bash
npm run dev
```

## GitHub Pages 部署

博客仓库使用 GitHub Actions 部署到 GitHub Pages：

- push 到 `main` 会部署。
- 每小时会自动拉取一次 GitHub 上的 Obsidian Vault 并部署。
- 也可以在 Actions 页面手动运行 `Deploy GitHub Pages`。

因为 `obsidian-vault` 是 private 仓库，博客仓库需要设置 secret：

- `OBSIDIAN_REPO_TOKEN`: 有权限读取 `masterMo66/obsidian-vault` 的 GitHub token。

## 同步 Obsidian

支持两种来源：

```bash
# 从 GitHub 仓库同步
OBSIDIAN_REPO=git@github.com:your-name/your-vault.git npm run sync:obsidian

# 从本地 Obsidian 目录同步
OBSIDIAN_LOCAL_DIR="/Users/moqi/Documents/Obsidian Vault/Articles" npm run sync:obsidian

# 从当前这台机器的真实 Vault 同步公开文章目录
npm run sync:obsidian:local
```

可选环境变量：

- `OBSIDIAN_BRANCH`: GitHub 分支，默认 `main`
- `OBSIDIAN_SOURCE_DIR`: 仓库内文章目录，默认仓库根目录
- `OBSIDIAN_INCLUDE_DIRS`: 只同步指定目录，逗号分隔，例如 `技术,哲思,金融,商业机会`
- `OBSIDIAN_DEST_DIR`: 博客文章目录，默认 `src/content/blog`

同步脚本会复制 Markdown，补齐缺失的基础 frontmatter，并把常见 Obsidian wikilink 转成网页链接。

只构建当前已有文章：

```bash
npm run build:local
```
