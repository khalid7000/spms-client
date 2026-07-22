import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // .env files are only auto-applied to import.meta.env for client code -- reading one here,
  // in vite.config.js's own Node context, needs the explicit loadEnv() call.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Only set for path-prefixed deployments (e.g. RIT Dubai's Academic Dashboard module join,
    // served under https://ie.ritdubai.ae/strtalign/) via VITE_BASE_PATH in that mode's env
    // file (see .env.rit). Every other deployment (this app's own domain, local dev) is served
    // at root and is unaffected by this defaulting to '/'.
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8085',
          changeOrigin: true,
        },
      },
    },
  }
})
