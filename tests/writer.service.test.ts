import assert from "node:assert";
import { test } from "node:test";
import { WriterService } from "../src/agents/writer/writer.service";
import { GeminiService } from "../src/agents/writer/gemini.service";

class MockGeminiService implements GeminiService {
    public prompts: string[] = [];
    constructor(private readonly response: string) {}

    async generate(prompt: string): Promise<string> {
        this.prompts.push(prompt);
        return this.response;
    }
}

test("WriterService validates a topic-specific Angular Signals article", async () => {
    const topic = "Angular Signals";
    const body = [`# ${topic}`];
    const keywordParagraph = "signal() computed() effect() writable signals Angular migration performance examples";

    for (let i = 0; i < 300; i++) {
        body.push(`Paragraph ${i}: ${keywordParagraph}.`);
    }

    const response = body.join("\n\n");
    const gemini = new MockGeminiService(response);
    const writer = new WriterService(gemini);

    const markdown = await writer.generateArticle(topic);

    assert.ok(markdown.startsWith(`# ${topic}`), "Output should start with the exact H1 topic title.");
    assert.ok(markdown.includes("signal()"), "Output should include required keyword signal().");
    assert.ok(markdown.includes("Angular"), "Output should include the topic word Angular.");
    assert.ok(markdown.split(/\s+/).length >= 2500, "Output should meet the minimum word count.");
    assert.strictEqual(gemini.prompts.length, 1, "WriterService should call Gemini once for a valid response.");
});

test("WriterService rejects forbidden terms and retries", async () => {
    const topic = "RxJS";
    const invalidResponse = `# ${topic}\n\nThis article mentions AI and agentic patterns, which are unrelated to RxJS.`;
    const validBody = [`# ${topic}`];
    const keywordParagraph = "rxjs observable operators subjects subscriptions pipe map switchMap mergeMap";
    for (let i = 0; i < 300; i++) {
        validBody.push(`Paragraph ${i}: ${keywordParagraph}.`);
    }
    const validResponse = validBody.join("\n\n");

    let callCount = 0;
    const gemini = new MockGeminiService(validResponse);
    gemini.generate = async (prompt: string) => {
        callCount += 1;
        return callCount === 1 ? invalidResponse : validResponse;
    };

    const writer = new WriterService(gemini);
    const markdown = await writer.generateArticle(topic);

    assert.ok(markdown.includes("rxjs"), "Output should include RxJS keyword.");
    assert.strictEqual(callCount, 2, "WriterService should retry once after an invalid response.");
});

test("WriterService does not reject AI-related topics for AI terminology", async () => {
    const topic = "Community Engineering, Agentic Coding, and Real-User Component Testing";
    const body = [`# ${topic}`];
    const keywordParagraph = "community engineering agentic coding real user component testing collaborative workflows ai assisted validation";

    for (let i = 0; i < 350; i++) {
        body.push(`Paragraph ${i}: ${keywordParagraph}.`);
    }

    const gemini = new MockGeminiService(body.join("\n\n"));
    const writer = new WriterService(gemini);
    const markdown = await writer.generateArticle(topic);

    assert.ok(/ai/i.test(markdown), "AI-related topic content should be accepted when it includes AI terminology.");
    assert.ok(/agentic/i.test(markdown), "AI-related topic content should include the Agentic concept.");
});

test("WriterService accepts topic-specific content for the requested Angular topics", async () => {
    const topics = [
        { topic: "Angular Signals", keywords: ["signal()", "computed()", "effect()", "writable signals", "Angular", "migration", "performance"] },
        { topic: "RxJS", keywords: ["rxjs", "observable", "operators", "subjects", "subscriptions", "pipe", "map", "switchMap", "mergeMap"] },
        { topic: "PrimeNG Table", keywords: ["PrimeNG", "p-table", "lazy loading", "pagination", "sorting", "filtering"] },
        { topic: "Angular Material", keywords: ["Angular Material", "mat-", "theming", "components", "CDK", "accessibility"] },
        { topic: "Angular Forms", keywords: ["Reactive Forms", "Template-driven", "FormControl", "FormGroup", "Validators", "valueChanges"] },
        { topic: "Angular Standalone Components", keywords: ["standalone", "imports", "bootstrapApplication", "NgModule", "Angular 20"] },
        { topic: "Angular Performance", keywords: ["change detection", "zone.js", "OnPush", "profiling", "bundling", "lazy loading"] },
        { topic: "Angular Dependency Injection", keywords: ["inject", "Injector", "provider", "providedIn", "useFactory", "hierarchical injection"] },
        { topic: "Angular Router", keywords: ["RouterModule", "routes", "lazy loading", "route guards", "navigation extras"] },
        { topic: "Angular SSR", keywords: ["SSR", "server-side rendering", "hydrat", "prerender", "transfer state", "universal"] }
    ];

    for (const entry of topics) {
        const body = [`# ${entry.topic}`];
        const keywordParagraph = `${entry.keywords.join(" ")}`;
        for (let i = 0; i < 350; i++) {
            body.push(`Paragraph ${i}: ${keywordParagraph}.`);
        }

        const gemini = new MockGeminiService(body.join("\n\n"));
        const writer = new WriterService(gemini);
        const markdown = await writer.generateArticle(entry.topic);

        assert.ok(markdown.startsWith(`# ${entry.topic}`), `${entry.topic} should use the exact topic as the H1.`);
        for (const keyword of entry.keywords) {
            assert.ok(markdown.includes(keyword), `${entry.topic} should include required keyword ${keyword}.`);
        }
    }
});

export {};
