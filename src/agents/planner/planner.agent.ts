import fs from "fs-extra";
import { PlannerService } from "./planner.service";
import { pipelineContext } from "../../pipeline/pipeline-context";

export class PlannerAgent {

    private plannerService = new PlannerService();

    async run() {

        console.log("\n🧠 Planner Agent Started\n");

        const research = pipelineContext.articles;

        const existing =
            await this.plannerService.getExistingTopics();

        const plan = [];

        for (const article of research) {

            const exists = existing.some(topic =>
                article.title.toLowerCase().includes(topic.toLowerCase())
            );

            if (!exists) {

                plan.push({
                    title: article.title,
                    source: article.source,
                    priority: "HIGH",
                    status: "TODO"
                });

            }

        }

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