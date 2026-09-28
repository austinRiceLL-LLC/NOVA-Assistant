import { env } from "cloudflare:workers";
import type { AIProvider } from "./types";

type RuntimeEnv = Record<string, string | undefined>;
type ResponseOutput = { type?: string; name?: string; call_id?: string; arguments?: string; content?: Array<{ type?: string; text?: string }> };
type ResponsePayload = { id?: string; output_text?: string; output?: ResponseOutput[] };

function outputText(payload: ResponsePayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === "output_text" && item.text).map(item => item.text).join("").trim();
}

export class OpenAIResponsesProvider implements AIProvider {
  constructor(private readonly options: { apiKey: string; model: string; baseUrl?: string; fetcher?: typeof fetch }) {}
  private request(body: Record<string, unknown>) {
    return (this.options.fetcher ?? fetch)(`${(this.options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/responses`, { method: "POST", signal: AbortSignal.timeout(55_000), headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: this.options.model, ...body }) });
  }
  async generate(input: { system: string; prompt: string }) {
    const response = await this.request({ instructions: input.system, input: input.prompt });
    if (!response.ok) throw new Error(`Model request failed (${response.status}).`);
    const text = outputText(await response.json() as ResponsePayload);
    if (!text) throw new Error("The model returned no text.");
    return text;
  }
  async *stream(input: { system: string; prompt: string }) {
    const response = await this.request({ instructions: input.system, input: input.prompt, stream: true });
    if (!response.ok || !response.body) throw new Error(`Model stream failed (${response.status}).`);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    while (true) {
      const part = await reader.read(); buffer += decoder.decode(part.value, { stream: !part.done });
      const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
      for (const event of events) for (const line of event.split("\n")) if (line.startsWith("data: ") && line !== "data: [DONE]") {
        const value = JSON.parse(line.slice(6)) as { type?: string; delta?: string; message?: string };
        if (value.type === "response.output_text.delta" && value.delta) yield value.delta;
        if (value.type === "error") throw new Error(value.message || "Model stream failed.");
      }
      if (part.done) break;
    }
  }
  async generateStructured<T>(input: { system: string; prompt: string; validate(value: unknown): T }) {
    const text = await this.generate({ system: `${input.system}\nReturn one valid JSON object and no markdown.`, prompt: input.prompt });
    return input.validate(JSON.parse(text));
  }
  async toolLoop(input: { system: string; prompt: string; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>; execute(name: string, argumentsValue: unknown): Promise<unknown> }) {
    const tools = input.tools.map(tool => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters, strict: true }));
    let response = await this.request({ instructions: input.system, input: input.prompt, tools });
    if (!response.ok) throw new Error(`Model request failed (${response.status}).`);
    let payload = await response.json() as ResponsePayload;
    for (let round = 0; round < 4; round += 1) {
      const calls = (payload.output ?? []).filter(item => item.type === "function_call" && item.name && item.call_id);
      if (!calls.length) {
        const text = outputText(payload);
        if (!text) throw new Error("The model returned no text.");
        return text;
      }
      const outputs = [];
      for (const call of calls) {
        let argumentsValue: unknown = {};
        try { argumentsValue = JSON.parse(call.arguments || "{}"); } catch { argumentsValue = {}; }
        const result = await input.execute(call.name!, argumentsValue);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      response = await this.request({ instructions: input.system, previous_response_id: payload.id, input: outputs, tools });
      if (!response.ok) throw new Error(`Model tool continuation failed (${response.status}).`);
      payload = await response.json() as ResponsePayload;
    }
    throw new Error("The model exceeded the workspace tool limit.");
  }
}

export function getAtlasModelProvider(): AIProvider | null {
  const values = env as unknown as RuntimeEnv;
  const provider = values.NOVA_AI_PROVIDER?.trim().toLowerCase();
  const apiKey = (values.NOVA_AI_API_KEY || values.OPENAI_API_KEY)?.trim();
  const model = values.NOVA_AI_MODEL?.trim();
  if (provider !== "openai" || !apiKey || !model) return null;
  return new OpenAIResponsesProvider({ apiKey, model, baseUrl: values.NOVA_AI_BASE_URL?.trim() || undefined });
}
