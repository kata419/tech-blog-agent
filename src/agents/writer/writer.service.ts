import { GeminiService } from "./gemini.service";

export class WriterService {

    private gemini = new GeminiService();

    async generateArticle(topic: string): Promise<string> {

        const prompt = `
You are a Senior Frontend Architect and Technical Writer.

Write a detailed SEO-friendly blog article on:

"${topic}"

The article should include:

# Introduction

# What is it?

# Why is it important?

# Real-world Example

# Code Example

# Best Practices

# Common Mistakes

# Summary

Return the response in Markdown.
`;

        return await this.gemini.generate(prompt);

    }

}