# flask --app api.py --debug run
import os
from flask import Flask, request, jsonify
from flask_restful import Api, Resource
from langchain_anthropic import ChatAnthropic
from langchain.tools import BaseTool
from langchain.callbacks import StdOutCallbackHandler
from langchain.agents import AgentExecutor
from langchain.agents.format_scratchpad import format_to_openai_function_messages
from langchain.agents.output_parsers import OpenAIFunctionsAgentOutputParser
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.utils.function_calling import convert_to_openai_function
import requests
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

class GitHubListPullRequestTool(BaseTool):
  name: str = "github_list_pull_request"
  description: str = "Lists open pull requests in a GitHub repository"

  def _run(self, repo_name: str, owner: str) -> List[Dict]:
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPOSITORY")

    headers = {
      "Authorization": f"token {token}",
      "Accept": "application/vnd.github.v3+json",
    }

    url = f"https://api.github.com/repos/{repo}/pulls"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
      prs = response.json()
      return [{
        "number": pr["number"],
        "title": pr["title"],
        "user": pr["user"]["login"],
        "created_at": pr["created_at"],
        "html_url": pr["html_url"],
      } for pr in prs]
    else:
      return [f"Error: {response.status_code} - {response.text}"]

class GitHubPullRequestTool(BaseTool):
  name: str = "github_get_pull_request"
  description: str = "Get details of a specific pull request by number"

  def _run(self, pr_number: int) -> Dict:
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPOSITORY")

    headers = {
      "Authorization": f"token {token}",
      "Accept": "application/vnd.github.v3+json",
    }

    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
      pr = response.json()
      return {
        "number": pr["number"],
        "title": pr["title"],
        "body": pr["body"],
        "state": pr["state"],
        "user": pr["user"]["login"],
        "created_at": pr["created_at"],
        "updated_at": pr["updated_at"],
        "html_url": pr["html_url"],
        "mergeable": pr["mergeable"],
        "draft": pr["draft"],
      }
    else:
      return [f"Error: {response.status_code} - {response.text}"]

class GitHubCommentOnPullRequestTool(BaseTool):
  name: str = "github_comment_on_pull_request"
  description: str = "Add comments to a specific pull request"

  def _run(self, pr_number: int, comment_body: str) -> str:
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPOSITORY")

    headers = {
      "Authorization": f"token {token}",
      "Accept": "application/vnd.github.v3+json",
    }
    
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"

    data = {
      "body": comment_body,
    }

    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code in [200,201]:
      comment = response.json()
      return {
        "id": comment["id"],
        "body": comment["body"],
        "created_at": comment["created_at"],
        "html_url": comment["html_url"],
        "user": comment["user"]["login"]
      }
    else:
      return [f"Error: {response.status_code} - {response.text}"]

def initialize_claude_agent():
  claude = ChatAnthropic(
    model=os.getenv("ANTHROPIC_MODEL"),
    temperature=0,
    callbacks=[StdOutCallbackHandler()],
  )

  github_tools = [
    GitHubListPullRequestTool(),
    GitHubPullRequestTool(),
    GitHubCommentOnPullRequestTool(),
  ]

  functions = [convert_to_openai_function(tool) for tool in github_tools]
  
  prompt = ChatPromptTemplate.from_messages([
    ("system", """
        You are an AI assistant that helps with GitHub Pull Request code review at the level of a senior developer. 
        Use the available tools to comment on PRs in GitHub repositories.
      """),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
  ])

  agent = (
    {
      "input": lambda x: x["input"],
      "agent_scratchpad": lambda x: format_to_openai_function_messages(x["intermediate_steps"]),
    }
    | prompt
    | claude.bind(functions=functions)
    | OpenAIFunctionsAgentOutputParser()
  )

  agent_executor = AgentExecutor(
    agent=agent,
    tools=github_tools,
    verbose=True,
    handle_parsing_errors=True
  )

  return agent_executor
        
app = Flask(__name__)
api = Api(app)

agent_executor = initialize_claude_agent()

class CodeReview(Resource):
  def post(self):
    try:
      data = request.get_json()

      if not data or 'query' not in data:
        return { 'error': 'Missing query parameter' }, 400
      
      query = data['query']

      response = agent_executor.invoke({"input": query})

      return jsonify({
        "response": response['output'],
        "success": True
      })
    
    except Exception as e:
      return { 'error': str(e), 'success': False }, 500
    
api.add_resource(CodeReview, '/v1/code-review')

if __name__ == '__main__':
  port = int(os.environ.get('PORT', 5000))
  debug = os.environ.get('DEBUG', 'False').lower() == 'true'

  app.run(host='0.0.0.0', port=port, debug=debug)