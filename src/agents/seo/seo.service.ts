import { GeminiService } from "../writer/gemini.service";
import { Metadata } from "../../models/metadata.model";

export class SeoService {

    private gemini = new GeminiService();

    async generateMetadata(topic: string): Promise<Metadata> {

        const prompt = `
Generate ONLY valid JSON.

Topic:
${topic}

Return exactly this structure:

{
  "title":"",
  "slug":"",
  "description":"",
  "keywords":["","",""],
  "category":"Frontend",
  "author":"Satish"
}
`;

        const response = await this.gemini.generate(prompt);

        const cleaned = response
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("Invalid JSON returned by Gemini:");
            console.log(cleaned);
            throw error;
        }
    }

}