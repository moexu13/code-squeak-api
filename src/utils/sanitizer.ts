import logger from "./logger";

export class Sanitizer {
  static sanitizeText(text: string | null | undefined, maxLength: number = 1000): string {
    if (!text) return "";

    // Remove any potential HTML/XML tags
    let sanitized = text.replace(/<[^>]*>/g, "");

    // Remove any potential code injection markers
    sanitized = sanitized.replace(/```[\s\S]*?```/g, "");

    // Remove any potential command injection markers
    sanitized = sanitized.replace(/`[^`]*`/g, "");

    // Remove any potential URL injection markers
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, "");

    // Remove any potential special characters that might cause issues
    sanitized = sanitized.replace(/[^\w\s.,!?-]/g, " ");

    // Trim whitespace and limit length
    sanitized = sanitized.trim().slice(0, maxLength);

    logger.debug(
      {
        originalLength: text.length,
        sanitizedLength: sanitized.length,
        context: "Sanitizer",
      },
      "Text sanitized"
    );

    return sanitized;
  }

  static sanitizePullRequestData(data: {
    title: string;
    body: string | null;
    user: string;
    state: string;
    url: string;
    diff: string;
  }): {
    title: string;
    body: string;
    user: string;
    state: string;
    url: string;
    diff: string;
  } {
    return {
      title: this.sanitizeText(data.title, 200),
      body: this.sanitizeText(data.body, 500),
      user: this.sanitizeText(data.user, 50),
      state: this.sanitizeText(data.state, 20),
      url: this.sanitizeText(data.url, 200),
      diff: this.sanitizeText(data.diff, 10000), // Allow longer diffs
    };
  }

  static sanitizePrompt(prompt: string): string {
    // Remove any potential prompt injection markers
    let sanitized = prompt.replace(/\[INST\]|\[\/INST\]/g, "");

    // Remove any potential system prompt markers
    sanitized = sanitized.replace(/<\|im_start\|>|<\|im_end\|>/g, "");

    // Remove any potential role markers
    sanitized = sanitized.replace(/<\|user\|>|<\|assistant\|>/g, "");

    // Remove any potential special characters that might cause issues
    sanitized = sanitized.replace(/[^\w\s.,!?-]/g, " ");

    // Trim whitespace
    sanitized = sanitized.trim();

    logger.debug(
      {
        originalLength: prompt.length,
        sanitizedLength: sanitized.length,
        context: "Sanitizer",
      },
      "Prompt sanitized"
    );

    return sanitized;
  }
}
