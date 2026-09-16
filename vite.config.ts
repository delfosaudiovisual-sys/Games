import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Vite puro, sem SSR.
 *
 * O jogo é um canvas: não há nada para renderizar no servidor, e o SSR só
 * trazia regras extras (nada dependente do navegador no primeiro render) e um
 * servidor Node para hospedar. Saída estática em `dist/`, que sobe em qualquer
 * lugar — inclusive Netlify, com o redirect de SPA em `netlify.toml`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@/convex': path.resolve(import.meta.dirname, './convex'),
    },
  },
  build: {
    target: 'es2022',
    // O jogo é um bundle só; avisar acima de 900kB é ruído.
    chunkSizeWarningLimit: 900,
  },
})
