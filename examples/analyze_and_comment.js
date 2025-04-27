/**
 * Example code for analyzing and commenting on pull requests using the Claude API
 *
 * To use this example:
 * 1. Make sure your server is running
 * 2. Ensure environment variables are set (GITHUB_TOKEN, ANTHROPIC_API_KEY, REDIS_URL, etc.)
 * 3. Update the variables below to match your repository and pull request
 * 4. Run with: node examples/analyze_and_comment.js
 */

import fetch from "node-fetch";

// Configuration
const API_BASE_URL = "http://localhost:3000/api"; // Update if your server runs on a different port
const OWNER = "octocat"; // GitHub repository owner/organization
const REPO = "Hello-World"; // GitHub repository name
const PULL_NUMBER = 1; // Pull request number

// Example 1: Analyze a PR only, no comment posted
async function analyzePROnly() {
  console.log("Example 1: Analyzing PR without posting comment...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/${OWNER}/${REPO}/pull/${PULL_NUMBER}/analyze-and-comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postComment: false, // Don't post comment on GitHub
          maxTokens: 500, // Shorter response
          temperature: 0.3, // Less creative response
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log("Analysis successful!");
      console.log("Analysis:", data.analysis);
      console.log("Comment posted:", data.commentPosted);
    } else {
      console.error("Error:", data.error || "Unknown error");
    }
  } catch (error) {
    console.error("Request failed:", error.message);
  }
}

// Example 2: Analyze PR with custom prompt and post comment
async function analyzeAndComment() {
  console.log("\nExample 2: Analyzing PR with custom prompt and posting comment...");

  try {
    const response = await fetch(
      `${API_BASE_URL}/${OWNER}/${REPO}/pull/${PULL_NUMBER}/analyze-and-comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postComment: true, // Post comment on GitHub
          prompt: `You are a security-focused code reviewer. Please analyze the following pull request:

Title: {title}
Description: {body}
Author: {user}
URL: {url}

Changes:
{diff}

Provide a thorough security review focusing on:
1. Potential security vulnerabilities
2. Input validation issues
3. Authentication/authorization concerns
4. Sensitive data exposure risks
5. Any other security best practices that should be addressed

Be specific in your recommendations.`,
          maxTokens: 1000,
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log("Analysis and comment successful!");
      console.log("Analysis:", data.analysis.substring(0, 200) + "...");
      console.log("Comment posted:", data.commentPosted);
    } else {
      console.error("Error:", data.error || "Unknown error");
    }
  } catch (error) {
    console.error("Request failed:", error.message);
  }
}

// Run examples
async function run() {
  await analyzePROnly();
  await analyzeAndComment();
}

run().catch(console.error);
