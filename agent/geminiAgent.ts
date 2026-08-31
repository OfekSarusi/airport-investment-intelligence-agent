/**
 * Gemini agent orchestration loop, built on the @google/genai Interactions
 * API (v2.19.0). Every field/shape used here was verified directly against
 * node_modules/@google/genai/dist/genai.d.ts and cross-checked against
 * ai.google.dev/gemini-api/docs/function-calling -- not recalled from
 * training memory, since this SDK surface (interactions.create,
 * previous_interaction_id server-side history) postdates this assistant's
 * knowledge cutoff.
 */

import { GoogleGenAI } from "@google/genai";
import { toolDeclarations } from "./tools";
import { executeTool } from "./toolExecutors";
import { getOrCreateSession, ToolCallRecord } from "./sessionStore";

/**
 * gemini-3.7-flash (the newest/most capable flash tier) turned out to have a
 * very tight free-tier quota in practice -- observed empirically as a 429
 * with "limit: 5" during ticket #8's own smoke test, not just a doc claim.
 * gemini-3.5-flash-lite trades a bit of reasoning depth for a much more
 * generous free-tier allowance, which matters more for a live demo than
 * marginal answer quality on these fairly structured, well-scoped tools.
 */
const MODEL = "gemini-3.5-flash-lite";
const MAX_TOOL_ROUNDS = 6; // guards against a runaway function-calling loop

const SYSTEM_INSTRUCTION = `You are an investment analyst assistant for a firm evaluating US airport modernization and terminal-expansion opportunities.

Rules:
- Every number you state (scores, percentages, dollar-like figures, utilization, delays) MUST come from a tool call result. Never compute or estimate a number yourself.
- Always call a tool before answering a question about a specific airport, a comparison, a ranking, long-haul share, or unmet demand -- even if you think you know the answer.
- Tool results carry a "confidence" field ("sourced" vs "estimated") on several metrics (capacity, long-haul share, delay rate). When you use an "estimated" figure, say so explicitly and briefly note why (see each field's "methodology"/"definition" text) -- do not present estimates as if they were official statistics.
- Explain your reasoning: don't just report a score, explain what drove it (e.g. "high utilization and above-baseline delays" for a high Congestion Index).
- Be concise but complete. Use plain language suitable for a financial analyst, not aviation jargon without explanation.
- If a requested airport isn't in the dataset, say so plainly and suggest the closest available options from the tool's error response rather than guessing.
- Always reply in the same language the user's message is written in. This tool is used primarily in English and Hebrew; default to English if the language is ambiguous. Airport names, IATA codes, and numbers stay as-is regardless of language.`;

function requireClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and set it in your environment (see .env.example).",
    );
  }
  return new GoogleGenAI({ apiKey });
}

export interface RunTurnResult {
  reply: string;
  toolCalls: ToolCallRecord[];
}

/**
 * Runs one user turn to completion: sends the message, executes any function
 * calls the model makes (looping until it stops calling tools), and returns
 * the final text reply plus a flat list of every tool call made along the
 * way (for the chat UI's tool-call badges, ticket #9).
 */
export async function runTurn(sessionId: string, userMessage: string): Promise<RunTurnResult> {
  const client = requireClient();
  const session = getOrCreateSession(sessionId);
  const toolCalls: ToolCallRecord[] = [];

  let response = await client.interactions.create({
    model: MODEL,
    input: userMessage,
    tools: toolDeclarations,
    system_instruction: SYSTEM_INSTRUCTION,
    previous_interaction_id: session.lastInteractionId ?? undefined,
    store: true,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCallSteps = (response.steps ?? []).filter(
      (step: any) => step?.type === "function_call",
    ) as Array<{ type: "function_call"; id: string; name: string; arguments: Record<string, unknown> }>;

    if (functionCallSteps.length === 0) {
      break; // model produced a final text answer, no more tools to run
    }

    const functionResults = functionCallSteps.map((call) => {
      const { isError, result } = executeTool(call.name, call.arguments);
      toolCalls.push({ name: call.name, args: call.arguments, result, isError });
      return {
        type: "function_result" as const,
        call_id: call.id,
        name: call.name,
        is_error: isError,
        result: JSON.stringify(result),
      };
    });

    response = await client.interactions.create({
      model: MODEL,
      previous_interaction_id: response.id,
      tools: toolDeclarations,
      input: functionResults,
      store: true,
    });
  }

  session.lastInteractionId = response.id;
  const reply = response.output_text ?? "(The model did not return a text response.)";

  session.transcript.push({ role: "user", text: userMessage });
  session.transcript.push({ role: "assistant", text: reply, toolCalls });

  return { reply, toolCalls };
}
