import { Anthropic } from "@anthropic-ai/sdk";
import { AIModel, ModelConfig, ModelResponse } from "./base.model";
import { CircuitBreaker } from "../../../utils/circuitBreaker";
import { ModelSettings } from "./config";

export class ClaudeModel implements AIModel {
  private anthropic: Anthropic;
  private circuitBreaker: CircuitBreaker;
  private settings: ModelSettings;

  constructor(settings: ModelSettings) {
    this.settings = settings;
    this.anthropic = new Anthropic({
      apiKey: settings.apiKey,
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 10000,
      halfOpenTimeout: 5000,
      successThreshold: 2,
    });
  }

  async analyze(prompt: string, config: ModelConfig): Promise<ModelResponse> {
    const response = await this.circuitBreaker.execute(() =>
      this.anthropic.messages.create({
        model: this.settings.model,
        max_tokens: config.max_tokens || this.settings.maxTokens,
        temperature: config.temperature || this.settings.temperature,
        messages: [{ role: "user", content: prompt }],
      })
    );

    if ("content" in response) {
      return {
        completion:
          response.content[0].type === "text" ? response.content[0].text : "",
        stop_reason: response.stop_reason,
        model: response.model,
      };
    }

    throw new Error("Unexpected response format from Claude API");
  }
}
