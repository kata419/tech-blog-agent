import { ResearchAgent } from "./agents/research/research.agent";
import { PlannerAgent } from "./agents/planner/planner.agent";
import { WriterAgent } from "./agents/writer/writer.agent";
import { SeoAgent } from "./agents/seo/seo.agent";

async function main() {

    console.log("==================================");
    console.log("🚀 Tech Blog AI Agent");
    console.log("==================================");

    const research = new ResearchAgent();
    await research.run();

    const planner = new PlannerAgent();
    await planner.run();

    const writer = new WriterAgent();
    await writer.run();

    const seo = new SeoAgent();
    await seo.run();
}

main();