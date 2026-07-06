import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

export class GeminiService {

    private model;

    constructor() {

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not found in .env");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        this.model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

    }

    async generate(prompt: string): Promise<string> {

        const result = await this.model.generateContent(prompt);

        return result.response.text();

    }

}