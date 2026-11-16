/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' 时前端走演示实现（静态托管用），见 src/lib/api.ts。 */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}