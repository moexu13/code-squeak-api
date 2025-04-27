# Adding Comments to Pull Requests with Claude AI Analysis

This guide explains how to use the Claude AI service to analyze pull requests and automatically post comments based on the analysis.

## API Endpoint

The new endpoint allows you to analyze a pull request and optionally post a comment with the analysis results:

```
POST /:owner/:repoName/pull/:pullNumber/analyze-and-comment
```

## Request Parameters

| Parameter   | Type    | Description                                         |
| ----------- | ------- | --------------------------------------------------- |
| postComment | boolean | Whether to post the analysis as a comment on the PR |
| prompt      | string  | Optional custom prompt to use for the analysis      |
| maxTokens   | number  | Maximum tokens for Claude response (default: 1000)  |
| temperature | number  | Temperature for Claude response (default: 0.7)      |

## Example Request Bodies

### Basic Analysis (No Comment)

```json
{
  "postComment": false,
  "maxTokens": 500,
  "temperature": 0.3
}
```

### Analysis with Comment

```json
{
  "postComment": true,
  "maxTokens": 1000,
  "temperature": 0.7
}
```

### Custom Prompt with Security Focus

```json
{
  "postComment": true,
  "prompt": "You are a security-focused code reviewer. Analyze this PR for security vulnerabilities...",
  "maxTokens": 1000,
  "temperature": 0.7
}
```

## Response Format

```json
{
  "pullRequest": {
    "title": "Update README.md",
    "body": "Added installation instructions",
    "user": "octocat",
    "state": "open",
    "url": "https://github.com/octocat/Hello-World/pull/1"
  },
  "analysis": "This PR updates the README with improved installation instructions...",
  "commentPosted": true
}
```

## Usage Examples

See the example script in `examples/analyze_and_comment.js` for a complete demonstration of how to use this API endpoint.

### Running the Example

Make sure your server is running with the required environment variables:

- `GITHUB_TOKEN`
- `ANTHROPIC_API_KEY`
- `REDIS_URL`

Then run:

```bash
npm install node-fetch
node examples/analyze_and_comment.js
```

## Implementation Details

The endpoint uses:

1. The GitHub API (via Octokit) to fetch pull request data and post comments
2. The Claude API to analyze the pull request
3. Circuit breaker and rate limiting to handle API errors

## Error Handling

The endpoint returns appropriate error responses in case of:

- Invalid parameters
- GitHub API errors (authentication, rate limits, etc.)
- Claude API errors
- Internal server errors
