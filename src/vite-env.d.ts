/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Akomanga shell origin when Mata is on a separate host (e.g. https://akomanga.vercel.app). */
  readonly VITE_ECOSYSTEM_SHELL_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
