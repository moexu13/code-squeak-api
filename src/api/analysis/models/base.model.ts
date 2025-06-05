export interface ModelConfig {
  max_tokens?: number;
  temperature?: number;
}

export interface ModelResponse {
  completion: string;
  stop_reason: string | null;
  model: string;
}

export interface AIModel {
  analyze(prompt: string, config: ModelConfig): Promise<ModelResponse>;
}
