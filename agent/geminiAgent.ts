/** Orchestration loop, built on the @google/genai Interactions API (v2.19.0). */

import { GoogleGenAI } from "@google/genai";
import { toolDeclarations } from "./tools";
import { executeTool } from "./toolExecutors";
import { getOrCreateSession, ToolCallRecord } from "./sessionStore";

// gemini-3.7-flash hit a 429 (free-tier limit: 5) after one call in testing;
// -lite has a far safer quota margin for a live demo.
const MODEL = "gemini-3.5-flash-lite";
// Guards against a runaway function-calling loop. Raised from 6 after a real
// failure: screen_investment_candidates + 5 follow-up get_airport_details
// calls (one per result) exhausted the old cap before a final text reply --
// response.output_text came back empty. The prompt rule below should
// prevent that pattern; this is defense in depth.
const MAX_TOOL_ROUNDS = 10;

const SYSTEM_INSTRUCTION = `You are an investment analyst assistant for a firm evaluating US airport modernization and terminal-expansion opportunities.

Rules:
- Every number you state (scores, percentages, dollar-like figures, utilization, delays) MUST come from a tool call result. Never compute or estimate a number yourself.
- Always call a tool before answering a question about a specific airport, a comparison, a ranking, long-haul share, or unmet demand -- even if you think you know the answer.
- Tool results carry a "confidence" field ("sourced" vs "estimated") on several metrics (capacity, long-haul share, delay rate). When you use an "estimated" figure, say so explicitly and briefly note why (see each field's "methodology"/"definition" text) -- do not present estimates as if they were official statistics.
- Explain your reasoning: don't just report a score, explain what drove it (e.g. "high utilization and above-baseline delays" for a high Congestion Index).
- Be concise but complete. Use plain language suitable for a financial analyst, not aviation jargon without explanation.
- If a requested airport isn't in the dataset, say so plainly and suggest the closest available options from the tool's error response rather than guessing.
- get_airport_details already includes unmet-demand and long-haul data for that airport -- don't also call get_unmet_demand_analysis or calculate_long_haul_stats for the same airport in the same turn unless the user asked for something get_airport_details didn't cover.
- screen_investment_candidates already returns each candidate's score and its utilization/congestion/growth components -- that's enough to answer "which airports are strong candidates" on its own. Don't follow it with a separate get_airport_details call for every candidate in the results; only call get_airport_details afterward if the user specifically asks to dig into one particular airport.
- Always reply ENTIRELY in the same language as the user's most recent message -- from the first word to the last, with no mid-reply language switching. This tool is used primarily in English and Hebrew; default to English if the language is ambiguous. Tool results (methodology text, notes, field names) are written in English regardless of the conversation's language -- translate/paraphrase that content naturally into the reply's language rather than quoting it verbatim or drifting back into English while summarizing it. Airport names, IATA codes, and numeric values stay as-is regardless of language.`;

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

/** Sends a message, runs any tool calls the model makes, returns the final reply. */
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
  const reply =
    response.output_text ||
    "I gathered the data below but couldn't finish summarizing it in one turn -- the numbers are shown in the cards below, or try rephrasing your question.";

  session.transcript.push({ role: "user", text: userMessage });
  session.transcript.push({ role: "assistant", text: reply, toolCalls });

  return { reply, toolCalls };
}
