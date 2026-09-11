import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { google } from "@ai-sdk/google";
import { streamText, type ModelMessage } from "ai";

const model = process.env.MODEL ?? "gemini-3.1-flash-lite";
const messages: ModelMessage[] = [];

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log(`Chatting with ${model} (via @ai-sdk/google). Ctrl+C to exit.\n`);

while (true) {
    const userInput = await rl.question("you> ");
    messages.push({ role: "user", content: userInput });

    const result = streamText({ model: google(model), messages });

    stdout.write("ai>  ");
    let assistantText = "";
    for await (const chunk of result.textStream) {
        stdout.write(chunk);
        assistantText += chunk;
    }
    stdout.write("\n\n");

    messages.push({ role: "assistant", content: assistantText });
}
