export interface ModelSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ModelConfigOptions {
  max_tokens?: number;
  temperature?: number;
}

export function getModelSettings(model: string): ModelSettings {
  switch (model.toLowerCase()) {
    case "claude":
      return {
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        model: process.env.CLAUDE_MODEL || "claude-3-sonnet-20240229",
        maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "1000"),
        temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || "0.7"),
      };
    // Add other models here
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}
