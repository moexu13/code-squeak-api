import { Octokit } from "@octokit/rest";
import { NotFoundError } from "../errors/http";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function getPullRequest(
  owner: string,
  repo: string,
  pullNumber: number
) {
  try {
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return response.data;
  } catch (error: any) {
    if (error.status === 404) {
      throw new NotFoundError("Pull request not found");
    }
    throw error;
  }
}
