import fs from "fs-extra";
import path from "path";
import { GeminiService } from "./gemini.service";

/**
 * WriterService
 *
 * Responsible for producing a single, focused, production-quality
 * Markdown article for the requested topic. The service enforces strict
 * validation rules so the generated content exactly matches the topic
 * and required structure.
 */
export class WriterService {
    private readonly gemini: GeminiService;
    private readonly maxGenerationAttempts = 1;
    private readonly maxCorrectionAttempts = 2;
    private readonly requiredKeywordMatch = 0.7; // 70%
    private readonly minWords = 2500;

    /**
     * Generate an article strictly about `topic`.
     * Returns the raw Markdown article. Throws if validation repeatedly fails.
     */
    constructor(geminiService?: GeminiService) {
        this.gemini = geminiService ?? new GeminiService();
    }

    public async generateArticle(topic: string): Promise<string> {
        const displayTopic = topic.trim();
        if (!displayTopic) {
            throw new Error("Topic must be a non-empty string.");
        }

        const normalizedTopic = this.normalizeTopic(displayTopic);
        const rules = this.getTopicRules(displayTopic);
        const template = await this.loadPromptTemplate();

        let markdown = "";
        let lastValidationReason = "No generation attempts made.";

        for (let generationAttempt = 1; generationAttempt <= this.maxGenerationAttempts; generationAttempt++) {
            const initialPrompt = this.buildPrompt(template, displayTopic, rules);
            console.log(`WriterService: Generating article for topic: "${displayTopic}" (Attempt ${generationAttempt})`);
            markdown = (await this.gemini.generate(initialPrompt) || "").trim();

            const validation = this.validateArticle(markdown, displayTopic, normalizedTopic, rules);
            if (validation.ok) {
                console.log(`WriterService: Initial generation for "${displayTopic}" passed validation.`);
                return markdown;
            }

            lastValidationReason = validation.reason ?? "Unknown validation error";
            console.warn(`WriterService: Initial generation failed: ${lastValidationReason}`);
        }

        for (let correctionAttempt = 1; correctionAttempt <= this.maxCorrectionAttempts; correctionAttempt++) {
            console.log(`WriterService: Correcting article for topic: "${displayTopic}" (Attempt ${correctionAttempt})`);
            const correctionPrompt = this.buildCorrectionPrompt(displayTopic, markdown, rules, lastValidationReason);
            markdown = (await this.gemini.generate(correctionPrompt) || "").trim();

            const validation = this.validateArticle(markdown, displayTopic, normalizedTopic, rules);
            if (validation.ok) {
                console.log(`WriterService: Correction attempt ${correctionAttempt} for "${displayTopic}" passed validation.`);
                return markdown;
            }

            lastValidationReason = validation.reason ?? "Unknown validation error";
            console.warn(`WriterService: Correction attempt ${correctionAttempt} failed: ${lastValidationReason}`);
        }

        throw new Error(`Failed to generate a valid article for topic: "${displayTopic}" after 1 generation and ${this.maxCorrectionAttempts} correction attempts. Last error: ${lastValidationReason}`);
    }

    /** Build a deterministic prompt with strict instructions. */
    private buildPrompt(template: string, topic: string, rules: TopicRules): string {
        return template
            .replace(/\{\{TOPIC\}\}/g, topic)
            .replace(/\{\{RULES\}\}/g, rules.constraintSummary || "Focus on the requested topic only.");
    }

    private buildCorrectionPrompt(topic: string, previousArticle: string, rules: TopicRules, reason: string): string {
        return [
            `The previous article did not meet the quality standards.`,
            `Reason: ${reason}`,
            `Correct the article so it fully matches the requested topic and passes all validation rules.`,
            `Requested topic: ${topic}`,
            `Topic constraints: ${rules.constraintSummary || "Focus on the requested topic only."}`,
            "",
            "Return ONLY the corrected, complete Markdown article.",
            "Do not include any commentary, apologies, or explanations.",
            "Do not include SEO metadata, validation headers, or any text other than the article itself.",
            "",
            "Previous article to correct:",
            "---",
            previousArticle
        ].join("\n");
    }

