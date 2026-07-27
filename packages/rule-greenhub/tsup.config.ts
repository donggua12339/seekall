import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  external: ['@seekall/sdk', '@seekall/proxy-pool', 'undici', 'socks-proxy-agent'],
})
