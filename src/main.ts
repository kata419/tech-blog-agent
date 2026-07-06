import { ResearchAgent } from "./agents/research/research.agent";
import { PlannerAgent } from "./agents/planner/planner.agent";

async function main() {

    console.log("====================================");
    console.log("🚀 Tech Blog AI Agent");
    console.log("====================================");

    const research = new ResearchAgent();

    await research.run();

    const planner = new PlannerAgent();

    await planner.run();

}

main();