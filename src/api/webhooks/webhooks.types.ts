/**
 * Type definitions for webhook-related functionality
 */

export interface WebhookSignature {
  signature: string;
  timestamp: string;
  algorithm: string;
}

export interface WebhookPayload {
  [key: string]: any;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  timestamp?: number;
  error?: string;
}

export interface GitHubWebhookEvent {
  action: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    id: number;
  };
  [key: string]: any;
}
