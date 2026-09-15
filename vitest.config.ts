import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Pinia/uni mocks and fake timers are process-global; serial files prevent cross-suite state bleed.
    fileParallelism: false,
  },
})
