import type { AnySchema } from 'ajv';
import type { Content, GoogleGenAI } from '@google/genai';

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
