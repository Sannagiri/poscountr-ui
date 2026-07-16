/**
 * Centralized, validated access to build-time environment variables.
 *
 * Vite only exposes variables prefixed `VITE_` on `import.meta.env`, and it
 * bakes them in at build time (see POSCountr-UI-Planning/poscountr-ui-docker-plan.md §4)
 * — one build per stage, never reconfigured at container boot.
 *
 * Never read `import.meta.env.VITE_*` directly from a component or service;
 * import `env` from here instead (docs/coding-standards.md §21).
 */

export type AppStage = 'local' | 'stage' | 'production';

interface AppEnv {
  apiBaseUrl: string;
  appStage: AppStage;
  isProduction: boolean;
}

function readRequired(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${key}". Copy .env.example to .env.local and set it.`,
    );
  }
  return value;
}

function readStage(value: string | undefined): AppStage {
  if (value === 'local' || value === 'stage' || value === 'production') {
    return value;
  }
  return 'local';
}

const appStage = readStage(import.meta.env.VITE_APP_STAGE);

export const env: AppEnv = {
  apiBaseUrl: readRequired('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  appStage,
  isProduction: appStage === 'production',
};
