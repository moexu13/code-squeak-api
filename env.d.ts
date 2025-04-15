/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_CLAUDE_MODEL: string;
  readonly VITE_GITHUB_APP_ID: string;
  readonly VITE_GITHUB_TOKEN: string;
  readonly VITE_GITHUB_WEBHOOK_SECRET: string;
  readonly LOG_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
