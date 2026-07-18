import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    shims: false,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    dts: false,
    clean: false,
    sourcemap: false,
    splitting: false,
    shims: false,
    // ESM shebang: 用 Node 20+ 原生支持，不加 banner
    // CLI 入口文件由 package.json bin 字段指向 dist/cli.js
    // npx @seekall/sdk init 实际执行: node dist/cli.js
  },
])
