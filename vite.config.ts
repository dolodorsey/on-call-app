import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
