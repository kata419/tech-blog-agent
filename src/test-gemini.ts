import { GeminiService } from "./agents/writer/gemini.service";

async function test() {

    const gemini = new GeminiService();

    const response = await gemini.generate(
        "Explain Angular Signals in 100 words."
    );

    console.log(response);

}

test();