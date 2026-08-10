import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const releaseMarker = (): Plugin => ({
  name: 'on-call-release-marker',
  generateBundle() {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local'
    const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || 'local'
    const environment = process.env.VERCEL_ENV || 'development'
    this.emitFile({
      type: 'asset',
      fileName: 'release.json',
      source: `${JSON.stringify({
        app: 'on-call-app',
        brand: 'ON CALL',
        status: 'ok',
        commit: sha,
        branch,
        environment,
        built_at: new Date().toISOString(),
      }, null, 2)}\n`,
    })
  },
})

export default defineConfig({
  plugins: [react(), releaseMarker()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-runtime': ['react', 'react-dom'],
          'data-runtime': ['@supabase/supabase-js'],
          'payments-runtime': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          'native-runtime': [
            '@capacitor/core',
            '@capacitor/browser',
            '@capacitor/haptics',
            '@capacitor/share',
            '@capacitor/splash-screen',
            '@capacitor/status-bar',
          ],
        },
      },
    },
  },
})
