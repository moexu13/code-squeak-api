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
    if (modelType.toLowerCase().startsWith("claude")) {
      return new ClaudeModel(settings);
    }

    throw new Error(`Unsupported model type: ${modelType}`);
  }
}
