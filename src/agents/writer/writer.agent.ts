import fs from "fs-extra";
import { WriterService } from "./writer.service";
import { HtmlService } from "./html.service";
import { pipelineContext } from "../../pipeline/pipeline-context";

interface PlannedArticle {
    title: string;
    status: string;
}

export class WriterAgent {
    private readonly writer = new WriterService();
    private readonly htmlService = new HtmlService();

    public async run(): Promise<void> {
        console.log("\n✍️ Writer Agent Started\n");

        let generatedCount = 0;
        let failedCount = 0;

        await fs.ensureDir("output/articles/markdown");
        await fs.ensureDir("output/articles/html");

        for (const article of pipelineContext.plannedArticles) {
            if (article.status === "TODO") {
                try {
                    console.log(`Generating: ${article.title}`);

                    const markdown = await this.writer.generateArticle(article.title);
                    pipelineContext.currentArticle = article;
                    pipelineContext.markdown = markdown;

                    const fileName = article.title
                        .replace(/[^\w]/g, "-")
                        .toLowerCase();

                    const markdownPath = `output/articles/markdown/${fileName}.md`;
                    await fs.writeFile(markdownPath, markdown);
                    console.log("✅ Markdown created");

                    const htmlPath = `output/articles/html/${fileName}.html`;
                    await this.htmlService.convert(markdownPath, htmlPath);

                    const html = await fs.readFile(htmlPath, "utf8");
                    pipelineContext.html = html;
                    console.log("✅ HTML created");

                    generatedCount++;
                } catch (error) {
                    console.error(`❌ Failed to generate article "${article.title}":`, error);
                    failedCount++;
                }
            }
        }

        console.log(`\nGenerated: ${generatedCount}`);
        console.log(`Failed: ${failedCount}`);
    }
}