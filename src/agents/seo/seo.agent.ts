import fs from "fs-extra";
import { SeoService } from "./seo.service";

export class SeoAgent {

    private seoService = new SeoService();

    async run() {

        console.log("\n📈 SEO Agent Started\n");

        const plan = await fs.readJson("output/reports/content-plan.json");

        const nextArticle = plan.find(
            (x: any) => x.status === "TODO"
        );

        if (!nextArticle) {

            console.log("No article found.");

            return;

        }

        const metadata =
            await this.seoService.generateMetadata(nextArticle.title);

        await fs.ensureDir("output/articles/metadata");

        const fileName = nextArticle.title
            .replace(/[^\w]/g, "-")
            .toLowerCase();

        await fs.writeJson(
            `output/articles/metadata/${fileName}.json`,
            metadata,
            {
                spaces: 2
            }
        );

        console.log("✅ Metadata generated");

    }

}