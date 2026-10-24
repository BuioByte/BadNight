import type { Content, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  tools?: {
    type: 'function';
    function: { name: string; description: string; parameters: unknown };
  }[];
}

export interface OpenAIChatCompletionResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: {
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
}

export type GeminiGenerateRequest = GenerateContentParameters;
export type GeminiGenerateResponse = GenerateContentResponse;
export type GeminiContents = Content[];
