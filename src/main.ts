import { ResearchAgent } from "./agents/research/research.agent";

async function main() {

  console.log("==================================");
  console.log("🚀 Tech Blog AI Agent");
  console.log("==================================");

  const research = new ResearchAgent();

  await research.run();

}

main();