    /** Validate the model output. */
    private validateArticle(markdown: string, topic: string, normalizedTopic: string, rules: TopicRules): { ok: boolean; reason?: string } {
        if (!markdown) return { ok: false, reason: "Empty response from model." };

        // Must not include forbidden meta blocks or validation artifacts
        const forbiddenBlocks = ["Requested Topic:", "Validation token:", "SEO Title", "Meta Description", "URL Slug", "Target Keywords", "Interview questions", "FAQs", "ERROR: CANNOT_GENERATE_TOPIC"];
        for (const block of forbiddenBlocks) {
            if (markdown.includes(block)) return { ok: false, reason: `Contains forbidden block: "${block}"` };
        }

        const h1Match = markdown.match(/^#\s*(.*)$/m);
        if (!h1Match) return { ok: false, reason: "No H1 title found at the beginning of the article." };

        const h1 = h1Match[1].trim();
        const normalizedH1 = this.normalizeTopic(h1);
        if (normalizedH1 !== normalizedTopic && this.topicCoverage(normalizedH1, normalizedTopic) < 0.45) {
            return { ok: false, reason: `H1 title must closely match topic. Expected something like '${topic}', but found '${h1}'.` };
        }

        const words = this.wordCount(markdown);
        if (words < this.minWords) return { ok: false, reason: `Word count too low (${words} words, requires at least ${this.minWords}).` };

        const topicCoverage = this.topicCoverage(markdown, topic);
        if (topicCoverage < 0.25) return { ok: false, reason: `Topic coverage too weak (${Math.round(topicCoverage * 100)}%). The article seems to have drifted from the main topic.` };
        
        const required = rules.requiredKeywords || [];
        if (required.length > 0) {
            const { presentCount, missingKeywords } = this.countKeywordsPresent(markdown, required);
            const ratio = presentCount / required.length;
            if (ratio < this.requiredKeywordMatch) {
                return { ok: false, reason: `Insufficient topic keyword coverage: ${presentCount}/${required.length} keywords present (${Math.round(ratio * 100)}%). Missing: ${missingKeywords.slice(0, 3).join(', ')}...` };
            }
        }

        if (rules.category !== 'ai-related' && rules.forbidden?.length) {
            for (const keyword of rules.forbidden) {
                // The topic itself might contain a forbidden word (e.g. 'agent' in 'user agent'). The content is allowed to use it in that case.
                if (this.containsToken(markdown, keyword) && !this.containsToken(topic, keyword)) return { ok: false, reason: `Forbidden AI-related term detected: '${keyword}'. The topic is not about AI.` };
            }
        }

        return { ok: true };
    }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private containsToken(text: string, token: string): boolean {
        const normalizedText = this.normalizeTopic(text);
        const normalizedToken = this.normalizeTopic(token);

        if (!normalizedToken) {
            return false;
        }

        if (/^[a-z0-9]+$/i.test(normalizedToken)) {
            const pattern = new RegExp(`\\b${this.escapeRegex(normalizedToken)}\\b`, "i");
            return pattern.test(normalizedText);
        }

        const pattern = new RegExp(`(^|[^a-z0-9])${this.escapeRegex(normalizedToken)}(?=$|[^a-z0-9])`, "i");
        return pattern.test(normalizedText);
    }

    private normalizeTopic(value: string): string {
        return value
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s.-]/g, " ") // Keep dots and hyphens for things like `mat-` or `.js`
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    private topicCoverage(markdown: string, topic: string): number {
        const contentWords = new Set(this.normalizeTopic(markdown).split(/\s+/).filter(Boolean));
        const topicWords = this.normalizeTopic(topic).split(/\s+/).filter(Boolean);
        if (topicWords.length === 0) return 1;
        const matchCount = topicWords.filter(word => contentWords.has(word)).length;
        return topicWords.length > 0 ? matchCount / topicWords.length : 0;
    }

    private async loadPromptTemplate(): Promise<string> {
        const p = path.resolve(process.cwd(), "prompts/writer.md");
        return fs.readFile(p, "utf8");
    }

