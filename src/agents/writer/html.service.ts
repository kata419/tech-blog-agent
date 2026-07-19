import fs from "fs-extra";
import path from "path";
import { marked } from "marked";

interface ArticleMetadata {
    title: string;
    slug: string;
    description: string;
    keywords: string[];
    category: string;
    author: string;
    canonicalUrl?: string;
    readingTimeMinutes?: number;
    suggestedTags?: string[];
}

interface HeadingItem {
    text: string;
    slug: string;
    level: number;
}

export class HtmlService {
    /**
     * Converts Markdown to a polished, SEO-friendly HTML article shell.
     */
    public async convert(markdownFile: string, outputFile: string): Promise<void> {
        const markdown = await fs.readFile(markdownFile, "utf8");
        const fileName = path.basename(outputFile, path.extname(outputFile));
        const metadata = await this.loadMetadata(fileName, markdown);
        const headings = this.extractHeadings(markdown);
        const articleHtml = await this.renderArticleHtml(markdown, headings);
        const readingTime = metadata.readingTimeMinutes ?? this.estimateReadingTime(markdown);
        const canonicalUrl = metadata.canonicalUrl ?? this.buildCanonicalUrl(metadata.slug);
        const keywords = metadata.keywords.length > 0 ? metadata.keywords.join(", ") : "frontend, web development";
        const description = metadata.description || `${metadata.title} — production-ready guidance for modern developers.`;
        const suggestedTags = metadata.suggestedTags?.length ? metadata.suggestedTags : [metadata.category, "frontend", "developer experience"];

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(metadata.title)}</title>
    <meta name="description" content="${this.escapeAttribute(description)}">
    <meta name="keywords" content="${this.escapeAttribute(keywords)}">
    <meta name="author" content="${this.escapeAttribute(metadata.author)}">
    <meta name="robots" content="index,follow">
    <meta property="og:title" content="${this.escapeAttribute(metadata.title)}">
    <meta property="og:description" content="${this.escapeAttribute(description)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${this.escapeAttribute(canonicalUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${this.escapeAttribute(metadata.title)}">
    <meta name="twitter:description" content="${this.escapeAttribute(description)}">
    <link rel="canonical" href="${this.escapeAttribute(canonicalUrl)}">
    <meta name="article:published_time" content="${new Date().toISOString()}">
    <meta name="article:section" content="${this.escapeAttribute(metadata.category)}">
    <meta name="article:tag" content="${this.escapeAttribute(suggestedTags.join(", "))}">
    <meta name="reading-time" content="${readingTime} min read">
    <style>
        :root { color-scheme: light; }
        body{font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;max-width:980px;margin:0 auto;padding:32px 20px 80px;line-height:1.75;color:#111827;background:#fff;}
        a{color:#2563eb;text-decoration:none;}
        a:hover{color:#1d4ed8;text-decoration:underline;}
        h1,h2,h3,h4{scroll-margin-top:24px;color:#111827;line-height:1.2;}
        .toc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:24px 0;}
        .toc ul{padding-left:18px;}
        .toc a{font-weight:600;}
        .table-wrapper{overflow-x:auto;margin:20px 0;}
        table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;}
        th,td{border:1px solid #e5e7eb;padding:10px 12px;text-align:left;}
        th{background:#f9fafb;}
        pre{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:10px;overflow:auto;white-space:pre-wrap;word-break:break-word;}
        code{font-family:Consolas,Monaco,monospace;font-size:0.95rem;}
        .code-block{position:relative;margin:20px 0;}
        .copy-code{position:absolute;top:10px;right:10px;border:none;border-radius:6px;padding:6px 10px;background:#38bdf8;color:#0f172a;cursor:pointer;font-size:0.8rem;}
        .copy-code:hover{background:#7dd3fc;}
        img{max-width:100%;height:auto;border-radius:10px;display:block;margin:20px 0;}
        .mermaid{background:#ffffff;border:1px solid #e5e7eb;padding:16px;border-radius:10px;overflow:auto;}
        .article-meta{font-size:0.95rem;color:#475569;margin-bottom:20px;}
    </style>
</head>
<body>
    <article>
        <div class="article-meta">
            <strong>${this.escapeHtml(metadata.category)}</strong> · ${readingTime} min read · By ${this.escapeHtml(metadata.author)}
        </div>
        <h1>${this.escapeHtml(metadata.title)}</h1>
        <p>${this.escapeHtml(description)}</p>
        ${headings.length > 0 ? this.renderTableOfContents(headings) : ""}
        ${articleHtml}
    </article>
    <script>
        document.addEventListener("click", async (event) => {
            const button = event.target instanceof HTMLElement ? event.target.closest(".copy-code") : null;
            if (!button) {
                return;
            }
            const codeBlock = button.parentElement?.querySelector("code");
            if (!codeBlock) {
                return;
            }
            const text = codeBlock.textContent ?? "";
            await navigator.clipboard.writeText(text);
            const originalLabel = button.textContent ?? "Copy";
            button.textContent = "Copied";
            window.setTimeout(() => {
                button.textContent = originalLabel;
            }, 1200);
        });
    </script>
</body>
</html>`;

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, html);
    }

    private async loadMetadata(fileName: string, markdown: string): Promise<ArticleMetadata> {
        const metadataPath = path.resolve(process.cwd(), "output/articles/metadata", `${fileName}.json`);

        if (await fs.pathExists(metadataPath)) {
            try {
                const metadata = await fs.readJson(metadataPath) as Partial<ArticleMetadata>;
                return {
                    title: metadata.title ?? this.slugToTitle(fileName),
                    slug: metadata.slug ?? fileName,
                    description: metadata.description ?? this.generateExcerpt(markdown),
                    keywords: metadata.keywords ?? [],
                    category: metadata.category ?? "Frontend",
                    author: metadata.author ?? "Satish",
                    canonicalUrl: metadata.canonicalUrl,
                    readingTimeMinutes: metadata.readingTimeMinutes,
                    suggestedTags: metadata.suggestedTags
                };
            } catch {
                // Fall through to defaults if the metadata file is malformed.
            }
        }

        return {
            title: this.slugToTitle(fileName),
            slug: fileName,
            description: this.generateExcerpt(markdown),
            keywords: [],
            category: "Frontend",
            author: "Satish"
        };
    }

    private async renderArticleHtml(markdown: string, headings: HeadingItem[]): Promise<string> {
        const normalizedMarkdown = this.normalizeMarkdown(markdown);
        const articleHtml = await marked.parse(normalizedMarkdown, { async: false }) as string;
        const withAnchors = this.addHeadingAnchors(articleHtml, headings);
        const withTables = withAnchors.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, '</table></div>');
        const withImages = withTables.replace(/<img\b([^>]*)>/g, '<img$1 loading="lazy" decoding="async">');
        const withCopyButtons = withImages.replace(/<pre><code([^>]*)>/g, '<div class="code-block"><button class="copy-code" type="button">Copy</button><pre><code$1>');
        return withCopyButtons.replace(/<\/code><\/pre>/g, '</code></pre></div>');
    }

    private normalizeMarkdown(markdown: string): string {
        return markdown
            .replace(/```mermaid\s*([\s\S]*?)```/g, (_, code: string) => `<pre class="mermaid">${this.escapeHtml(code.trim())}</pre>`)
            .replace(/```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g, (_, language: string, code: string) => `\n\n\`\`\`\${language || "text"}\n${code.trim()}\n\`\`\`\n\n`);
    }

    private addHeadingAnchors(html: string, headings: HeadingItem[]): string {
        let updatedHtml = html;

        for (const heading of headings) {
            const pattern = new RegExp(`<h${heading.level}[^>]*>([\s\S]*?)<\/h${heading.level}>`, "i");
            updatedHtml = updatedHtml.replace(pattern, (_match, content: string) => {
                const text = content.replace(/<[^>]+>/g, "").trim();
                return `<h${heading.level} id="${heading.slug}">${text}</h${heading.level}>`;
            });
        }

        return updatedHtml;
    }

    private extractHeadings(markdown: string): HeadingItem[] {
        const headings: HeadingItem[] = [];
        const lines = markdown.split(/\r?\n/);

        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (!match) {
                continue;
            }
            const level = match[1].length;
            const text = match[2].trim();
            const slug = this.slugify(text);
            headings.push({ text, slug, level });
        }

        return headings.filter((heading) => heading.text.toLowerCase() !== "table of contents");
    }

    private renderTableOfContents(headings: HeadingItem[]): string {
        const items = headings
            .filter((heading) => heading.level <= 3)
            .map((heading) => `<li><a href="#${heading.slug}">${this.escapeHtml(heading.text)}</a></li>`)
            .join("");

        if (!items) {
            return "";
        }

        return `<nav class="toc" aria-label="Table of contents"><strong>Table of Contents</strong><ul>${items}</ul></nav>`;
    }

    private estimateReadingTime(markdown: string): number {
        const words = markdown.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(3, Math.ceil(words / 220));
    }

    private generateExcerpt(markdown: string): string {
        const plainText = markdown.replace(/[#`>*_\-]/g, " ").replace(/\s+/g, " ").trim();
        return plainText.slice(0, 155);
    }

    private buildCanonicalUrl(slug: string): string {
        const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") ?? "https://example.com";
        return `${siteUrl}/blog/${slug}`;
    }

    private slugToTitle(fileName: string): string {
        return fileName
            .split("-")
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(" ");
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    private escapeAttribute(value: string): string {
        return this.escapeHtml(value).replace(/'/g, "&#39;");
    }
}