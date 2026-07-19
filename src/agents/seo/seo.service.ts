import { GeminiService } from "../writer/gemini.service";
import { Metadata } from "../../models/metadata.model";

export class SeoService {
    private readonly gemini = new GeminiService();

    public async generateMetadata(topic: string, markdownContent: string): Promise<Metadata> {
        const wordCount = this.wordCount(markdownContent);
        const readingTimeMinutes = Math.ceil(wordCount / 200); // Avg reading speed 200 wpm

        const prompt = this.buildPrompt(topic, markdownContent);

        const response = await this.gemini.generate(prompt);
        const cleaned = this.extractJson(response);

        try {
            const partialMetadata = JSON.parse(cleaned);
            const slug = partialMetadata.slug || this.slugify(partialMetadata.title);

            return {
                title: partialMetadata.title,
                slug: slug,
                description: partialMetadata.description,
                keywords: partialMetadata.keywords || [],
                category: partialMetadata.category || "Technology",
                author: "Satish",
                canonicalUrl: `https://s-a-t-i-s-h.github.io/blog/${slug}`,
                readingTimeMinutes: readingTimeMinutes,
                suggestedTags: partialMetadata.suggestedTags || partialMetadata.keywords || [],
                ogTitle: partialMetadata.title,
                ogDescription: partialMetadata.description,
                twitterCard: "summary_large_image",
            };
        } catch (error) {
            console.error("SeoService: Invalid JSON returned by Gemini.");
            console.log(cleaned);
            throw error;
        }
    }

    private buildPrompt(topic: string, markdownContent: string): string {
        const articleExcerpt = markdownContent.substring(0, 4000);

        return `
You are a world-class SEO expert and technical content strategist.
Your task is to generate optimal SEO metadata for the provided technical article.

Analyze the following article content and generate ONLY a valid JSON object.

Initial Topic: "${topic}"

Article Content (excerpt):
---
${articleExcerpt}
---

Generate a JSON object with exactly this structure:
{
  "title": "A concise, compelling, SEO-friendly title for the article (max 70 chars)",
  "slug": "A lowercase, hyphenated-slug-for-the-url based on the title",
  "description": "A compelling meta description summarizing the article's value (150-160 chars)",
  "keywords": ["An array of 5-7 primary and secondary keywords"],
  "suggestedTags": ["An array of 3-5 relevant tags for blog platforms"],
  "category": "A single, most relevant category (e.g., 'Angular', 'TypeScript', 'AI Engineering', 'Web Development')"
}
`;
    }

    private extractJson(text: string): string {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? match[0] : "{}";
    }

    private wordCount(text: string): number {
        return (text.trim().split(/\s+/).filter(Boolean) || []).length;
    }

    private slugify(text: string): string {
        if (!text) return "";
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
}