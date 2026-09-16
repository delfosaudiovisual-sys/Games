import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Ambiente `node`, não jsdom.
 *
 * Todos os testes são de lógica pura — visão, desbloqueio, melhorias, fusão de
 * save e a simulação de balanceamento rodam com o motor na mão, sem DOM. Tirar
 * o jsdom também tirou o `canvas`, peer opcional dele que travava o npm com
 * "Cannot read properties of null (reading 'edgesOut')".
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@/convex': path.resolve(import.meta.dirname, './convex'),
    },
  },
})
