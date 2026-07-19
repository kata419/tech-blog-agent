import fs from "fs-extra";
import path from "path";
import { GeminiService } from "../writer/gemini.service";
import { Logger } from "../../shared/logger";

import { RssArticle, GeneratedTopics } from "./types";

export class PlannerService {
    private readonly gemini = new GeminiService();

    public async generatePlan(articles: RssArticle[]): Promise<any[]> {
        const filteredArticles = this.filterFrontendArticles(articles);
        Logger.info(`Found ${articles.length} articles, filtered down to ${filteredArticles.length} frontend-specific articles.`);

        if (filteredArticles.length === 0) {
            Logger.info("No relevant articles to process. Skipping topic generation.");
            return [];
        }

        const generatedTopics = await this.generateTopicsInBatch(filteredArticles);
        const allTopics = generatedTopics.flatMap(group => group.topics);
        
        Logger.info(`Generated ${allTopics.length} raw topics from ${generatedTopics.length} sources.`);

        const uniqueTopics = await this.filterUniqueTopics(allTopics);
        Logger.info(`Filtered down to ${uniqueTopics.length} unique topics.`);

        return uniqueTopics.map(topic => ({
            title: topic,
            source: "GENERATED",
            priority: "HIGH",
            status: "TODO"
        }));
    }

    private filterFrontendArticles(articles: RssArticle[]): RssArticle[] {
        const positiveKeywords = [
            "angular", "typescript", "javascript", "html", "css", "rxjs", 
            "primeng", "angular material", "signals", "standalone", "router", 
            "forms", "component", "directive", "ssr", "hydration", "performance"
        ];

        const negativeKeywords = [
            "ai", "agent", "agentic", "gemini", "a2ui", "newsletter", "weekly", 
            "community", "announcement", "releases"
        ];

        return articles.filter(article => {
            const title = article.title.toLowerCase();
            const hasPositive = positiveKeywords.some(keyword => title.includes(keyword));
            const hasNegative = negativeKeywords.some(keyword => title.includes(keyword));
            return hasPositive && !hasNegative;
        });
    }

    private async generateTopicsInBatch(articles: RssArticle[]): Promise<GeneratedTopics[]> {
        if (articles.length === 0) {
            return [];
        }

        try {
            const prompt = this.buildBatchPrompt(articles);
            const response = await this.gemini.generate(prompt);
            return this.parseBatchResponse(response);
        } catch (error) {
            Logger.error(`Failed to generate topics in batch. ${error}`);
            return [];
        }
    }

    private buildBatchPrompt(articles: RssArticle[]): string {
        const titles = articles.map((article, index) => `${index + 1}. ${article.title}`).join("\n");

        return `
As a Principal Software Engineer specializing in content strategy, your task is to generate evergreen, technical blog topics from a list of RSS article titles.

Your Goal:
For EACH of the following RSS articles, generate 3-5 high-quality, evergreen frontend blog topics.

RSS Articles:
${titles}

Strict Requirements:
1.  **Transform, Don't Copy:** NEVER copy the source titles. Create new, distinct topics that are evergreen tutorials, deep dives, or practical guides.
` + `2.  **Technical Focus:** All topics MUST be about frontend development. Prioritize: Angular, TypeScript, JavaScript, HTML, CSS, RxJS, PrimeNG, Angular Material, Signals, Standalone Components, SSR, Hydration, and Performance.
3.  **Ignore Non-Technical Content:** Discard any titles related to AI, community news, or release announcements.
4.  **JSON Output ONLY:** Return ONLY a valid JSON array of objects, with no markdown, comments, or other text.

Expected JSON Format:
[
  {
    "source": "Original RSS Title 1",
    "topics": [
      "Generated Topic 1.1",
      "Generated Topic 1.2"
    ]
  },
  {
    "source": "Original RSS Title 2",
    "topics": [
      "Generated Topic 2.1",
      "Generated Topic 2.2",
      "Generated Topic 2.3"
    ]
  }
]
`;
    }

    private parseBatchResponse(response: string): GeneratedTopics[] {
        try {
            // Clean the response from potential markdown fences
            const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);

            // Basic validation
            if (Array.isArray(parsed) && parsed.every(item => 
                typeof item === 'object' && item !== null &&
                'source' in item && 'topics' in item && Array.isArray(item.topics)
            )) {
                return parsed as GeneratedTopics[];
            }
            
            Logger.error(`Parsed JSON does not match the expected GeneratedTopics[] structure. ${JSON.stringify(parsed, null, 2)}`);
            return [];
        } catch (error) {
            Logger.error(`Failed to parse Gemini response as JSON. ${error}
Response:
${response}`);
            return [];
        }
    }

    private async filterUniqueTopics(topics: string[]): Promise<string[]> {
        const existingTitles = await this.getExistingArticleTitles();
        const normalizedExisting = new Set(existingTitles.map(this.normalizeTitle));
        
        const uniqueGenerated = new Set<string>();
        const finalTopics: string[] = [];

        for (const topic of topics) {
            const normalized = this.normalizeTitle(topic);
            if (!normalizedExisting.has(normalized) && !uniqueGenerated.has(normalized)) {
                uniqueGenerated.add(normalized);
                finalTopics.push(topic);
            }
        }

        return finalTopics;
    }

    private async getExistingArticleTitles(): Promise<string[]> {
        const metadataDir = "output/articles/metadata";
        const blogTopicsFile = "src/data/blog-topics.json";
        const titles = new Set<string>();

        if (await fs.pathExists(metadataDir)) {
            try {
                const files = await fs.readdir(metadataDir);
                for (const file of files) {
                    if (file.endsWith(".json")) {
                        const content = await fs.readJson(path.join(metadataDir, file));
                        if (content.title) {
                            titles.add(content.title);
                        }
                    }
                }
            } catch (error) {
                Logger.error(`Error reading from metadata directory: ${metadataDir}. ${error}`);
            }
        }

        if (await fs.pathExists(blogTopicsFile)) {
            try {
                const existingTopics = await fs.readJson(blogTopicsFile);
                if (Array.isArray(existingTopics)) {
                    existingTopics.forEach(topic => {
                        if (typeof topic === 'string') titles.add(topic);
                        else if (typeof topic === 'object' && topic.title) titles.add(topic.title);
                    });
                }
            } catch (error) {
                Logger.error(`Error reading from blog topics file: ${blogTopicsFile}. ${error}`);
            }
        }

        return Array.from(titles);
    }
    
    private normalizeTitle(title: string): string {
        return title.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}
