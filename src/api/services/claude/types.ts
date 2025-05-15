export interface ClaudeConfig {
  maxTokens: number;
  temperature: number;
  timeout: number;
  model: string;
}

export interface MessageOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}
