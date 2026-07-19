import fs from "fs-extra";
import { PlannerService } from "./planner.service";
import { pipelineContext } from "../../pipeline/pipeline-context";
import { Article } from "../../models/article.model";
import { RssArticle } from "./types";

export class PlannerAgent {

    private plannerService = new PlannerService();

    async run() {

        console.log("\n🧠 Planner Agent Started\n");

        const research: Article[] = pipelineContext.articles;

        const rssArticles: RssArticle[] = research.map(article => ({
            title: article.title,
            link: article.link,
            source: article.source,
            published: new Date(article.published)
        }));

        const plan = await this.plannerService.generatePlan(rssArticles);

        await fs.writeJson(
            "output/reports/content-plan.json",
            plan,
            {
                spaces: 2
            }
        );
        pipelineContext.plannedArticles = plan;
        console.log(`✅ ${plan.length} articles planned`);

    }

}