import fs from "fs-extra";

export class PlannerService {

    async getExistingTopics(): Promise<string[]> {

        const file = "src/data/blog-topics.json";

        const exists = await fs.pathExists(file);

        if (!exists) {
            return [];
        }

        return await fs.readJson(file);

    }

}