import fs from "fs-extra";
import path from "path";
import { BLOGGER_DEFAULT_LABELS } from "../../config/blogger.config";
import { BloggerPublishResult, BloggerService } from "./blogger.service";

interface HtmlArticleFile {
    filePath: string;
    createdAt: number;
}

interface PublishStateEntry {
    file: string;
    title: string;
    postId: string;
    url: string;
    labels: string[];
    status: "published";
}

interface PublishState {
    published: PublishStateEntry[];
}

interface PublishOutcome {
    success: boolean;
    post?: BloggerPublishResult;
    error?: string;
}

interface PublishReportEntry {
    title: string;
    file: string;
    postId: string;
    url: string;
    labels: string[];
    publishedAt: string;
    status: "published" | "skipped" | "failed";
    error?: string;
}

interface MetadataShape {
    title?: string;
    labels?: string[];
    keywords?: string[];
    category?: string;
    author?: string;
}

export class PublisherAgent {

    private bloggerService = new BloggerService();

    async run() {

        this.logEvent("info", "blogger.publisher.started", {
            status: "started"
        });

        const articlesDir = path.resolve(process.cwd(), "output/articles/html");

        if (!await fs.pathExists(articlesDir)) {
            this.logEvent("info", "blogger.publisher.empty", {
                status: "empty",
                directory: articlesDir
            });
            return;
        }

        const files = await fs.readdir(articlesDir);
        const htmlFiles: HtmlArticleFile[] = [];

        for (const file of files) {
            if (!file.toLowerCase().endsWith(".html")) {
                continue;
            }

            const filePath = path.join(articlesDir, file);
            const stats = await fs.stat(filePath);
            htmlFiles.push({
                filePath,
                createdAt: stats.mtimeMs
            });
        }

        if (!htmlFiles.length) {
            this.logEvent("info", "blogger.publisher.empty", {
                status: "empty",
                directory: articlesDir
            });
            return;
        }

        htmlFiles.sort((a, b) => b.createdAt - a.createdAt);

        const report: PublishReportEntry[] = [];
        const publishStatePath = path.resolve(process.cwd(), "output/reports/blogger-publish-state.json");
        let publishState: PublishState = { published: [] };

        if (await fs.pathExists(publishStatePath)) {
            publishState = await fs.readJson(publishStatePath) as PublishState;
        }

        const publishedFiles = new Map<string, PublishStateEntry>();
        for (const entry of publishState.published) {
            publishedFiles.set(entry.file, entry);
        }

        for (const item of htmlFiles) {
            const relativeFile = path.relative(process.cwd(), item.filePath);
            const existingEntry = publishedFiles.get(relativeFile);

            if (existingEntry) {
                this.logEvent("info", "blogger.publish.skipped", {
                    title: existingEntry.title,
                    postId: existingEntry.postId,
                    status: "skipped",
                    file: relativeFile
                });

                report.push({
                    title: existingEntry.title,
                    file: relativeFile,
                    postId: existingEntry.postId,
                    url: existingEntry.url,
                    labels: existingEntry.labels,
                    publishedAt: new Date().toISOString(),
                    status: "skipped"
                });
                continue;
            }

            const html = await fs.readFile(item.filePath, "utf8");
            const title = await this.resolveTitle(item.filePath);
            const labels = await this.resolveLabels(item.filePath);

            const result = await this.publishWithRetry(title, html, labels);

            if (result.success && result.post) {
                const entry: PublishStateEntry = {
                    file: relativeFile,
                    title: result.post.title,
                    postId: result.post.postId,
                    url: result.post.url,
                    labels: result.post.labels,
                    status: "published"
                };

                publishState.published.push(entry);
                await fs.writeJson(publishStatePath, publishState, { spaces: 2 });

                this.logEvent("info", "blogger.publish.success", {
                    title: result.post.title,
                    postId: result.post.postId,
                    status: "published",
                    url: result.post.url,
                    labels: result.post.labels,
                    file: relativeFile
                });

                report.push({
                    title,
                    file: relativeFile,
                    postId: result.post.postId,
                    url: result.post.url,
                    labels,
                    publishedAt: new Date().toISOString(),
                    status: "published"
                });
            } else {
                const errorMessage = result.error ?? "Unknown error";

                this.logEvent("error", "blogger.publish.failed", {
                    title,
                    status: "failed",
                    error: errorMessage,
                    file: relativeFile,
                    labels
                });

                report.push({
                    title,
                    file: relativeFile,
                    postId: "",
                    url: "",
                    labels,
                    publishedAt: new Date().toISOString(),
                    status: "failed",
                    error: errorMessage
                });
            }
        }

        await fs.ensureDir(path.resolve(process.cwd(), "output/reports"));
        await fs.writeJson(
            path.resolve(process.cwd(), "output/reports/blogger-publish-report.json"),
            report,
            { spaces: 2 }
        );

        this.logEvent("info", "blogger.publisher.completed", {
            status: "completed",
            published: report.filter(entry => entry.status === "published").length,
            skipped: report.filter(entry => entry.status === "skipped").length,
            failed: report.filter(entry => entry.status === "failed").length
        });
    }

    private async publishWithRetry(title: string, html: string, labels: string[]): Promise<PublishOutcome> {
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const post = await this.bloggerService.publishDraft(title, html, labels);
                return { success: true, post };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logEvent("warn", "blogger.publish.retry", {
                    title,
                    attempt,
                    status: "retry",
                    error: message
                });

                if (attempt === maxAttempts) {
                    return { success: false, error: message };
                }

                await this.delay(1000 * Math.pow(2, attempt - 1));
            }
        }

        return { success: false, error: "Retry attempts exhausted" };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private logEvent(level: "info" | "warn" | "error", event: string, payload: Record<string, unknown>): void {
        const output = JSON.stringify({ level, event, ...payload });
        if (level === "error") {
            console.error(output);
            return;
        }

        console.log(output);
    }

    private async resolveLabels(htmlFilePath: string): Promise<string[]> {
        const fileName = path.basename(htmlFilePath, ".html");
        const metadataPath = path.resolve(process.cwd(), "output/articles/metadata", `${fileName}.json`);

        if (!await fs.pathExists(metadataPath)) {
            return [...BLOGGER_DEFAULT_LABELS];
        }

        try {
            const metadata = await fs.readJson(metadataPath) as MetadataShape;
            const labels = [
                ...(metadata.labels ?? []),
                ...(metadata.keywords ?? []),
                metadata.category ?? "",
                metadata.author ?? ""
            ]
                .filter(Boolean)
                .map(label => String(label).trim());

            return labels.length ? Array.from(new Set(labels)) : [...BLOGGER_DEFAULT_LABELS];
        } catch {
            return [...BLOGGER_DEFAULT_LABELS];
        }
    }

    private async resolveTitle(htmlFilePath: string): Promise<string> {
        const fileName = path.basename(htmlFilePath, ".html");
        const metadataPath = path.resolve(process.cwd(), "output/articles/metadata", `${fileName}.json`);

        if (await fs.pathExists(metadataPath)) {
            try {
                const metadata = await fs.readJson(metadataPath) as MetadataShape;
                if (metadata.title) {
                    return metadata.title;
                }
            } catch {
                // ignore metadata parsing errors and fallback to slug title
            }
        }

        return fileName
            .replace(/-/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

}
