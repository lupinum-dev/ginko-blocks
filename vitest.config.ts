import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': '/src',
      'obsidian': './tests/__mocks__/obsidian.ts',
    },
  },
  define: {
    global: 'globalThis',
  },
  esbuild: {
    target: 'node14'
  }
}) 