    private getTopicRules(topic: string): TopicRules {
        const t = topic.toLowerCase();
        const rules: TopicRules = { forbidden: [], requiredKeywords: [], constraintSummary: "", category: "generic" };
        const commonForbiddenAiTerms = ["ai", "llm", "agent", "a2ui", "chatgpt", "gemini", "agentic", "copilot", "artificial intelligence"];

        if (this.isAiRelatedTopic(t)) {
            rules.category = "ai-related";
            rules.requiredKeywords = [...new Set(topic.split(/[^a-z0-9]+/i).filter(Boolean).slice(0, 8))];
            rules.constraintSummary = "This is an AI-related topic. Focus on the specific AI concepts mentioned. Provide deep technical explanations and code examples related to the AI topic.";
            return rules;
        }

        const topicMappings: { keywords: string[], category: TopicCategory, required: string[], summary: string }[] = [
            { keywords: ["angular signals", "signals"], category: "angular-signals", required: ["signal()", "computed()", "effect()", "writable signals", "Angular", "migration", "performance", "examples"], summary: "Focus on Angular Signals: signal(), computed(), effect(), writable signals, migration, performance, and real-world examples." },
            { keywords: ["rxjs"], category: "rxjs", required: ["rxjs", "observable", "operators", "subjects", "subscriptions", "pipe", "map", "switchMap", "mergeMap"], summary: "Focus on RxJS fundamentals: Observables, Subjects, Operators, Error handling, and Best practices." },
            { keywords: ["primeng", "p-table"], category: "primeng", required: ["PrimeNG", "p-table", "lazy loading", "pagination", "sorting", "filtering", "virtual scrolling"], summary: "Focus on PrimeNG Table (p-table) usage, lazy loading, pagination, sorting, and filtering with production-ready code." },
            { keywords: ["angular material"], category: "angular-material", required: ["Angular Material", "mat-", "theming", "components", "CDK", "accessibility"], summary: "Focus on Angular Material components, theming with SASS, the Component Dev Kit (CDK), and accessibility (a11y)." },
            { keywords: ["angular forms", "forms"], category: "angular-forms", required: ["Reactive Forms", "Template-driven", "FormControl", "FormGroup", "Validators", "valueChanges"], summary: "Focus on Angular Forms: Compare Reactive and Template-driven patterns, cover validation, and performance best practices." },
            { keywords: ["standalone components"], category: "angular-standalone", required: ["standalone", "imports", "bootstrapApplication", "NgModule", "migration"], summary: "Focus on Angular standalone components, migration from NgModules, and modern usage patterns." },
            { keywords: ["performance"], category: "angular-performance", required: ["change detection", "zone.js", "OnPush", "profiling", "bundling", "lazy loading"], summary: "Focus on Angular performance: change detection strategies (OnPush), zone.js, profiling, and bundling optimizations." },
            { keywords: ["dependency injection", "di"], category: "angular-di", required: ["inject", "Injector", "provider", "providedIn", "useFactory", "hierarchical injection"], summary: "Focus on Angular Dependency Injection patterns, providers, hierarchical injectors, and the `inject` function." },
            { keywords: ["router"], category: "angular-router", required: ["RouterModule", "routes", "lazy loading", "route guards", "navigation extras", "resolvers"], summary: "Focus on Angular Router: configuration, lazy loading modules, route guards, and passing data with resolvers." },
            { keywords: ["ssr", "server side rendering"], category: "angular-ssr", required: ["SSR", "server-side rendering", "hydration", "prerender", "transfer state", "universal"], summary: "Focus on Angular SSR/Universal, hydration, prerendering, and using TransferState for performance." },
        ];

        for (const mapping of topicMappings) {
            if (mapping.keywords.some(kw => t.includes(kw))) {
                rules.category = mapping.category;
                rules.forbidden = commonForbiddenAiTerms;
                rules.requiredKeywords = mapping.required;
                rules.constraintSummary = mapping.summary;
                return rules;
            }
        }

        // Default case for generic topics
        rules.forbidden = commonForbiddenAiTerms;
        rules.requiredKeywords = [...new Set(topic.split(/[^a-z0-9]+/i).filter(Boolean).slice(0, 6))];
        rules.constraintSummary = "Focus strictly on the requested topic. Provide deep technical details and production-ready code examples. Do not discuss unrelated concepts.";
        return rules;
    }

    private isAiRelatedTopic(topic: string): boolean {
        return /(?:^|[^a-z])(?:ai|artificial intelligence|agentic|llm|a2ui|gemini|chatgpt|copilot|mcp|ai engineering)(?:$|[^a-z])/i.test(topic);
    }

    private countKeywordsPresent(markdown: string, keys: string[]): { presentCount: number, missingKeywords: string[] } {
        let presentCount = 0;
        const missingKeywords: string[] = [];
        const normalizedMarkdown = this.normalizeTopic(markdown);

        for (const k of keys) {
            const re = new RegExp(`\\b${this.escapeRegex(this.normalizeTopic(k))}\\b`, "i");
            if (re.test(normalizedMarkdown)) {
                presentCount++;
            } else {
                missingKeywords.push(k);
            }
        }
        return { presentCount, missingKeywords };
    }

    private wordCount(markdown: string): number {
        // More robust word count that ignores code blocks and markdown symbols
        const textOnly = markdown
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/`[^`]+`/g, '')       // Remove inline code
            .replace(/[#*->\]\[()]/g, '');   // Remove markdown symbols
        return (textOnly.trim().split(/\s+/).filter(Boolean) || []).length;
    }
}

interface TopicRules {
    forbidden?: string[];
    requiredKeywords?: string[];
    constraintSummary?: string;
    category?: TopicCategory;
}

type TopicCategory = "generic" | "ai-related" | "angular-signals" | "rxjs" | "primeng" | "angular-material" | "angular-forms" | "angular-standalone" | "angular-performance" | "angular-di" | "angular-router" | "angular-ssr";
