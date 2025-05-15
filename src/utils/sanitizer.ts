export class Sanitizer {
  static sanitizeText(text: string | null | undefined, maxLength: number = 1000): string {
    if (!text) return "";
    return (
      text
        // Remove code blocks and their content
        .replace(/```[\s\S]*?```/g, " ")
        // Remove inline code
        .replace(/`[^`]*`/g, " ")
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, " ")
        // Remove script tags and their content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        // Remove other HTML tags
        .replace(/<[^>]*>/g, " ")
        // Remove special characters
        .replace(/[^\w\s]/g, " ")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    );
  }

  static sanitizePrompt(prompt: string): string {
    return (
      prompt
        // Remove prompt injection markers but keep their content with spaces
        .replace(/\[INST\](.*?)\[\/INST\]/g, "$1 ")
        // Remove system prompt markers but keep their content with spaces
        .replace(/<\|im_start\|>(.*?)<\|im_end\|>/g, "$1 ")
        // Remove role markers but keep their content with spaces
        .replace(/<\|(user|assistant)\|>/g, " ")
        // Remove special characters
        .replace(/[^\w\s]/g, " ")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
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
    // Sanitize diff content with stricter rules
    const sanitizedDiff = data.diff
      // Remove code block markers but keep their content
      .replace(/```(?:diff)?\s*([\s\S]*?)```/g, "$1")
      // Replace first diff marker with 'diff' and remove subsequent markers
      .replace(/^[-+]/gm, (match, offset, string) => {
        // Only replace the first occurrence with 'diff'
        return offset === 0 ? "diff " : "";
      })
      // Remove any script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      // Remove other HTML tags
      .replace(/<[^>]*>/g, " ")
      // Remove sensitive patterns
      .replace(/password\s*=\s*["'][^"']*["']/gi, "password=[REDACTED]")
      .replace(/api[_-]?key\s*=\s*["'][^"']*["']/gi, "api_key=[REDACTED]")
      .replace(/token\s*=\s*["'][^"']*["']/gi, "token=[REDACTED]")
      .replace(/secret\s*=\s*["'][^"']*["']/gi, "secret=[REDACTED]")
      .replace(/key\s*=\s*["'][^"']*["']/gi, "key=[REDACTED]")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();

    return {
      title: this.sanitizeText(data.title, 200),
      body: this.sanitizeText(data.body, 500),
      user: this.sanitizeText(data.user, 50),
      state: this.sanitizeText(data.state, 20),
      url: this.sanitizeText(data.url, 200),
      diff: sanitizedDiff.slice(0, 10000), // Allow longer diffs but still limit length
    };
  }
}
