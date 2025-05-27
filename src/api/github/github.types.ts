/**
 * Type definitions for GitHub API responses
 */

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  stargazers_count: number;
  language: string | null;
}

export interface PullRequest {
  id: number;
  html_url: string;
  title: string;
  number: number;
  user: {
    login: string;
  };
  comments: number;
  additions: number;
  deletions: number;
  created_at: string;
  updated_at: string;
  body_preview: string | null;
}
