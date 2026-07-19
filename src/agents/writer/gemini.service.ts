import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { delay } from "../../utils/delay";

dotenv.config();

export class GeminiService {

    private readonly maxRetries = 4; // Total of 4 attempts
    private readonly initialBackoffMs = 2000;
    private model;
    private cache = new Map<string, string>();

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
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await this.model.generateContent(prompt);
                return result.response.text();
            } catch (error) {
                lastError = error;
                const message = error instanceof Error ? error.message : String(error);

                if (attempt < this.maxRetries && /429|quota|rate limit|Too Many Requests/i.test(message)) {
                    let delayMs = 30000; // Default 30 seconds

                    if (error && typeof error === 'object' && 'errorDetails' in error && Array.isArray((error as any).errorDetails)) {
                        const retryInfo = (error as any).errorDetails.find((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                        if (retryInfo && retryInfo.retryDelay) {
                            const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
                            if (!isNaN(seconds)) {
                                delayMs = seconds * 1000;
                                // Add a small buffer
                                delayMs += 500;
                            }
                        }
                    }
                    
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    continue;
                }
                throw error;
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

}