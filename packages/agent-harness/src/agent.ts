import { Ajv, type AnySchema } from 'ajv';
import {
  GoogleGenAI,
  type Content,
  type GenerateContentResponse,
  type FunctionDeclaration,
} from '@google/genai';

const DEFAULT_MODEL = 'gemma-4-26b-a4b-it';
const DEFAULT_MAX_TOOL_ROUNDS = 8;

export interface AgentTool {
  name: string;
  description: string;
  parameters?: AnySchema;
}

export type ToolExecutor = (
  name: string,
  arguments_: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface AgentOptions {
  systemInstruction: string;
  tools: AgentTool[];
  executeTool: ToolExecutor;
  apiKey?: string;
  client?: GoogleGenAI;
  model?: string;
  maxToolRounds?: number;
}

export interface TurnInput {
  input: string;
  history?: Content[];
}

export interface TurnResult {
  text: string;
  history: Content[];
}

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`The model requested undeclared tool "${name}".`);
    this.name = 'UnknownToolError';
  }
}

export class ToolArgumentsError extends Error {
  constructor(name: string, message: string) {
    super(`Invalid arguments for tool "${name}": ${message}`);
    this.name = 'ToolArgumentsError';
  }
}

export class MaxToolRoundsError extends Error {
  constructor(maxToolRounds: number) {
    super(`The model exceeded the maximum of ${maxToolRounds} tool rounds.`);
    this.name = 'MaxToolRoundsError';
  }
}

export class AgentResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentResponseError';
  }
}

export function createAgent(options: AgentOptions) {
  const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  if (!Number.isInteger(maxToolRounds) || maxToolRounds < 1) {
    throw new RangeError('maxToolRounds must be a positive integer.');
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  const tools = new Map(
    options.tools.map((tool) => {
      const schema = tool.parameters ?? { type: 'object', additionalProperties: false };
      return [tool.name, { ...tool, validate: ajv.compile(schema) }] as const;
    }),
  );
  if (tools.size !== options.tools.length) {
    throw new Error('Tool names must be unique.');
  }

  const declarations: FunctionDeclaration[] = options.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    ...(tool.parameters === undefined ? {} : { parametersJsonSchema: tool.parameters }),
  }));

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!options.client && !apiKey) {
    throw new Error('Set GEMINI_API_KEY or provide a Gemini client.');
  }
  const client = options.client ?? new GoogleGenAI(apiKey === undefined ? {} : { apiKey });
  const model = options.model ?? DEFAULT_MODEL;

  return {
    async runTurn({ input, history = [] }: TurnInput): Promise<TurnResult> {
      if (!input.trim()) throw new TypeError('input must not be empty.');

      const contents: Content[] = [...history, { role: 'user', parts: [{ text: input }] }];
      let toolRounds = 0;

      while (true) {
        const response: GenerateContentResponse = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: options.systemInstruction,
            ...(declarations.length === 0 ? {} : { tools: [{ functionDeclarations: declarations }] }),
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate?.content) {
          throw new AgentResponseError('The model returned no candidate content.');
        }
        contents.push(candidate.content);

        const functionCalls = candidate.content.parts
          ?.flatMap((part) => (part.functionCall ? [part.functionCall] : [])) ?? [];
        if (functionCalls.length === 0) {
          const text = response.text?.trim();
          if (!text) throw new AgentResponseError('The model returned no text response.');
          return { text, history: contents };
        }

        if (toolRounds >= maxToolRounds) throw new MaxToolRoundsError(maxToolRounds);
        toolRounds += 1;

        const functionResponses = [];
        for (const call of functionCalls) {
          if (!call.name) throw new AgentResponseError('The model returned a tool call without a name.');
          const tool = tools.get(call.name);
          if (!tool) throw new UnknownToolError(call.name);

          const args: unknown = call.args === undefined ? {} : call.args;
          if (!tool.validate(args)) {
            throw new ToolArgumentsError(call.name, ajv.errorsText(tool.validate.errors));
          }

          const result = await options.executeTool(call.name, args as Record<string, unknown>);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              ...(call.id === undefined ? {} : { id: call.id }),
              response: result,
            },
          });
        }

        contents.push({ role: 'user', parts: functionResponses });
      }
    },
  };
}
