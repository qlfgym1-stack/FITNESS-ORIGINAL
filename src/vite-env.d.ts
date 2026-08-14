/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __VERSION_INFO__: {
  version: string;
  build: number;
  buildId: string;
  commitSha: string;
  buildDate: string;
  minSupportedVersion: string;
};
