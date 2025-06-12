import { AIModel } from "./base.model";
import { ModelSettings } from "./config";
import { ClaudeModel } from "./claude.model";

export class ModelFactory {
  private static instance: ModelFactory;
  private modelCache: Map<string, AIModel> = new Map();

  private constructor() {}

  static getInstance(): ModelFactory {
    if (!ModelFactory.instance) {
      ModelFactory.instance = new ModelFactory();
    }
    return ModelFactory.instance;
  }

  createModel(modelType: string, settings: ModelSettings): AIModel {
    const cacheKey = `${modelType}:${settings.model}`;

    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    const model = this.createModelInstance(modelType, settings);
    this.modelCache.set(cacheKey, model);
    return model;
  }

  private createModelInstance(
    modelType: string,
    settings: ModelSettings
  ): AIModel {
    // Extract the base model type from the full model name
    const baseModelType = modelType.split("-")[0].toLowerCase();

    switch (baseModelType) {
      case "claude":
        return new ClaudeModel(settings);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }
}
