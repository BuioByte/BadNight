import type {
  Content,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { OpenAICompatibleOptions } from './agent.types.js';
import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatMessage,
} from './openai-compatible-client.types.js';

function getInstructionText(instruction: unknown): string {
  if (typeof instruction === 'string') return instruction;
  if (Array.isArray(instruction)) return instruction.map((part) => part?.text ?? '').join('\n');
  if (!instruction || typeof instruction !== 'object' || !('parts' in instruction) || !Array.isArray(instruction.parts)) return '';
  return instruction.parts.map((part) => part?.text ?? '').join('\n');
}

export function toOpenAIRequest(
  request: GenerateContentParameters,
): OpenAIChatCompletionRequest {
  const messages: OpenAIChatMessage[] = [];
  const systemInstruction = getInstructionText(request.config?.systemInstruction);
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

  const contents = typeof request.contents === 'string'
    ? [{ role: 'user', parts: [{ text: request.contents }] }]
    : Array.isArray(request.contents) ? request.contents : [request.contents];
  for (const content of contents as Content[]) {
    for (const entry of content.parts ?? []) {
      if (!entry || typeof entry !== 'object') continue;
      const text = 'text' in entry && typeof entry.text === 'string' ? entry.text : '';
      const functionCall = 'functionCall' in entry ? entry.functionCall : undefined;
      const functionResponse = 'functionResponse' in entry ? entry.functionResponse : undefined;

      if (functionResponse) {
        messages.push({
          role: 'tool',
          tool_call_id: functionResponse.id ?? `call-${functionResponse.name}`,
          ...(functionResponse.name === undefined ? {} : { name: functionResponse.name }),
          content: JSON.stringify(functionResponse.response ?? {}),
        });
      } else if (content.role === 'model' && functionCall) {
        const callId = functionCall.id ?? `call-${functionCall.name}`;
        const previous = messages.at(-1);
        const call = {
          id: callId,
          type: 'function' as const,
          function: {
            name: functionCall.name ?? '',
            arguments: JSON.stringify(functionCall.args ?? {}),
          },
        };
        if (previous?.role === 'assistant') previous.tool_calls = [...(previous.tool_calls ?? []), call];
        else messages.push({ role: 'assistant', content: text || null, tool_calls: [call] });
      } else if (text) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        const previous = messages.at(-1);
        if (previous?.role === role && !previous.tool_calls) previous.content = [previous.content, text].filter(Boolean).join('\n');
        else messages.push({ role, content: text });
      }
    }
  }

  const declarations = request.config?.tools?.flatMap((tool) =>
    'functionDeclarations' in tool ? tool.functionDeclarations ?? [] : [],
  ) ?? [];
  return {
    model: request.model,
    messages,
    ...(declarations.length === 0 ? {} : {
      tools: declarations.map((declaration) => ({
        type: 'function' as const,
        function: {
          name: declaration.name ?? '',
          description: declaration.description ?? '',
          parameters: declaration.parametersJsonSchema ?? declaration.parameters ?? { type: 'object', properties: {} },
        },
      })),
    }),
  };
}

function fromOpenAIResponse(response: OpenAIChatCompletionResponse): GenerateContentResponse {
  const message = response.choices?.[0]?.message;
  const parts = [
    ...(message?.content ? [{ text: message.content }] : []),
    ...(message?.tool_calls ?? []).map((call, index) => {
      let args: unknown;
      try {
        args = JSON.parse(call.function?.arguments ?? '{}');
      } catch {
        throw new Error(`OpenAI-compatible tool call ${call.function?.name ?? '(unnamed)'} returned invalid JSON arguments.`);
      }
      return {
        functionCall: {
          id: call.id ?? `call-${index}`,
          name: call.function?.name,
          args: args as Record<string, unknown>,
        },
      };
    }),
  ];
  const text = message?.content ?? undefined;
  return {
    candidates: [{ content: { role: 'model', parts } }],
    get text() {
      return text;
    },
  } as unknown as GenerateContentResponse;
}

export function createOpenAICompatibleClient(options: OpenAICompatibleOptions) {
  const fetcher = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl ?? 'http://localhost:1234/v1').replace(/\/+$/, '');

  return {
    models: {
      async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
        const response = await fetcher(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: JSON.stringify(toOpenAIRequest(request)),
        });
        if (!response.ok) {
          throw new Error(`OpenAI-compatible API request failed with status ${response.status}.`);
        }
        return fromOpenAIResponse(await response.json() as OpenAIChatCompletionResponse);
      },
    },
  };
}
