export const DEFAULT_REVIEW_PROMPT = `You are a senior software engineer reviewing a pull request. Please analyze the following changes and provide focused feedback:

Title: {title}
Description: {description}
Author: {author}
State: {state}
URL: {url}

Changes:
{diff}

Please provide a concise analysis focusing on:
1. Code quality and maintainability
2. Idiomatic code and adherence to best practices
3. Potential bugs or edge cases
4. Security implications
5. Performance considerations

Keep the analysis focused on the technical aspects of the changes. Suggest improvements 
and explain your reasoning for each suggestion.`;

export const COMMENT_HEADER = "🐀 CodeSqueak AI Review";
