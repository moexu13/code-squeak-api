import { ClaudeConfig } from "./types";

export const getClaudeConfig = (): ClaudeConfig => ({
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "1000"),
  temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || "0.7"),
  timeout: parseInt(process.env.CLAUDE_TIMEOUT || "30000"),
  model: process.env.CLAUDE_MODEL || "claude-3-opus-20240229",
});
