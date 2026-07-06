import fs from "fs-extra";
import { WriterService } from "./writer.service";

export class WriterAgent {

    private writer = new WriterService();

    async run() {

        console.log("\n✍️ Writer Agent Started\n");

        const plan = await fs.readJson("output/reports/content-plan.json");

        const nextArticle = plan.find(
            (x: any) => x.status === "TODO"
        );

        if (!nextArticle) {

            console.log("No articles to generate.");

            return;

        }

        console.log(`Generating: ${nextArticle.title}`);

        const markdown =
            await this.writer.generateArticle(nextArticle.title);

        await fs.ensureDir("output/articles/markdown");

        const fileName = nextArticle.title
            .replace(/[^\w]/g, "-")
            .toLowerCase();

        await fs.writeFile(
            `output/articles/markdown/${fileName}.md`,
            markdown
        );

        console.log("✅ Markdown created");

    }

}