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
  // List of supported models
  const supportedModels = [
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ];

  // If model is not specified, use the default from env
  if (!model) {
    model = process.env.DEFAULT_MODEL || "claude-3-5-haiku-latest";
  }

  // Check if the model is supported
  if (!supportedModels.includes(model)) {
    throw new Error(
      `Unsupported model: ${model}. Supported models are: ${supportedModels.join(
        ", "
      )}`
    );
  }

  return {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model,
    maxTokens: parseInt(process.env.MAX_TOKENS || "1000", 10),
    temperature: parseFloat(process.env.TEMPERATURE || "0.7"),
  };
}
