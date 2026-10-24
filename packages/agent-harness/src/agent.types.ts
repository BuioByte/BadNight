import type { AnySchema } from 'ajv';
import type { Content, GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai';

export interface AgentTool {
  name: string;
  description: string;
  parameters?: AnySchema;
}

export type ToolExecutor = (
  name: string,
  arguments_: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type ToolHandler = (
  arguments_: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface ToolRegistry {
  register(tool: AgentTool, handler: ToolHandler): void;
  definitions(): AgentTool[];
  execute(name: string, arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface AgentOptions {
  systemInstruction: string;
  registry: ToolRegistry;
  provider?: 'gemini' | 'openai-compatible';
  apiKey?: string;
  openAICompatible?: OpenAICompatibleOptions;
  client?: AgentClient | GoogleGenAI;
  toolModel?: string;
  narrationModel?: string;
  maxToolRounds?: number;
}

export interface AgentClient {
  models: {
    generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse>;
  };
}

export interface OpenAICompatibleOptions {
  baseUrl?: string;
  apiKey?: string;
  toolModel?: string;
  narrationModel?: string;
  fetch?: typeof fetch;
}

export interface TurnInput {
  action: string;
  thinking?: string;
  history?: Content[];
}

export interface TurnResult {
  text: string;
  history: Content[];
}

export interface Agent {
  runTurn(input: TurnInput): Promise<TurnResult>;
}
